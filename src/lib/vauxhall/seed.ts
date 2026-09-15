import { SKU_ACCENTS } from "../tokens.ts";
import type {
  AgentEvent,
  CanonDoc,
  CollectionFrame,
  ReleaseCandidate,
  ReviewItem,
  Sku,
  SocialDraft,
  TuningProposal,
} from "./types.ts";

const PRODUCT_TRUTH =
  "100% solventless live rosin from fresh-frozen cannabis. Nothing added. Nothing in the way.";
const BATCH_NOTE = "No lots recorded. No COA on file.";

export const NUMBERED_COLLECTION: CollectionFrame = {
  name: "The Numbered Collection",
  line: "Choose your moment.",
  close: "When the product is pure, the experience is real.",
};

export const SEED_SKUS: Sku[] = [
  {
    id: "no-1",
    number: "No. 1",
    editionName: "Dialed",
    moment: "Daytime",
    triad: "Focus. Clarity. Momentum.",
    bondLine: "your potential",
    accentToken: "No. 1",
    hex: SKU_ACCENTS["no-1"],
    formats: ["0.5g", "1g"],
    productTruth: PRODUCT_TRUTH,
    lifecycle: "active",
    batchNote: BATCH_NOTE,
  },
  {
    id: "no-2",
    number: "No. 2",
    editionName: "Unwind",
    moment: "Nighttime",
    triad: "Release. Stillness. Restoration.",
    bondLine: "the moment",
    accentToken: "No. 2",
    hex: SKU_ACCENTS["no-2"],
    formats: ["0.5g", "1g"],
    productTruth: PRODUCT_TRUTH,
    lifecycle: "active",
    batchNote: BATCH_NOTE,
  },
  {
    id: "no-3",
    number: "No. 3",
    editionName: "Peak",
    moment: "Reserve",
    triad: "Edge. Elevation. Expansion.",
    bondLine: "your edge",
    accentToken: "No. 3",
    hex: SKU_ACCENTS["no-3"],
    formats: ["0.5g", "1g"],
    productTruth: PRODUCT_TRUTH,
    lifecycle: "active",
    batchNote: BATCH_NOTE,
  },
];

export const SEED_EVENTS: AgentEvent[] = [
  {
    id: "e10",
    time: "14:32:08",
    agent: "Felix",
    type: "Alert",
    summary: "Lockout raised on /haus/admin after 5 failed attempts from 74.12.x.x",
    sub: "Escalated to Security wing . source logged . audit id A-40912",
    audit: "A-40912",
  },
  {
    id: "e09",
    time: "14:29:51",
    agent: "JB",
    type: "Agent Decision",
    summary: "Endorsed Vesper verdict on release candidate rc-118, routed to M for gate",
    sub: "Recommendation awaiting owner in Review",
    audit: "A-40908",
  },
  {
    id: "e08",
    time: "14:27:14",
    agent: "Vesper",
    type: "Report",
    summary: "Verification pass on rc-118: age gate, claims lint, dash lint all green",
    sub: "1 warning noted, non-blocking",
    audit: "A-40905",
  },
  {
    id: "e07",
    time: "14:21:03",
    agent: "Q",
    type: "Research Task",
    summary: "Ingested 3 new solventless extraction studies into canon staging",
    sub: "Pending Moneypenny approval before canon merge",
    audit: "A-40902",
  },
  {
    id: "e06",
    time: "14:18:44",
    agent: "Moneypenny",
    type: "Knowledge",
    summary: "Canon version v41 published: prototype SKU three batch note revision",
    sub: "Approved by owner . prior version retained",
    audit: "A-40898",
  },
  {
    id: "e05",
    time: "14:12:37",
    agent: "Carver",
    type: "Escalation",
    summary: "Blocked: awaiting Felix clearance on 4 social drafts before scheduling",
    sub: "Blocker: originality check queued",
    audit: "A-40891",
  },
  {
    id: "e04",
    time: "14:05:19",
    agent: "M",
    type: "Self-Tune",
    summary: "Proposed tuning: raise pre-check strictness on dependency audit to high",
    sub: "Owner action required to apply . rollback available",
    audit: "A-40884",
  },
  {
    id: "e03",
    time: "13:58:02",
    agent: "Felix",
    type: "Advisor",
    summary: "Pre-Check passed on rc-117: headers, CSP, age gate integrity confirmed",
    sub: "Cleared to M gate . 0 open findings",
    audit: "A-40877",
  },
  {
    id: "e02",
    time: "13:44:55",
    agent: "Q",
    type: "Insight",
    summary: "Reorder rate for prototype SKU one trending up 12 percent week over week",
    sub: "Flagged to Product wing for velocity review",
    audit: "A-40869",
  },
  {
    id: "e01",
    time: "13:30:11",
    agent: "JB",
    type: "Report",
    summary: "Daily audit posted: 6 decisions, 0 anomalies, tomorrow plan set",
    sub: "Waiting in Review",
    audit: "A-40852",
  },
];

