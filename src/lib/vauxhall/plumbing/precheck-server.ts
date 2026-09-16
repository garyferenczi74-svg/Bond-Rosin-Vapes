import type { PreCheckResult } from "../types.ts";
import { PHASE_B_EXECUTION_MODE, PHASE_B_HARD_SHIP_GATE } from "./flags.ts";

export type PreCheckServerInput = {
  candidate: string;
  metrcStale: boolean;
  claimsLintCleared: boolean;
};

export type PreCheckServerRun = PreCheckResult & {
  mode: typeof PHASE_B_EXECUTION_MODE;
  metrcSource: "trace-mock";
  liveEnabled: false;
};

export function runPreCheckServerDry(input: PreCheckServerInput): PreCheckServerRun {
  const reasons: string[] = [];
  let verdict: PreCheckResult["verdict"] = "green";

  if (input.metrcStale) {
    verdict = "blocked";
    reasons.push("Metrc sync stale beyond two cycles. Rule: Metrc sync health. Trace mock only.");
  }
  if (input.candidate === "rc-118" && !input.claimsLintCleared) {
    verdict = "blocked";
    reasons.push("Seeded violation: claims lint on prototype copy. Rule: Claims-language lint.");
  }
  if (verdict === "green") {
    reasons.push("headers", "CSP", "age gate", "claims lint", "dash lint", "Metrc sync fresh");
  }

  return {
    id: `pc-server-${input.candidate}`,
    candidate: input.candidate,
    verdict,
    reasons,
    mode: PHASE_B_EXECUTION_MODE,
    metrcSource: "trace-mock",
    liveEnabled: false,
  };
}

export const M_SHIP_PRECONDITION_TEXT =
  "M ship precondition. Advisory until M enablement. Pre-Check green. Monitors green. Metrc sync green at ship time.";

export type ShipPrecondition = {
  candidate: string;
  preCheckGreen: boolean;
  monitorsGreen: boolean;
  metrcSyncGreen: boolean;
  ready: boolean;
  advisory: true;
  hardGate: false;
  missing: string[];
  text: string;
};

export function evaluateShipPrecondition(input: {
  candidate: string;
  preCheckGreen: boolean;
  monitorsGreen: boolean;
  metrcSyncGreen: boolean;
}): ShipPrecondition {
  const missing: string[] = [];
  if (!input.preCheckGreen) missing.push("Pre-Check");
  if (!input.monitorsGreen) missing.push("Monitors");
  if (!input.metrcSyncGreen) missing.push("Metrc sync");
  return {
    candidate: input.candidate,
    preCheckGreen: input.preCheckGreen,
    monitorsGreen: input.monitorsGreen,
    metrcSyncGreen: input.metrcSyncGreen,
    ready: missing.length === 0,
    advisory: true,
    hardGate: PHASE_B_HARD_SHIP_GATE,
    missing,
    text: M_SHIP_PRECONDITION_TEXT,
  };
}
