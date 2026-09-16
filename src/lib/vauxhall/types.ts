import type { TraceTestStatus } from "./trace.ts";

export const AGENTS = ["JB", "Q", "Moneypenny", "Vesper", "M", "Felix", "Carver"] as const;
export type AgentName = (typeof AGENTS)[number];

export const EVENT_TYPES = [
  "Ingestion",
  "Knowledge",
  "Update",
  "Agent Decision",
  "Self-Tune",
  "Evolution",
  "Report",
  "Advisor",
  "Insight",
  "Interaction",
  "Alert",
  "Population",
  "Trend",
  "Error",
  "Escalation",
  "Research Task",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const TYPE_PILLS = [
  "Agent Decision",
  "Advisor",
  "Alert",
  "Self-Tune",
  "Research Task",
  "Report",
] as const;

export type AgentEvent = {
  id: string;
  time: string;
  agent: AgentName;
  type: EventType;
  summary: string;
  sub: string;
  audit: string;
};

export type ReviewState = "open" | "approved" | "rejected" | "sent back";

export type ReviewItem = {
  id: string;
  agent: AgentName;
  title: string;
  evidence: string;
  endorse: string;
  state: ReviewState;
};

export type ReleaseCandidate = {
  id: string;
  title: string;
  stage: number;
  note: string;
};

export type SocialDraft = {
  id: string;
  title: string;
  kind: string;
  blocker: string;
};

export type TuningState = "proposed" | "applied" | "rejected";

export type TuningProposal = {
  id: string;
  agent: AgentName;
  proposal: string;
  before: string;
  after: string;
  trigger: string;
  state: TuningState;
};

export type CanonDoc = {
  id: string;
  name: string;
  ver: string;
  body: string;
  prior: string;
};

export type AgentStatus = "Active" | "Verifying" | "Blocked";

export type AgentSummary = {
  name: AgentName;
  status: AgentStatus;
  task: string;
  blocker: string;
  events: AgentEvent[];
  errors: number;
  recs: number;
};

export type StoreFilter = {
  agent: AgentName | null;
  type: EventType | null;
  allData: boolean;
};

export type QueueSnapshot = {
  rcs: ReleaseCandidate[];
  drafts: SocialDraft[];
};

export const SKU_LIFECYCLES = ["active", "hold", "retired"] as const;
export type SkuLifecycle = (typeof SKU_LIFECYCLES)[number];

export type Sku = {
  id: string;
  number: string;
  editionName: string;
  moment: string;
  triad: string;
  bondLine: string;
  accentToken: string;
  hex: string;
  formats: string[];
  productTruth: string;
  lifecycle: SkuLifecycle;
  batchNote: string;
};

export type CollectionFrame = {
  name: string;
  line: string;
  close: string;
};

export type SkuMetrics = {
  active: number;
  formats: number;
  lifecycle: Partial<Record<SkuLifecycle, number>>;
};

export const ORDER_STAGES = [
  "draft",
  "confirmed",
  "in fulfillment",
  "shipped",
  "delivered",
  "paid",
] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];

export const RUN_STAGES = ["fresh frozen", "washed", "pressed", "filled", "packaged", "ready"] as const;
export type RunStage = (typeof RUN_STAGES)[number];

export const LICENSE_STATES = ["active", "expiring", "expired"] as const;
export type LicenseState = (typeof LICENSE_STATES)[number];

export type InventoryLot = {
  id: string;
  skuId: string;
  batchLabel: string;
  metrcUid: string;
  testStatus: TraceTestStatus;
  onHand: number;
  reserved: number;
  location: string;
  packagedOn: string;
  agingDays: number;
  coaNote: string;
};

export type ProductionRun = {
  id: string;
  skuId: string;
  stage: RunStage;
  expectedYield: number;
  expectedCompletion: string;
  late: boolean;
  note: string;
};

export type WholesaleAccount = {
  id: string;
  name: string;
  license: string;
  licenseMark: string;
  facilityId: string;
  expiresOn: string;
  contact: string;
  terms: string;
  region: string;
  velocity: number;
  notes: string;
  receivableDays: number;
};

export type OrderLine = {
  skuId: string;
  format: string;
  qty: number;
  batchLabel: string;
  lotId?: string;
  metrcUid?: string;
};

export type WholesaleOrder = {
  id: string;
  accountId: string;
  stage: OrderStage;
  promisedOn: string;
  late: boolean;
  manifestNumber: string;
  lines: OrderLine[];
  documents: string;
};

export type SkuEconomics = {
  skuId: string;
  mockCost: number;
  mockWholesale: number;
  mockSellIn: number;
  mockReorderPct: number;
  mockMtdUnits: number;
  mockPlanUnits: number;
};

