import type { MonitorId } from "../types.ts";
import { PHASE_B_LIVE_ENABLED } from "./flags.ts";

export const PROBE_REGIONS = ["iad1", "sfo1"] as const;
export type ProbeRegion = (typeof PROBE_REGIONS)[number];

export type SyntheticProbeContract = {
  monitorId: MonitorId;
  name: string;
  path: string;
  regions: readonly ProbeRegion[];
  expectedStatus: number;
  liveEnabled: false;
  note: string;
};

export type ProbeResult = {
  region: ProbeRegion;
  ok: boolean;
  status: number;
  note: string;
  executed: false;
};

export interface SyntheticProbeAdapter {
  execute(contract: SyntheticProbeContract, region: ProbeRegion): Promise<ProbeResult>;
}

export const TWO_REGION_PROBE_CONTRACTS: SyntheticProbeContract[] = [
  {
    monitorId: "site-liveness",
    name: "Site liveness",
    path: "/",
    regions: PROBE_REGIONS,
    expectedStatus: 200,
    liveEnabled: PHASE_B_LIVE_ENABLED,
    note: "Contract only. No live probe against production.",
  },
  {
    monitorId: "age-gate",
    name: "Age gate integrity",
    path: "/AgeGate",
    regions: PROBE_REGIONS,
    expectedStatus: 200,
    liveEnabled: PHASE_B_LIVE_ENABLED,
    note: "Contract only. No live probe against production.",
  },
  {
    monitorId: "rls-probe",
    name: "RLS probe",
    path: "/haus",
    regions: PROBE_REGIONS,
    expectedStatus: 200,
    liveEnabled: PHASE_B_LIVE_ENABLED,
    note: "Contract only. Anonymous synthetic stays parked.",
  },
];

export class DryRunProbeAdapter implements SyntheticProbeAdapter {
  async execute(contract: SyntheticProbeContract, region: ProbeRegion): Promise<ProbeResult> {
    return {
      region,
      ok: true,
      status: contract.expectedStatus,
      note: "Dry-run. Probe not dispatched.",
      executed: false,
    };
  }
}

export function probeContractFor(id: MonitorId): SyntheticProbeContract | undefined {
  return TWO_REGION_PROBE_CONTRACTS.find((item) => item.monitorId === id);
}
