"use server";

import { GENERIC_DOOR } from "@/lib/access";
import { ORDER_COPY } from "@/lib/order/copy";
import { findPartnerAccount, isPartnerElevated, openPartnerDoor, registerPartnerDoor } from "@/lib/order/door";
import { bundleFromStoreParts } from "@/lib/order/persist";
import {
  clearPartnerSession,
  readPartnerAccountBook,
  readPartnerSession,
  writePartnerAccountBook,
  writePartnerDraftPersist,
  writePartnerSession,
} from "@/lib/order/session";
import { getVauxhallStore } from "@/lib/vauxhall/store";

function fail(message = GENERIC_DOOR) {
  return { ok: false as const, message };
}

export async function registerPartnerAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const license = String(formData.get("license") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const age21 = String(formData.get("age21") ?? "") === "1";

  const rows = await readPartnerAccountBook();
  const bound = registerPartnerDoor({ email, license, password, confirm, age21 }, rows);
  if (!bound.ok) return fail(bound.message);

  await writePartnerAccountBook(rows);
  await writePartnerSession(bound.session);
  return { ok: true as const };
}

export async function openPartnerDoorAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const license = String(formData.get("license") ?? "");
  const password = String(formData.get("password") ?? "");
  const age21 = String(formData.get("age21") ?? "") === "1";

  const rows = await readPartnerAccountBook();
  const bound = openPartnerDoor({ email, license, password, age21 }, rows);
  if (!bound.ok) return fail(bound.message);

  await writePartnerSession(bound.session);
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
  const session = await readPartnerSession();
  if (!session) return fail();

  const rows = await readPartnerAccountBook();
  const account = findPartnerAccount({ email: session.email, license: session.license }, rows);
  if (!account || account.accountId !== session.accountId) return fail();
  if (!isPartnerElevated({ email: session.email, license: session.license }, rows)) {
    return fail(ORDER_COPY.pendingBlock);
  }

  const store = getVauxhallStore();
  const result = store.createOrderRequest({
    accountId: session.accountId,
    lines: input.lines,
    promisedOn: input.promisedOn,
    notes: input.notes,
    actor: session.email,
  });
  if (!result.ok) return fail(result.reason);

  const order = store.listOrders().find((row) => row.id === result.id);
  const event = store.listEvents().find((row) => row.summary === "ORDER_REQUEST" && row.sub.startsWith(result.id));
  if (order && event) {
    await writePartnerDraftPersist(bundleFromStoreParts({ order, event }));
  }
  return { ok: true as const, id: result.id };
}
