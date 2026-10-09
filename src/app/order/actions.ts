"use server";

import { GENERIC_DOOR } from "@/lib/access";
import { ORDER_COPY } from "@/lib/order/copy";
import { isPartnerElevated, openPartnerDoor, registerPartnerDoor } from "@/lib/order/door";
import { bundleFromStoreParts } from "@/lib/order/persist";
import {
  clearPartnerSession,
  readPartnerAccountBook,
  readSessionPartnerAccount,
  writePartnerDraftPersist,
  writePartnerSessionId,
} from "@/lib/order/session";
import { getSignupStore } from "@/lib/signups";
import { getVauxhallStore } from "@/lib/vauxhall/store";

function fail(message = GENERIC_DOOR) {
  return { ok: false as const, message };
}

export async function registerPartnerAction(formData: FormData) {
  const dispensaryName = String(formData.get("dispensaryName") ?? "");
  const address = String(formData.get("address") ?? "");
  const contactName = String(formData.get("contactName") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const email = String(formData.get("email") ?? "");
  const license = String(formData.get("license") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const age21 = String(formData.get("age21") ?? "") === "1";

  const rows = await readPartnerAccountBook();
  const bound = registerPartnerDoor(
    { dispensaryName, address, contactName, phone, email, license, password, confirm, age21 },
    rows,
  );
  if (!bound.ok) return fail(bound.message);

  const created = rows[rows.length - 1];
  if (!created) return fail();
  try {
    const store = getSignupStore();
    const stored = await store.insertDispensary({
      dispensaryName: created.dispensaryName,
      address: created.address,
      contactName: created.contactName,
      phone: created.phone,
      ocmLicense: created.license,
      email: created.email,
      passwordHash: created.passwordHash,
      passwordSalt: created.passwordSalt,
      age21AckAt: new Date().toISOString(),
    });
    const sessionId = await store.openDispensarySession(stored.id);
    await writePartnerSessionId(sessionId);
  } catch {
    return fail();
  }
  return { ok: true as const };
}

export async function openPartnerDoorAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const rows = await readPartnerAccountBook();
  const bound = openPartnerDoor({ email, password }, rows);
  if (!bound.ok) return fail(bound.message);

  try {
    const sessionId = await getSignupStore().openDispensarySession(bound.session.accountId);
    await writePartnerSessionId(sessionId);
  } catch {
    return fail();
  }
  return { ok: true as const };
}

export async function closePartnerDoorAction() {
  await clearPartnerSession();
  return { ok: true as const };
}

export async function submitPartnerRequestAction(input: {
  lines: Array<{ skuId: string; format: string; qty: number }>;
  promisedOn: string;
  notes?: string;
}) {
  const account = await readSessionPartnerAccount();
  if (!account) return fail();
  if (!isPartnerElevated({ email: account.email, license: account.license }, [account])) {
    return fail(ORDER_COPY.pendingBlock);
  }

  const lines = input.lines.map((line) => ({
    skuId: line.skuId,
    format: line.format,
    qty: line.qty,
  }));
  const store = getVauxhallStore();
  const result = store.createOrderRequest({
    accountId: account.accountId,
    lines,
    promisedOn: input.promisedOn,
    notes: input.notes,
    actor: account.email,
  });
  if (!result.ok) return fail(result.reason);

  try {
    await getSignupStore().insertOrder({
      dispensaryAccountId: account.accountId,
      lines,
      promisedOn: input.promisedOn,
      notes: input.notes ?? "",
    });
  } catch {
    return fail();
  }

  const order = store.listOrders().find((row) => row.id === result.id);
  const event = store.listEvents().find((row) => row.summary === "ORDER_REQUEST" && row.sub.startsWith(result.id));
  if (order && event) {
    await writePartnerDraftPersist(bundleFromStoreParts({ order, event }));
  }
  return { ok: true as const, id: result.id };
}
