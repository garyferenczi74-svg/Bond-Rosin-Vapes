"use server";

import { readAdminRow } from "@/lib/gate";
import { MetrcConnectAdapter } from "@/lib/vauxhall/metrc-connect";
import { isMetrcConnectEnabled } from "@/lib/vauxhall/metrc-flags";
import { payloadHasForbiddenNotes, regulatoryTransferFields } from "@/lib/vauxhall/metrc-payload";
import type { TraceSnapshot, TraceTransferAttempt, TraceTransferDraftInput } from "@/lib/vauxhall/trace";

function fail(reason: string) {
  return { ok: false as const, reason };
}

async function requireOpsActor(): Promise<{ ok: true; actor: string } | { ok: false; reason: string }> {
  try {
    const { user, admin } = await readAdminRow();
    if (!user || !admin) return fail("Operator session required.");
    return { ok: true, actor: user.id };
  } catch {
    return fail("Operator session required.");
  }
}

export async function readMetrcAdapterModeAction() {
  return { ok: true as const, mode: isMetrcConnectEnabled() ? ("connect" as const) : ("mock" as const) };
}

export async function refreshTraceAction(): Promise<
  { ok: true; snapshot: TraceSnapshot } | { ok: false; reason: string }
> {
  const session = await requireOpsActor();
  if (!session.ok) return session;
  if (!isMetrcConnectEnabled()) {
    return fail("Connect adapter is off. METRC_ADAPTER=connect is preview only.");
  }
  const adapter = new MetrcConnectAdapter();
  const snapshot = await adapter.refreshAll();
  return { ok: true, snapshot };
}

export async function createTransferDraftAction(input: {
  orderId: string;
  fromFacilityId: string;
  toFacilityId: string;
  destinationLicense?: string;
  operatorConfirmed: boolean;
  packages?: Array<{ label: string; quantity: number }>;
}): Promise<TraceTransferAttempt> {
  const session = await requireOpsActor();
  if (!session.ok) return session;
  if (!isMetrcConnectEnabled()) {
    return fail("Connect adapter is off. METRC_ADAPTER=connect is preview only.");
  }
  if (input.operatorConfirmed !== true) {
    return fail("Confirm required: operator must confirm this Metrc transfer draft.");
  }
  if (payloadHasForbiddenNotes(input)) {
    return fail("Transfer payload rejected: free-text notes are not allowed.");
  }
  const draft: TraceTransferDraftInput = {
    orderId: input.orderId,
    fromFacilityId: input.fromFacilityId,
    toFacilityId: input.toFacilityId,
    destinationLicense: input.destinationLicense,
    operatorConfirmed: true,
    packages: input.packages,
  };
  const fields = regulatoryTransferFields(draft);
  if (payloadHasForbiddenNotes(fields)) {
    return fail("Transfer payload rejected: free-text notes are not allowed.");
  }
  const adapter = new MetrcConnectAdapter();
  return adapter.createTransferDraft(draft);
}