export const SEED_REVIEW: ReviewItem[] = [
  {
    id: "r1",
    agent: "M",
    title: "Raise pre-check strictness on dependency audit to high",
    evidence: "Self-Tune e04 . rollback available",
    endorse: "JB endorses: reduces dev-side escapes",
    state: "open",
  },
  {
    id: "r2",
    agent: "JB",
    title: "Endorsement of rc-118 awaiting owner",
    evidence: "Vesper report e08 . Felix advisor e03",
    endorse: "JB endorses: all gates green",
    state: "open",
  },
  {
    id: "r3",
    agent: "Q",
    title: "Canon staging ingestion of 3 extraction studies",
    evidence: "Research Task e07",
    endorse: "Moneypenny approval required before merge",
    state: "open",
  },
];

export const SEED_RCS: ReleaseCandidate[] = [
  {
    id: "rc-117",
    title: "Release candidate rc-117",
    stage: 2,
    note: "Cleared to M gate . 0 open findings",
  },
  {
    id: "rc-118",
    title: "Release candidate rc-118",
    stage: 3,
    note: "At owner review . 1 non-blocking warning",
  },
];

export const SEED_DRAFTS: SocialDraft[] = [
  {
    id: "d-207",
    title: "Nothing added, everything real",
    kind: "Reel",
    blocker: "Awaiting Felix originality check",
  },
  {
    id: "d-208",
    title: "The press, in 15 seconds",
    kind: "Short",
    blocker: "Awaiting Felix originality check",
  },
  {
    id: "d-209",
    title: "With your highest self",
    kind: "Carousel",
    blocker: "Awaiting Felix originality check",
  },
  {
    id: "d-210",
    title: "Find your number",
    kind: "Reel",
    blocker: "Awaiting Felix originality check",
  },
];

export const SEED_TUNING: TuningProposal[] = [
  {
    id: "t1",
    agent: "M",
    proposal: "Raise pre-check strictness on dependency audit to high",
    before: "Dependency audit runs at medium, warns on drift",
    after: "Dependency audit runs at high, blocks on drift",
    trigger: "2 minor version drifts caught late in the last 30 days",
    state: "proposed",
  },
];

export const SEED_CANON: CanonDoc[] = [
  {
    id: "brand-tokens",
    name: "prototype/brand-tokens",
    ver: "v3",
    body: "Locked palette and type. Matte Black #1B1D1C surfaces, Deep Charcoal #2A2A2A cards, Bone #E1DAD0 type. Gold gradient for the wordmark. GFS Didot for display, Aptos for UI. No em dashes anywhere.",
    prior: "v2: pre July 22 palette before the token lock.",
  },
  {
    id: "copy-bank",
    name: "prototype/copy-bank",
    ver: "v5",
    body: "Approved lines. With your highest self. What you consume matters. Nothing added, everything real. When the product is pure the experience is real.",
    prior: "v4: earlier hero lines before membership was unified under Haus.",
  },
  {
    id: "framer-build-spec",
    name: "prototype/framer-build-spec",
    ver: "v1",
    body: "Video first. Three Signature Moments. Film Day shot list. Source of truth after approved mockups. Where a document conflicts with a mockup, the mockup wins.",
    prior: "v0: outline before the shot list was added.",
  },
  {
    id: "build-prompt-v1-2",
    name: "prototype/build-prompt-v1-2",
    ver: "v2",
    body: "Landing structure, copy, backend, motion workflow. The Next.js layer is reserved for Bond Haus and Vauxhall.",
    prior: "v1: before the Next.js reservation note.",
  },
  {
    id: "brand-guidelines-v1-1",
    name: "prototype/brand-guidelines-v1-1",
    ver: "v1",
    body: "Retrofitted to the July 22 token lock. Voice, spacing, logo usage, and Haus as the single membership name stated once so nothing drifts.",
    prior: "v0: draft before the token retrofit.",
  },
  {
    id: "tokens-sheet",
    name: "prototype/tokens-sheet",
    ver: "v3",
    body: "One page token sheet for fast agent briefing. Mirrored into brand-tokens. Colors, type scale, spacing, motion timings.",
    prior: "v2: before the motion timings row.",
  },
];

export const EVENT_POOL: Omit<AgentEvent, "id" | "time" | "audit">[] = [
  {
    agent: "Q",
    type: "Research Task",
    summary: "Scanned 2 new terpene preservation papers for canon staging",
    sub: "Pending Moneypenny approval before canon merge",
  },
  {
    agent: "Vesper",
    type: "Report",
    summary: "Verification sweep clean on preview surfaces",
    sub: "Age gate, claims lint, dash lint all green",
  },
  {
    agent: "Felix",
    type: "Advisor",
    summary: "Rule check complete: no new findings on the current build",
    sub: "0 open findings . scorecard holds",
  },
  {
    agent: "Carver",
    type: "Insight",
    summary: "Process reveal hook holding the top of the league table",
    sub: "Flagged for the next concept round",
  },
  {
    agent: "JB",
    type: "Agent Decision",
    summary: "Routed a velocity insight to the Product wing",
    sub: "Awaiting owner acknowledgement",
  },
  {
    agent: "M",
    type: "Report",
    summary: "Pre-Check green on the latest candidate",
    sub: "Cleared to gate . rollback point set",
  },
  {
    agent: "Moneypenny",
    type: "Knowledge",
    summary: "Canon search index refreshed",
    sub: "6 documents, version history intact",
  },
  {
    agent: "Q",
    type: "Trend",
    summary: "Reorder signal steady on prototype SKU two",
    sub: "Mock velocity only. No SKU spec attached.",
  },
];