export const ALERT_KINDS = [
  "low stock",
  "aging lot",
  "late run",
  "license expiry",
  "receivables",
  "felix flag",
  "low tags",
  "discrepancy",
  "late order",
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export type ProductAlert = {
  id: string;
  kind: AlertKind;
  title: string;
  detail: string;
  severity: "watch" | "action";
  href: string;
};

export type DiscrepancyRow = {
  lotId: string;
  uid: string;
  batchLabel: string;
  skuId: string;
  erpQty: number;
  metrcQty: number;
  variancePct: number;
  investigationId?: string;
};

export type DiscrepancyInvestigation = {
  id: string;
  lotId: string;
  uid: string;
  batchLabel: string;
  erpQty: number;
  metrcQty: number;
  variancePct: number;
  findingId: string;
  state: "open" | "resolved";
};

export type DashboardSnapshot = {
  openOrders: number;
  stageCounts: Partial<Record<OrderStage, number>>;
  unitsOnHand: { skuId: string; onHand: number; reserved: number; available: number }[];
  unitsInProcess: number;
  weekShipments: number;
  mtdUnits: number;
  planUnits: number;
  topAccounts: { id: string; name: string; velocity: number }[];
  stamp: string;
  syncStale: boolean;
};

export const FINDING_SEVERITIES = ["P0", "P1", "P2", "P3"] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export type FindingState = "open" | "closed";

export type Finding = {
  id: string;
  severity: FindingSeverity;
  source: string;
  surface: string;
  citation: string;
  owner: string;
  due: string;
  cite: string;
  remediate: string;
  document: string;
  state: FindingState;
  closedEvidence: string;
  openedOn: string;
  escape: boolean;
  monitorId?: string;
};

export type SecurityScorecard = {
  p0_30d: number;
  p1_30d: number;
  open: number;
  escapes_30d: number;
};

export type IncidentBeatKind = "detection" | "action" | "notification" | "resolution" | "root cause";

export type IncidentBeat = {
  at: string;
  kind: IncidentBeatKind;
  note: string;
};

export type Incident = {
  id: string;
  title: string;
  timeline: string;
  impact: string;
  actions: string;
  rootCause: string;
  findingId: string;
  beats?: IncidentBeat[];
  linkedFindingIds?: string[];
  rollbackStub?: string;
};

export const RULE_GROUPS = ["web security", "compliance", "platform", "agent conduct"] as const;
export type RuleGroup = (typeof RULE_GROUPS)[number];

export type SecurityRule = {
  id: string;
  name: string;
  citation: string;
  enforcement: string;
  gate: "pre-check" | "runtime" | "both";
  group?: RuleGroup;
  monitorIds?: string[];
  editable?: boolean;
};

export type Waiver = {
  id: string;
  findingId: string;
  expiresOn: string;
  control: string;
  state: "active" | "expired";
  ruleId?: string;
  scope?: string;
  ownerStamp?: string;
};

export type AuditRow = {
  id: string;
  time: string;
  actor: string;
  action: string;
  target: string;
  note: string;
  hash?: string;
  prevHash?: string;
};

export type DsarRequest = {
  id: string;
  subject: string;
  state: "intake" | "verify" | "fulfill" | "closed";
  clock: string;
  note: string;
};

export type Vendor = {
  id: string;
  name: string;
  scope: string;
  dpa: string;
  renewal: string;
};

export type ScannerItem = {
  id: string;
  source: string;
  note: string;
  findingId: string;
  lastSweep?: string;
};

export type PreCheckResult = {
  id: string;
  candidate: string;
  verdict: "green" | "blocked";
  reasons: string[];
};

export type Soc2Control = {
  id: string;
  control: string;
  evidence: string;
  family?: string;
  coverage?: number;
  sources?: string[];
};

export const MONITOR_IDS = [
  "site-liveness",
  "age-gate",
  "compliance-band",
  "robots-indexing",
  "security-headers",
  "tls-domain",
  "dependency-secret",
  "auth-watch",
  "rls-probe",
  "form-abuse",
  "metrc-sync",
  "content-lint",
  "audit-integrity",
  "agent-conduct",
] as const;
export type MonitorId = (typeof MONITOR_IDS)[number];

export type MonitorState = "green" | "degraded" | "failing";

export type MonitorRun = {
  id: string;
  monitorId: MonitorId;
  at: string;
  state: MonitorState;
  note: string;
  findingId?: string;
  incidentId?: string;
};

export type Monitor = {
  id: MonitorId;
  name: string;
  cadence: string;
  demoCadenceMs: number;
  lastRun: string;
  nextRun: string;
  nextDueMs: number;
  state: MonitorState;
  sparkline: number[];
  ruleId: string;
  citation: string;
  history: MonitorRun[];
};

export type AuditVerify = {
  ok: boolean;
  brokenAt?: string;
};

export type CloseFindingAttempt =
  | { ok: true; id: string }
  | { ok: false; reason: string };

export type RuleEditAttempt =
  | { ok: true; id: string }
  | { ok: false; reason: string };

export const SOCIAL_STAGES = ["draft", "felix", "owner", "approved", "held"] as const;
export type SocialStage = (typeof SOCIAL_STAGES)[number];

export type SocialPipelineItem = {
  id: string;
  title: string;
  kind: string;
  stage: SocialStage;
  desk: string;
  note: string;
  approved: boolean;
  auditFlags: string[];
};

export type SocialDeskStrip = {
  id: string;
  title: string;
  state: "LIVE" | "PARKED" | "HELD";
  line: string;
};

export type ResearchRow = {
  id: string;
  format: string;
  hook: string;
  remixFit: string;
  provenance: string;
  note: string;
};

export type ScriptVariation = {
  id: string;
  hook: string;
  caption: string;
  platform: string;
  provenance: string;
};

export type SocialMetric = {
  platform: string;
  posts: string;
  reach: string;
  note: string;
};

export type OrderAttempt =
  | { ok: true; id: string }
  | { ok: false; reason: string };

export type AccountAttempt =
  | { ok: true; id: string; verification: string }
  | { ok: false; reason: string };

export type StageAttempt =
  | { ok: true; stage: OrderStage }
  | { ok: false; reason: string };

export type ScheduleAttempt =
  | { ok: true; note: string }
  | { ok: false; reason: string; findingId?: string };
