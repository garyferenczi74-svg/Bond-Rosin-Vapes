"use server";

import { GENERIC_DOOR } from "@/lib/access";
import { bindPartnerDoor } from "@/lib/order/door";
import { bundleFromStoreParts } from "@/lib/order/persist";
import {
  clearPartnerSession,
  readPartnerSession,
  writePartnerDraftPersist,
  writePartnerSession,
} from "@/lib/order/session";
import { getVauxhallStore } from "@/lib/vauxhall/store";

function fail(message = GENERIC_DOOR) {
  return { ok: false as const, message };
}

export async function openPartnerDoorAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const inviteCode = String(formData.get("inviteCode") ?? "");
  const license = String(formData.get("license") ?? "");
  const age21 = String(formData.get("age21") ?? "") === "1";

  const bound = bindPartnerDoor({ email, inviteCode, license, age21 });
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
