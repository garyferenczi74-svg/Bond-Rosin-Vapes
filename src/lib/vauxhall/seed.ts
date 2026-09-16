import { SKU_ACCENTS } from "../tokens.ts";
import type {
  AgentEvent,
  AuditRow,
  CanonDoc,
  CollectionFrame,
  DsarRequest,
  Finding,
  Incident,
  InventoryLot,
  PreCheckResult,
  ProductionRun,
  ReleaseCandidate,
  ResearchRow,
  ReviewItem,
  ScannerItem,
  ScriptVariation,
  SecurityRule,
  Sku,
  SkuEconomics,
  Soc2Control,
  SocialDeskStrip,
  SocialDraft,
  SocialMetric,
  SocialPipelineItem,
  TuningProposal,
  Vendor,
  Waiver,
  WholesaleAccount,
  WholesaleOrder,
  DiscrepancyInvestigation,
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
  {
    id: "e00",
    time: "14:36:02",
    agent: "Felix",
    type: "Alert",
    summary: "Discrepancy beyond 2 percent on MOCK-LOT-P1",
    sub: "ERP 22 versus Metrc 16. Felix finding opened. Mock Trace.",
    audit: "A-40920",
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

export const SEED_CLOCK = "2026-09-15";
export const MOCK_COA_NOTE = "No COA on file. Mock seed.";

export const SEED_LOTS: InventoryLot[] = [
  {
    id: "lot-d1",
    skuId: "no-1",
    batchLabel: "MOCK-LOT-D1",
    metrcUid: "MOCK-UID-D1",
    testStatus: "TestPassed",
    onHand: 180,
    reserved: 40,
    location: "Prototype vault A",
    packagedOn: "2026-08-12",
    agingDays: 34,
    coaNote: MOCK_COA_NOTE,
  },
  {
    id: "lot-d-hold",
    skuId: "no-1",
    batchLabel: "MOCK-LOT-D-HOLD",
    metrcUid: "MOCK-UID-D-HOLD",
    testStatus: "TestingRequired",
    onHand: 8,
    reserved: 0,
    location: "Prototype vault A",
    packagedOn: "2026-09-14",
    agingDays: 1,
    coaNote: MOCK_COA_NOTE,
  },
  {
    id: "lot-u1",
    skuId: "no-2",
    batchLabel: "MOCK-LOT-U1",
    metrcUid: "MOCK-UID-U1",
    testStatus: "TestPassed",
    onHand: 90,
    reserved: 12,
    location: "Prototype vault A",
    packagedOn: "2026-08-20",
    agingDays: 26,
    coaNote: MOCK_COA_NOTE,
  },
  {
    id: "lot-p1",
    skuId: "no-3",
    batchLabel: "MOCK-LOT-P1",
    metrcUid: "MOCK-UID-P1",
    testStatus: "TestPassed",
    onHand: 22,
    reserved: 6,
    location: "Prototype vault B",
    packagedOn: "2026-06-27",
    agingDays: 80,
    coaNote: MOCK_COA_NOTE,
  },
];

export const SEED_RUNS: ProductionRun[] = [
  {
    id: "run-01",
    skuId: "no-1",
    stage: "pressed",
    expectedYield: 48,
    expectedCompletion: "2026-09-18",
    late: false,
    note: "Mock press run. Not a live floor.",
  },
  {
    id: "run-02",
    skuId: "no-3",
    stage: "washed",
    expectedYield: 16,
    expectedCompletion: "2026-09-10",
    late: true,
    note: "Mock late run. Held for owner review.",
  },
  {
    id: "run-03",
    skuId: "no-2",
    stage: "packaged",
    expectedYield: 10,
    expectedCompletion: "2026-09-16",
    late: false,
    note: "Mock fill run ready to complete.",
  },
];

export const SEED_ACCOUNTS: WholesaleAccount[] = [
  {
    id: "acct-north",
    name: "Prototype Dispensary North",
    license: "MOCK-LIC-PROTO-NORTH",
    licenseMark: "mock/prototype",
    facilityId: "fac-north",
    expiresOn: "2027-06-01",
    contact: "north.buyer@example.test",
    terms: "Net 15 mock",
    region: "North",
    velocity: 42,
    notes: "Standing mock account. License is fake.",
    receivableDays: 18,
  },
  {
    id: "acct-west",
    name: "Prototype Dispensary West",
    license: "MOCK-LIC-PROTO-WEST",
    licenseMark: "mock/prototype",
    facilityId: "fac-west",
    expiresOn: "2026-10-20",
    contact: "west.buyer@example.test",
    terms: "Net 30 mock",
    region: "West",
    velocity: 18,
    notes: "Mock license expires inside 60 days.",
    receivableDays: 52,
  },
  {
    id: "acct-lapsed",
    name: "Prototype Dispensary Lapsed",
    license: "MOCK-LIC-PROTO-LAPSED",
    licenseMark: "mock/prototype",
    facilityId: "fac-lapsed",
    expiresOn: "2026-08-01",
    contact: "lapsed.buyer@example.test",
    terms: "Hold",
    region: "South",
    velocity: 0,
    notes: "Expired mock license. Orders blocked.",
    receivableDays: 8,
  },
  {
    id: "acct-east",
    name: "Prototype Dispensary East",
    license: "MOCK-LIC-PROTO-EAST",
    licenseMark: "mock/prototype",
    facilityId: "fac-east",
    expiresOn: "2027-03-01",
    contact: "east.buyer@example.test",
    terms: "Net 15 mock",
    region: "East",
    velocity: 27,
    notes: "Standing mock account. License is fake.",
    receivableDays: 11,
  },
  {
    id: "acct-metro",
    name: "Prototype Dispensary Metro",
    license: "MOCK-LIC-PROTO-METRO",
    licenseMark: "mock/prototype",
    facilityId: "fac-metro",
    expiresOn: "2027-08-01",
    contact: "metro.buyer@example.test",
    terms: "Net 15 mock",
    region: "Metro",
    velocity: 9,
    notes: "Mock license current. Metrc facility inactive.",
    receivableDays: 6,
  },
];

export const SEED_ORDERS: WholesaleOrder[] = [
  {
    id: "ord-1001",
    accountId: "acct-north",
    stage: "in fulfillment",
    promisedOn: "2026-09-17",
    late: false,
    manifestNumber: "",
    lines: [
      { skuId: "no-1", format: "1g", qty: 24, batchLabel: "MOCK-LOT-D1", lotId: "lot-d1", metrcUid: "MOCK-UID-D1" },
    ],
    documents: "Mock pick ticket. No live BOL.",
  },
  {
    id: "ord-1002",
    accountId: "acct-west",
    stage: "confirmed",
    promisedOn: "2026-09-10",
    late: true,
    manifestNumber: "",
    lines: [
      { skuId: "no-2", format: "0.5g", qty: 12, batchLabel: "MOCK-LOT-U1", lotId: "lot-u1", metrcUid: "MOCK-UID-U1" },
    ],
    documents: "Mock confirmation.",
  },
  {
    id: "ord-1003",
    accountId: "acct-north",
    stage: "shipped",
    promisedOn: "2026-09-14",
    late: false,
    manifestNumber: "MOCK-MANIFEST-1003",
    lines: [
      { skuId: "no-3", format: "1g", qty: 6, batchLabel: "MOCK-LOT-P1", lotId: "lot-p1", metrcUid: "MOCK-UID-P1" },
    ],
    documents: "Mock shipment note.",
  },
  {
    id: "ord-1004",
    accountId: "acct-north",
    stage: "draft",
    promisedOn: "2026-09-22",
    late: false,
    manifestNumber: "",
    lines: [
      { skuId: "no-1", format: "0.5g", qty: 10, batchLabel: "MOCK-LOT-D1", lotId: "lot-d1", metrcUid: "MOCK-UID-D1" },
      { skuId: "no-2", format: "1g", qty: 8, batchLabel: "MOCK-LOT-U1", lotId: "lot-u1", metrcUid: "MOCK-UID-U1" },
    ],
    documents: "Draft only.",
  },
];

export const SEED_ECONOMICS: SkuEconomics[] = [
  {
    skuId: "no-1",
    mockCost: 12,
    mockWholesale: 28,
    mockSellIn: 120,
    mockReorderPct: 38,
    mockMtdUnits: 86,
    mockPlanUnits: 90,
  },
  {
    skuId: "no-2",
    mockCost: 12,
    mockWholesale: 28,
    mockSellIn: 80,
    mockReorderPct: 31,
    mockMtdUnits: 54,
    mockPlanUnits: 60,
  },
  {
    skuId: "no-3",
    mockCost: 18,
    mockWholesale: 40,
    mockSellIn: 24,
    mockReorderPct: 22,
    mockMtdUnits: 11,
    mockPlanUnits: 16,
  },
];

export const SEED_INVESTIGATIONS: DiscrepancyInvestigation[] = [
  {
    id: "inv-p1",
    lotId: "lot-p1",
    uid: "MOCK-UID-P1",
    batchLabel: "MOCK-LOT-P1",
    erpQty: 22,
    metrcQty: 16,
    variancePct: 37.5,
    findingId: "f-disc-p1",
    state: "open",
  },
];

export const SEED_FINDINGS: Finding[] = [
  {
    id: "f-disc-p1",
    severity: "P1",
    source: "Trace discrepancy",
    surface: "Product Trace",
    citation: "NY discrepancy threshold. Variance beyond 2 percent.",
    owner: "Felix",
    due: "2026-09-16",
    cite: "ERP quantity and Metrc quantity disagree on MOCK-LOT-P1.",
    remediate: "Investigate the gap. Metrc wins on paper. Do not hide the variance.",
    document: "Mock investigation record attached. Not a live Metrc ticket.",
    state: "open",
    closedEvidence: "",
    openedOn: "2026-09-15",
    escape: false,
  },
  {
    id: "f-p1-schedule",
    severity: "P1",
    source: "Felix review",
    surface: "Social Scheduler",
    citation: "Prompt 2 Social. Unapproved posts cannot schedule.",
    owner: "Felix",
    due: "2026-09-16",
    cite: "An unapproved social post cannot reach Scheduler.",
    remediate: "Hold the draft in Editor until Felix and owner clear it.",
    document: "Mock seed. Standing rule recorded.",
    state: "open",
    closedEvidence: "",
    openedOn: "2026-09-14",
    escape: false,
  },
  {
    id: "f-p2-dash",
    severity: "P2",
    source: "code scan",
    surface: "prototype copy bank",
    citation: "Dash lint. Zero em dash or en dash.",
    owner: "Vesper",
    due: "2026-09-20",
    cite: "Dash lint is a release gate.",
    remediate: "Replace any dash characters with a period or comma.",
    document: "Mock seed. No live scan attached.",
    state: "open",
    closedEvidence: "",
    openedOn: "2026-09-13",
    escape: false,
  },
  {
    id: "f-p3-closed",
    severity: "P3",
    source: "manual",
    surface: "Age gate copy",
    citation: "Age-gate integrity.",
    owner: "M",
    due: "2026-09-10",
    cite: "Age gate must stay intact on every public route.",
    remediate: "Confirmed on rc-117.",
    document: "Closed with mock evidence note.",
    state: "closed",
    closedEvidence: "rc-117 age gate green. Mock close.",
    openedOn: "2026-09-08",
    escape: false,
  },
];

export const SEED_INCIDENTS: Incident[] = [
  {
    id: "inc-01",
    title: "Mock lockout on /haus/admin",
    timeline: "14:32 lockout. Felix alert A-40912.",
    impact: "Admin door stayed closed. No member data touched.",
    actions: "Alert routed to Security wing.",
    rootCause: "Five failed password attempts. Mock source 74.12.x.x.",
    findingId: "f-p2-dash",
  },
];

export const SEED_RULES: SecurityRule[] = [
  {
    id: "rule-headers",
    name: "Web security headers and CSP",
    citation: "OWASP headers. Bond CSP.",
    enforcement: "Pre-Check and runtime.",
    gate: "both",
  },
  {
    id: "rule-age",
    name: "Age-gate integrity",
    citation: "Public age gate must not be bypassed.",
    enforcement: "Pre-Check tests.",
    gate: "pre-check",
  },
  {
    id: "rule-claims",
    name: "Claims-language lint",
    citation: "Felix. No therapeutic claims.",
    enforcement: "Pre-Check blocks on hit.",
    gate: "pre-check",
  },
  {
    id: "rule-dash",
    name: "Dash lint",
    citation: "Zero em dash or en dash in portal copy.",
    enforcement: "Pre-Check and lint script.",
    gate: "both",
  },
  {
    id: "rule-deps",
    name: "Dependency and secret policy",
    citation: "No secrets in client. Dependency drift blocks at high.",
    enforcement: "Pre-Check. M gate.",
    gate: "pre-check",
  },
  {
    id: "rule-agents",
    name: "Claude Code enforcement set",
    citation: "Agents may never touch production, alter canon silently, publish social, or modify this ruleset.",
    enforcement: "Runtime plus owner.",
    gate: "runtime",
  },
];

export const SEED_WAIVERS: Waiver[] = [
  {
    id: "wav-01",
    findingId: "f-p3-closed",
    expiresOn: "2026-09-08",
    control: "Mock compensating review on age-gate copy.",
    state: "expired",
  },
  {
    id: "wav-02",
    findingId: "f-p2-dash",
    expiresOn: "2026-09-30",
    control: "Owner-approved time box on prototype copy bank.",
    state: "active",
  },
];

export const SEED_AUDIT: AuditRow[] = [
  {
    id: "aud-01",
    time: "14:32:08",
    actor: "Felix",
    action: "alert.raise",
    target: "/haus/admin",
    note: "Lockout after 5 failed attempts. Mock seed.",
  },
  {
    id: "aud-02",
    time: "14:29:51",
    actor: "JB",
    action: "review.endorse",
    target: "rc-118",
    note: "Endorsed Vesper verdict. Routed to M.",
  },
  {
    id: "aud-03",
    time: "13:30:11",
    actor: "JB",
    action: "audit.daily",
    target: "command",
    note: "Daily audit posted. Mock digest.",
  },
];

export const SEED_DSAR: DsarRequest[] = [
  {
    id: "dsar-01",
    subject: "member.demo@example.test",
    state: "intake",
    clock: "Day 2 of 30. Mock clock.",
    note: "Bond holds little personal data by design. Prototype request only.",
  },
];

export const SEED_VENDORS: Vendor[] = [
  {
    id: "vnd-host",
    name: "Prototype Host",
    scope: "Static and Next.js hosting. Mock register.",
    dpa: "Mock DPA on file. Not a live counterparty.",
    renewal: "2027-01-15",
  },
  {
    id: "vnd-auth",
    name: "Prototype Auth",
    scope: "Haus sign-in. No health data. No BAA regime.",
    dpa: "Mock DPA on file.",
    renewal: "2026-12-01",
  },
];

export const SEED_SCANNER: ScannerItem[] = [
  {
    id: "scan-01",
    source: "dependency audit",
    note: "Mock scanner bridge. Flows into Findings.",
    findingId: "f-p2-dash",
  },
];

export const SEED_PRECHECK: PreCheckResult[] = [
  {
    id: "pc-117",
    candidate: "rc-117",
    verdict: "green",
    reasons: ["headers", "CSP", "age gate", "claims lint", "dash lint"],
  },
  {
    id: "pc-118",
    candidate: "rc-118",
    verdict: "blocked",
    reasons: ["Seeded violation: claims lint on prototype copy"],
  },
];

export const SEED_SOC2: Soc2Control[] = [
  {
    id: "cc6",
    control: "CC6 logical access",
    evidence: "Mock export. Haus cloak, admin role, audit log.",
  },
  {
    id: "cc7",
    control: "CC7 monitoring",
    evidence: "Mock export. Findings, Pre-Check, scanner bridge.",
  },
];

export const SEED_SOCIAL_PIPELINE: SocialPipelineItem[] = [
  {
    id: "d-207",
    title: "Nothing added, everything real",
    kind: "Reel",
    stage: "felix",
    desk: "Editor",
    note: "Awaiting Felix originality check.",
    approved: false,
    auditFlags: ["originality hold"],
  },
  {
    id: "d-208",
    title: "The press, in 15 seconds",
    kind: "Short",
    stage: "felix",
    desk: "Editor",
    note: "Awaiting Felix originality check.",
    approved: false,
    auditFlags: ["originality hold"],
  },
  {
    id: "d-209",
    title: "With your highest self",
    kind: "Carousel",
    stage: "owner",
    desk: "Editor",
    note: "Felix cleared. Awaiting owner.",
    approved: false,
    auditFlags: [],
  },
  {
    id: "d-210",
    title: "Find your number",
    kind: "Reel",
    stage: "held",
    desk: "Scriptwriter",
    note: "Held on voice check.",
    approved: false,
    auditFlags: ["voice check"],
  },
  {
    id: "d-211",
    title: "Morning Routine",
    kind: "Reel",
    stage: "approved",
    desk: "Editor",
    note: "Last approved. 3 edits flagged and closed.",
    approved: true,
    auditFlags: [],
  },
];

export const SEED_DESK_STRIPS: SocialDeskStrip[] = [
  {
    id: "strip-script",
    title: "Scriptwriter",
    state: "LIVE",
    line: "Drafting: 10 hook variations for the current concept.",
  },
  {
    id: "strip-editor",
    title: "Editor",
    state: "LIVE",
    line: "Last approved: Morning Routine, 3 edits flagged.",
  },
  {
    id: "strip-sched",
    title: "Scheduler",
    state: "PARKED",
    line: "Prompt 2C parked. No live social post.",
  },
  {
    id: "strip-analyzer",
    title: "Analyzer",
    state: "HELD",
    line: "Processing 30-day engagement data across 6 platforms. Mock seed.",
  },
];

export const SEED_RESEARCH: ResearchRow[] = [
  {
    id: "res-01",
    format: "Process reveal",
    hook: "The press, in 15 seconds",
    remixFit: "High. Brand test pass.",
    provenance: "Scout ledger mock. No scrape connected.",
    note: "Positive content only.",
  },
  {
    id: "res-02",
    format: "Numbered collection",
    hook: "Find your number",
    remixFit: "Medium. Hold for owner voice.",
    provenance: "Scout ledger mock. No scrape yet.",
    note: "No live platform pull.",
  },
];

export const SEED_VARIATIONS: ScriptVariation[] = [
  {
    id: "var-01",
    hook: "Nothing added. Nothing in the way.",
    caption: "When the product is pure, the experience is real.",
    platform: "Short",
    provenance: "Film Day asset library mock.",
  },
  {
    id: "var-02",
    hook: "Choose your moment.",
    caption: "The Numbered Collection. Dialed. Unwind. Peak.",
    platform: "Reel",
    provenance: "Film Day asset library mock.",
  },
  {
    id: "var-03",
    hook: "With your highest self.",
    caption: "What you consume matters.",
    platform: "Carousel",
    provenance: "Film Day asset library mock.",
  },
];

export const SEED_SOCIAL_METRICS: SocialMetric[] = [
  { platform: "TikTok", posts: "--", reach: "--", note: "No scrape yet" },
  { platform: "Instagram", posts: "--", reach: "--", note: "No scrape yet" },
  { platform: "YouTube", posts: "--", reach: "--", note: "No scrape yet" },
];
