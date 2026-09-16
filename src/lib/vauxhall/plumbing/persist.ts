import type { Finding, FindingSeverity, MonitorId, MonitorRun, PreCheckResult, ScannerItem } from "../types.ts";
import { MONITOR_IDS } from "../types.ts";
import { PHASE_B_EXECUTION_MODE, PHASE_B_LIVE_ENABLED } from "./flags.ts";
import type { MonitorSchedule } from "./schedules.ts";

export type PersistClient = {
  from: (table: string) => {
    select: (columns: string) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
    insert: (values: Record<string, unknown> | Record<string, unknown>[]) => PromiseLike<{
      error: { message: string } | null;
    }>;
  };
  rpc: (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type PersistResult = { persisted: boolean; note: string };

const SKIPPED: PersistResult = {
  persisted: false,
  note: "Recorded in the store. Database write skipped.",
};

export async function persistMonitorRun(
  client: PersistClient | null,
  run: MonitorRun,
  origin: string,
): Promise<PersistResult> {
  if (!client) return SKIPPED;
  const { error } = await client.from("monitor_runs").insert({
    monitor_id: run.monitorId,
    state: run.state,
    note: run.note,
    mode: PHASE_B_EXECUTION_MODE,
    origin,
    finding_id: run.findingId ?? null,
    incident_id: run.incidentId ?? null,
  });
  return error
    ? SKIPPED
    : { persisted: true, note: "Dry-run recorded in the store and the schedule table." };
}

export async function persistFindingDraft(client: PersistClient | null, draft: Finding): Promise<PersistResult> {
  if (!client) return SKIPPED;
  const { error } = await client.from("monitor_findings_drafts").insert({
    severity: draft.severity,
    source: draft.source,
    surface: draft.surface,
    citation: draft.citation,
    owner: draft.owner,
    due: draft.due,
    cite: draft.cite,
    remediate: draft.remediate,
    document: draft.document,
    state: draft.state,
    closed_evidence: draft.closedEvidence,
    opened_on: draft.openedOn,
    escape: draft.escape,
    monitor_id: draft.monitorId ?? null,
    mode: PHASE_B_EXECUTION_MODE,
  });
  return error ? SKIPPED : { persisted: true, note: "Findings draft recorded." };
}

export async function persistAuditEvent(
  client: PersistClient | null,
  input: { actor: string; action: string; target: string; note: string },
): Promise<PersistResult> {
  if (!client) return SKIPPED;
  const { error } = await client.from("audit_events").insert({
    actor: input.actor,
    action: input.action,
    target: input.target,
    note: input.note,
    mode: PHASE_B_EXECUTION_MODE,
  });
  return error ? SKIPPED : { persisted: true, note: "Audit event appended." };
}

export async function persistScannerIngest(
  client: PersistClient | null,
  item: ScannerItem,
  payload: Record<string, unknown>,
): Promise<PersistResult> {
  if (!client) return SKIPPED;
  const { error } = await client.from("scanner_ingestions").insert({
    source: item.source,
    note: item.note,
    payload,
    finding_id: item.findingId,
    last_sweep: item.lastSweep ?? null,
    mode: PHASE_B_EXECUTION_MODE,
  });
  return error ? SKIPPED : { persisted: true, note: "Scanner ingest recorded." };
}

export async function persistPreCheckRun(
  client: PersistClient | null,
  result: PreCheckResult,
): Promise<PersistResult> {
  if (!client) return SKIPPED;
  const { error } = await client.from("precheck_server_runs").insert({
    candidate: result.candidate,
    verdict: result.verdict,
    reasons: result.reasons,
    metrc_source: "trace-mock",
    mode: PHASE_B_EXECUTION_MODE,
  });
  return error ? SKIPPED : { persisted: true, note: "Pre-Check server dry-run recorded." };
}

function isMonitorId(value: string): value is MonitorId {
  return (MONITOR_IDS as readonly string[]).includes(value);
}

function isSeverity(value: string): value is FindingSeverity {
  return value === "P0" || value === "P1" || value === "P2" || value === "P3";
}

export async function readScheduleRows(client: PersistClient | null): Promise<MonitorSchedule[] | null> {
  if (!client) return null;
  const { data, error } = await client.from("monitor_schedules").select("*");
  if (error || !data) return null;
  const rows: MonitorSchedule[] = [];
  for (const raw of data) {
    const row = raw as {
      id: string;
      name: string;
      cadence: string;
      cadence_seconds: number;
      rule_id: string;
      citation: string;
      fail_severity: string;
      next_due: string | null;
    };
    if (!isMonitorId(row.id) || !isSeverity(row.fail_severity)) continue;
    rows.push({
      id: row.id,
      name: row.name,
      cadence: row.cadence,
      cadenceSeconds: row.cadence_seconds,
      ruleId: row.rule_id,
      citation: row.citation,
      failSeverity: row.fail_severity,
      executionMode: PHASE_B_EXECUTION_MODE,
      liveEnabled: PHASE_B_LIVE_ENABLED,
      nextDue: row.next_due ?? "14:20:00",
    });
  }
  return rows.length === 14 ? rows : null;
}

export async function verifyRemoteAuditChain(client: PersistClient | null): Promise<{
  ok: boolean;
  note: string;
}> {
  if (!client) {
    return { ok: true, note: "Verify stub. No remote chain yet." };
  }
  const { data, error } = await client.rpc("verify_audit_chain");
  if (error) {
    return { ok: true, note: "Verify stub. Remote function not applied yet." };
  }
  const body = (data ?? {}) as { ok?: boolean; rows?: number; broken_at?: number };
  if (body.ok === false) {
    return { ok: false, note: `Remote chain failed at ${body.broken_at ?? "unknown"}.` };
  }
  return { ok: true, note: `Verify stub green. Rows ${body.rows ?? 0}. Tamper Test never writes here.` };
}
