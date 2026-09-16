import { MONITOR_CATALOG } from "../monitors.ts";
import type { FindingSeverity, MonitorId } from "../types.ts";
import { MONITOR_IDS } from "../types.ts";
import { PHASE_B_EXECUTION_MODE, PHASE_B_LIVE_ENABLED } from "./flags.ts";

export type MonitorSchedule = {
  id: MonitorId;
  name: string;
  cadence: string;
  cadenceSeconds: number;
  ruleId: string;
  citation: string;
  failSeverity: FindingSeverity;
  executionMode: typeof PHASE_B_EXECUTION_MODE;
  liveEnabled: false;
  nextDue: string;
};

const CADENCE_SECONDS: Record<string, number> = {
  "every 2 minutes": 120,
  "every 15 minutes": 900,
  hourly: 3600,
  daily: 86400,
  "every commit and nightly": 86400,
  streaming: 0,
  "every deploy and nightly": 86400,
};

export function cadenceSecondsFor(cadence: string): number {
  return CADENCE_SECONDS[cadence] ?? 3600;
}

export function seedMonitorSchedules(nextDue = "14:20:00"): MonitorSchedule[] {
  const rows = MONITOR_CATALOG.map((item) => ({
    id: item.id,
    name: item.name,
    cadence: item.cadence,
    cadenceSeconds: cadenceSecondsFor(item.cadence),
    ruleId: item.ruleId,
    citation: item.citation,
    failSeverity: item.failSeverity,
    executionMode: PHASE_B_EXECUTION_MODE,
    liveEnabled: false as const,
    nextDue,
  }));
  if (rows.length !== MONITOR_IDS.length) {
    throw new Error("Monitor schedules must stay at fourteen.");
  }
  return rows;
}

export function scheduleById(id: MonitorId, rows = seedMonitorSchedules()): MonitorSchedule | undefined {
  return rows.find((item) => item.id === id);
}
