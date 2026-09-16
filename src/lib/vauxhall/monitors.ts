import type { FindingSeverity, Monitor, MonitorId, MonitorState } from "./types.ts";
import { MONITOR_IDS } from "./types.ts";

export { MONITOR_IDS };

export const AUDIT_GENESIS = "genesis";

export const MOCK_LINT_ELEMENT = ".lede";
export const MOCK_LINT_PAGE = "/faq";

export function dashChar(): string {
  return String.fromCharCode(0x2014);
}

export function mockLintPageCopy(): string {
  return `Bond mock ${MOCK_LINT_PAGE} ${MOCK_LINT_ELEMENT}: Nothing added${dashChar()}everything real.`;
}

export function mockHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function sparklineFromState(state: MonitorState): number {
  if (state === "green") return 1;
  if (state === "degraded") return 0.5;
  return 0;
}

type CatalogSeed = {
  id: MonitorId;
  name: string;
  cadence: string;
  demoCadenceMs: number;
  nextDueMs: number;
  ruleId: string;
  citation: string;
  failSeverity: FindingSeverity;
};

export const MONITOR_CATALOG: CatalogSeed[] = [
  {
    id: "site-liveness",
    name: "Site liveness",
    cadence: "every 2 minutes",
    demoCadenceMs: 2000,
    nextDueMs: 2000,
    ruleId: "rule-liveness",
    citation: "Public site answers from two regions.",
    failSeverity: "P1",
  },
  {
    id: "age-gate",
    name: "Age gate integrity",
    cadence: "every 15 minutes",
    demoCadenceMs: 4000,
    nextDueMs: 4000,
    ruleId: "rule-age",
    citation: "Synthetic visitor confirms gate before content.",
    failSeverity: "P0",
  },
  {
    id: "compliance-band",
    name: "Compliance band presence",
    cadence: "hourly",
    demoCadenceMs: 6000,
    nextDueMs: 6000,
    ruleId: "rule-claims",
    citation: "Required warning text, rotating slot, license line.",
    failSeverity: "P1",
  },
  {
    id: "robots-indexing",
    name: "Robots and indexing state",
    cadence: "hourly",
    demoCadenceMs: 6000,
    nextDueMs: 6000,
    ruleId: "rule-robots",
    citation: "Flag matches launch decision.",
    failSeverity: "P1",
  },
  {
    id: "security-headers",
    name: "Security headers and CSP",
    cadence: "hourly",
    demoCadenceMs: 6000,
    nextDueMs: 6000,
    ruleId: "rule-headers",
    citation: "Response headers match the ruleset.",
    failSeverity: "P1",
  },
  {
    id: "tls-domain",
    name: "TLS and domain",
    cadence: "daily",
    demoCadenceMs: 8000,
    nextDueMs: 8000,
    ruleId: "rule-tls",
    citation: "Certificate validity, DNS integrity, renewal horizon.",
    failSeverity: "P1",
  },
  {
    id: "dependency-secret",
    name: "Dependency and secret scan",
    cadence: "every commit and nightly",
    demoCadenceMs: 8000,
    nextDueMs: 2000,
    ruleId: "rule-deps",
    citation: "CVE sweep and secret patterns.",
    failSeverity: "P0",
  },
  {
    id: "auth-watch",
    name: "Auth watch",
    cadence: "streaming",
    demoCadenceMs: 2000,
    nextDueMs: 2000,
    ruleId: "rule-auth",
    citation: "Lockouts, failure bursts, impossible travel on /haus.",
    failSeverity: "P0",
  },
  {
    id: "rls-probe",
    name: "RLS probe",
    cadence: "hourly",
    demoCadenceMs: 6000,
    nextDueMs: 6000,
    ruleId: "rule-rls",
    citation: "Anonymous synthetic attempts protected tables.",
    failSeverity: "P0",
  },
  {
    id: "form-abuse",
    name: "Form abuse",
    cadence: "streaming",
    demoCadenceMs: 2000,
    nextDueMs: 2000,
    ruleId: "rule-forms",
    citation: "Bond Circle signup velocity and disposable domains.",
    failSeverity: "P2",
  },
  {
    id: "metrc-sync",
    name: "Metrc sync health",
    cadence: "every 15 minutes",
    demoCadenceMs: 4000,
    nextDueMs: 4000,
    ruleId: "rule-metrc",
    citation: "Trace staleness, error rates, open discrepancies.",
    failSeverity: "P1",
  },
  {
    id: "content-lint",
    name: "Content lint sweep",
    cadence: "every deploy and nightly",
    demoCadenceMs: 8000,
    nextDueMs: 2000,
    ruleId: "rule-dash",
    citation: "Deployed pages for dash characters, forbidden vocabulary, claims.",
    failSeverity: "P2",
  },
  {
    id: "audit-integrity",
    name: "Audit log integrity",
    cadence: "hourly",
    demoCadenceMs: 6000,
    nextDueMs: 6000,
    ruleId: "rule-audit",
    citation: "Append-only hash chain verifies.",
    failSeverity: "P0",
  },
  {
    id: "agent-conduct",
    name: "Agent conduct",
    cadence: "streaming",
    demoCadenceMs: 2000,
    nextDueMs: 2000,
    ruleId: "rule-agents",
    citation: "Enforcement set from the Rules room.",
    failSeverity: "P1",
  },
];

export function failSeverityFor(id: MonitorId): FindingSeverity {
  return MONITOR_CATALOG.find((item) => item.id === id)?.failSeverity ?? "P2";
}

export function seedMonitors(lastRun = "14:20:00"): Monitor[] {
  assertFourteenMonitors(MONITOR_CATALOG.map((item) => item.id));
  return MONITOR_CATALOG.map((item) => ({
    id: item.id,
    name: item.name,
    cadence: item.cadence,
    demoCadenceMs: item.demoCadenceMs,
    lastRun,
    nextRun: lastRun,
    nextDueMs: item.nextDueMs,
    state: "green",
    sparkline: Array.from({ length: 24 }, () => 1),
    ruleId: item.ruleId,
    citation: item.citation,
    history: [],
  }));
}

export function pushSpark(sparkline: number[], state: MonitorState): number[] {
  const next = sparkline.slice(-23);
  next.push(sparklineFromState(state));
  return next;
}

export function assertFourteenMonitors(ids: string[]): void {
  if (ids.length !== MONITOR_IDS.length) {
    throw new Error("Monitor catalog must stay at fourteen.");
  }
}
