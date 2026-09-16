import type { Finding, MonitorId, MonitorRun, MonitorState } from "../types.ts";
import { failSeverityFor } from "../monitors.ts";
import { PHASE_B_EXECUTION_MODE, PHASE_B_LIVE_ENABLED, PHASE_B_PAGING_ENABLED } from "./flags.ts";
import { probeContractFor } from "./probes.ts";
import { scheduleById, type MonitorSchedule } from "./schedules.ts";

export type MonitorRunOrigin = "schedule" | "owner";

export type DryRunRecord = {
  run: Omit<MonitorRun, "id">;
  draft: Omit<Finding, "id">;
  mode: typeof PHASE_B_EXECUTION_MODE;
  liveEnabled: false;
  paged: false;
  autoAction: false;
  probeExecuted: false;
};

export type MonitorJobStub = {
  monitorId: MonitorId;
  mode: typeof PHASE_B_EXECUTION_MODE;
  liveEnabled: false;
  note: string;
};

export function monitorJobStubs(ids: readonly MonitorId[]): MonitorJobStub[] {
  return ids.map((monitorId) => ({
    monitorId,
    mode: PHASE_B_EXECUTION_MODE,
    liveEnabled: PHASE_B_LIVE_ENABLED,
    note: "Queued job placeholder. Dry-run. No external synthetic.",
  }));
}

export function runMonitorDry(
  id: MonitorId,
  origin: MonitorRunOrigin,
  at: string,
  openedOn: string,
  schedules?: MonitorSchedule[],
): DryRunRecord {
  const schedule = scheduleById(id, schedules);
  const name = schedule?.name ?? id;
  const citation = schedule?.citation ?? "Fourteen-monitor catalog.";
  const severity = schedule?.failSeverity ?? failSeverityFor(id);
  const contract = probeContractFor(id);
  const state: MonitorState = "green";
  const note = contract
    ? `Dry-run. ${contract.regions.join(" and ")} probe contract held. No production call.`
    : `Dry-run. ${name} recorded without an external side effect.`;

  return {
    run: {
      monitorId: id,
      at,
      state,
      note: `${note} Origin ${origin}.`,
    },
    draft: {
      severity,
      source: "dry-run MonitorRunner",
      surface: "Security Monitors",
      citation,
      owner: "Felix",
      due: openedOn,
      cite: `${name} dry-run recorded a findings draft. Live OFF.`,
      remediate: "No credential revoke. No form throttle. No source block.",
      document: "Dry-run draft. Same shape as a live finding. Not opened on the live scorecard.",
      state: "open",
      closedEvidence: "",
      openedOn,
      escape: false,
      monitorId: id,
    },
    mode: PHASE_B_EXECUTION_MODE,
    liveEnabled: PHASE_B_LIVE_ENABLED,
    paged: PHASE_B_PAGING_ENABLED,
    autoAction: false,
    probeExecuted: false,
  };
}

export function runAllMonitorsDry(
  ids: readonly MonitorId[],
  at: string,
  openedOn: string,
  schedules?: MonitorSchedule[],
): DryRunRecord[] {
  return ids.map((id) => runMonitorDry(id, "schedule", at, openedOn, schedules));
}
