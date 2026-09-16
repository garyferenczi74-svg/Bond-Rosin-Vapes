import { AUDIT_GENESIS, mockHash } from "../monitors.ts";
import type { AuditVerify } from "../types.ts";
import { PHASE_B_EXECUTION_MODE } from "./flags.ts";

export type PlumbingAuditEvent = {
  id: string;
  time: string;
  actor: string;
  action: string;
  target: string;
  note: string;
  prevHash: string;
  hash: string;
  mode: typeof PHASE_B_EXECUTION_MODE;
};

export type OffsiteCheckpoint = {
  ok: false;
  enabled: false;
  note: string;
};

export function hashAuditPayload(input: {
  prevHash: string;
  time: string;
  actor: string;
  action: string;
  target: string;
  note: string;
}): string {
  return mockHash(`${input.prevHash}|${input.time}|${input.actor}|${input.action}|${input.target}|${input.note}`);
}

export function appendAuditEvent(
  chain: PlumbingAuditEvent[],
  input: Omit<PlumbingAuditEvent, "id" | "hash" | "prevHash" | "mode"> & { id: string },
): PlumbingAuditEvent[] {
  const prev = chain[0]?.hash ?? AUDIT_GENESIS;
  const next: PlumbingAuditEvent = {
    ...input,
    prevHash: prev,
    hash: hashAuditPayload({
      prevHash: prev,
      time: input.time,
      actor: input.actor,
      action: input.action,
      target: input.target,
      note: input.note,
    }),
    mode: PHASE_B_EXECUTION_MODE,
  };
  return [next, ...chain];
}

export function verifyAuditEventChain(chain: PlumbingAuditEvent[]): AuditVerify {
  const chrono = [...chain].reverse();
  let prev = AUDIT_GENESIS;
  for (const row of chrono) {
    const expected = hashAuditPayload({
      prevHash: prev,
      time: row.time,
      actor: row.actor,
      action: row.action,
      target: row.target,
      note: row.note,
    });
    if (row.prevHash !== prev || row.hash !== expected || row.mode !== PHASE_B_EXECUTION_MODE) {
      return { ok: false, brokenAt: row.id };
    }
    prev = row.hash;
  }
  return { ok: true };
}

export function checkpointAuditOffsite(): OffsiteCheckpoint {
  return {
    ok: false,
    enabled: false,
    note: "Off-site checkpoint hook stub. No copy leaves the room.",
  };
}

export function scheduledVerifyJobStub(chain: PlumbingAuditEvent[]): {
  job: "verify_audit_chain";
  mode: typeof PHASE_B_EXECUTION_MODE;
  result: AuditVerify;
} {
  return {
    job: "verify_audit_chain",
    mode: PHASE_B_EXECUTION_MODE,
    result: verifyAuditEventChain(chain),
  };
}
