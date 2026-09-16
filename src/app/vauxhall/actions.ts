"use server";

import { readAdminRow } from "@/lib/gate";
import {
  checkpointAuditOffsite,
  evaluateShipPrecondition,
  ingestScanArtifact,
  persistAuditEvent,
  persistFindingDraft,
  persistMonitorRun,
  persistPreCheckRun,
  persistScannerIngest,
  readScheduleRows,
  runMonitorDry,
  runPreCheckServerDry,
  scheduledVerifyJobStub,
  seedMonitorSchedules,
  verifyRemoteAuditChain,
  type PersistClient,
} from "@/lib/vauxhall/plumbing";
import type { MonitorId } from "@/lib/vauxhall/types";
import { MONITOR_IDS } from "@/lib/vauxhall/types";

async function adminClient(): Promise<{ client: PersistClient; actor: string } | null> {
  try {
    const { supabase, user, admin } = await readAdminRow();
    if (!user || !admin) return null;
    return { client: supabase as unknown as PersistClient, actor: user.id };
  } catch {
    return null;
  }
}

function clockStamp(now = new Date()): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export async function refreshMonitorSchedulesAction() {
  const session = await adminClient();
  const remote = await readScheduleRows(session?.client ?? null);
  const schedules = remote ?? seedMonitorSchedules();
  return {
    ok: true as const,
    schedules,
    source: remote ? ("database" as const) : ("catalog" as const),
    note: remote ? "Schedules read from monitor_schedules. No probe fired." : "Schedules read from the catalog seed. No probe fired.",
  };
}

export async function runMonitorDryAction(monitorId: MonitorId, origin: "schedule" | "owner" = "owner") {
  if (!(MONITOR_IDS as readonly string[]).includes(monitorId)) {
    return { ok: false as const, reason: "Unknown monitor." };
  }
  const at = clockStamp();
  const day = "2026-09-16";
  const record = runMonitorDry(monitorId, origin, at, day);
  const session = await adminClient();
  const runWrite = await persistMonitorRun(
    session?.client ?? null,
    { id: `run-dry-${monitorId}`, ...record.run },
    origin,
  );
  const draftWrite = await persistFindingDraft(session?.client ?? null, {
    id: `draft-${monitorId}`,
    ...record.draft,
  });
  if (session) {
    await persistAuditEvent(session.client, {
      actor: session.actor,
      action: "monitor.dry_run",
      target: monitorId,
      note: record.run.note,
    });
  }
  return {
    ok: true as const,
    record,
    persisted: runWrite.persisted && draftWrite.persisted,
    note: runWrite.persisted ? runWrite.note : runWrite.note,
  };
}

export async function runPreCheckServerAction(candidate: string, input: { metrcStale: boolean; claimsLintCleared: boolean }) {
  const result = runPreCheckServerDry({
    candidate,
    metrcStale: input.metrcStale,
    claimsLintCleared: input.claimsLintCleared,
  });
  const session = await adminClient();
  const write = await persistPreCheckRun(session?.client ?? null, result);
  if (session) {
    await persistAuditEvent(session.client, {
      actor: session.actor,
      action: "precheck.server_dry_run",
      target: candidate,
      note: result.verdict,
    });
  }
  return { ok: true as const, result, persisted: write.persisted, note: write.note };
}

export async function ingestScannerAction(payload: unknown) {
  const openedOn = "2026-09-16";
  const ingested = ingestScanArtifact(payload, openedOn);
  const session = await adminClient();
  let persisted = false;
  if (session) {
    for (const item of ingested.items) {
      const write = await persistScannerIngest(session.client, item, (payload as Record<string, unknown>) ?? {});
      persisted = write.persisted;
    }
    for (const draft of ingested.drafts) {
      await persistFindingDraft(session.client, { id: "draft-scan", ...draft });
    }
    await persistAuditEvent(session.client, {
      actor: session.actor,
      action: "scanner.ingest",
      target: "dependency-secret",
      note: "CI scan mapped into findings drafts. Merge block stays off.",
    });
  }
  return {
    ok: true as const,
    ingested,
    persisted,
    note: persisted ? "Scanner ingest recorded." : "Recorded in the store. Database write skipped.",
  };
}

export async function verifyProductionAuditAction() {
  const session = await adminClient();
  const remote = await verifyRemoteAuditChain(session?.client ?? null);
  const local = scheduledVerifyJobStub([]);
  const checkpoint = checkpointAuditOffsite();
  return {
    ok: remote.ok && local.result.ok,
    remote,
    local,
    checkpoint,
    note: remote.note,
  };
}

export async function shipPreconditionAction(input: {
  candidate: string;
  preCheckGreen: boolean;
  monitorsGreen: boolean;
  metrcSyncGreen: boolean;
}) {
  return evaluateShipPrecondition(input);
}
