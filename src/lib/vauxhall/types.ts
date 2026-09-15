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
