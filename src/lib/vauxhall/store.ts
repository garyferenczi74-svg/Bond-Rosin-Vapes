import {
  EVENT_POOL,
  NUMBERED_COLLECTION,
  SEED_ACCOUNTS,
  SEED_AUDIT,
  SEED_CANON,
  SEED_CLOCK,
  SEED_DESK_STRIPS,
  SEED_DRAFTS,
  SEED_DSAR,
  SEED_ECONOMICS,
  SEED_EVENTS,
  SEED_FINDINGS,
  SEED_INCIDENTS,
  SEED_INVESTIGATIONS,
  SEED_LOTS,
  SEED_ORDERS,
  SEED_PRECHECK,
  SEED_RCS,
  SEED_RESEARCH,
  SEED_REVIEW,
  SEED_RULES,
  SEED_RUNS,
  SEED_SCANNER,
  SEED_SKUS,
  SEED_SOC2,
  SEED_SOCIAL_METRICS,
  SEED_SOCIAL_PIPELINE,
  SEED_TUNING,
  SEED_VARIATIONS,
  SEED_VENDORS,
  SEED_WAIVERS,
} from "./seed.ts";
import { MetrcMockAdapter } from "./metrc-mock.ts";
import {
  AUDIT_GENESIS,
  failSeverityFor,
  mockHash,
  mockLintPageCopy,
  MOCK_LINT_ELEMENT,
  MOCK_LINT_PAGE,
  pushSpark,
  seedMonitors,
} from "./monitors.ts";
import {
  AUTO_ACTION_ALLOWLIST,
  M_SHIP_PRECONDITION_TEXT,
  VESPER_WEEKLY_AUDIT,
  appendAuditEvent,
  checkpointAuditOffsite,
  evaluateShipPrecondition,
  executeAutoAction,
  ingestScanArtifact,
  runMonitorDry,
  runPreCheckServerDry,
  scheduledVerifyJobStub,
  seedMonitorSchedules,
  type AutoActionItem,
  type MonitorSchedule,
  type PlumbingAuditEvent,
  type PreCheckServerRun,
  type ShipPrecondition,
  type WeeklyAuditChecklist,
} from "./plumbing/index.ts";
import type { MetrcAdapterMode } from "./metrc-flags.ts";
import type { TraceProvider, TraceSnapshot, TraceTestStatus } from "./trace.ts";
import { DISCREPANCY_THRESHOLD_PCT, isAllocatableStatus, metrcStamp, variancePercent } from "./trace.ts";
import type {
  AccountAttempt,
  AgentEvent,
  AgentName,
  AgentSummary,
  AuditRow,
  AuditVerify,
  CanonDoc,
  CloseFindingAttempt,
  CollectionFrame,
  DashboardSnapshot,
  DiscrepancyInvestigation,
  DiscrepancyRow,
  DsarRequest,
  EventType,
  Finding,
  Incident,
  IncidentBeat,
  InventoryLot,
  LicenseState,
  Monitor,
  MonitorId,
  MonitorRun,
  MonitorState,
  OrderAttempt,
  OrderLine,
  OrderStage,
  PreCheckResult,
  ProductAlert,
  ProductionRun,
  QueueSnapshot,
  ResearchRow,
  ReviewItem,
  ReviewState,
  RuleEditAttempt,
  ScannerItem,
  ScheduleAttempt,
  ScriptVariation,
  SecurityRule,
  SecurityScorecard,
  Sku,
  SkuEconomics,
  SkuLifecycle,
  SkuMetrics,
  Soc2Control,
  SocialDeskStrip,
  SocialMetric,
  SocialPipelineItem,
  StageAttempt,
  StoreFilter,
  TuningProposal,
  Vendor,
  Waiver,
  WholesaleAccount,
  WholesaleOrder,
} from "./types.ts";
import { AGENTS, ORDER_STAGES, RULE_GROUPS, RUN_STAGES } from "./types.ts";

type Listener = () => void;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function clockTime(now = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function dayDiff(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / 86400000);
}

function cloneLines(lines: OrderLine[]): OrderLine[] {
  return lines.map((line) => ({ ...line }));
}

function sanitizeOrderNotes(value?: string): string {
  const notes = (value ?? "").trim().slice(0, 500);
  return notes;
}

export class VauxhallStore {
  revision = 0;
  live = false;
  filter: StoreFilter = { agent: null, type: null, allData: false };
  events: AgentEvent[] = [];
  review: ReviewItem[] = [];
  rcs = SEED_RCS.map((item) => ({ ...item }));
  drafts = SEED_DRAFTS.map((item) => ({ ...item }));
  tuning: TuningProposal[] = [];
  canon: CanonDoc[] = [];
  skus: Sku[] = [];
  collection: CollectionFrame = { ...NUMBERED_COLLECTION };
  lots: InventoryLot[] = [];
  runs: ProductionRun[] = [];
  accounts: WholesaleAccount[] = [];
  orders: WholesaleOrder[] = [];
  economics: SkuEconomics[] = [];
  findings: Finding[] = [];
  incidents: Incident[] = [];
  rules: SecurityRule[] = [];
  waivers: Waiver[] = [];
  auditRows: AuditRow[] = [];
  dsar: DsarRequest[] = [];
  vendors: Vendor[] = [];
  scanner: ScannerItem[] = [];
  prechecks: PreCheckResult[] = [];
  soc2: Soc2Control[] = [];
  socialPipeline: SocialPipelineItem[] = [];
  deskStrips: SocialDeskStrip[] = [];
  research: ResearchRow[] = [];
  variations: ScriptVariation[] = [];
  socialMetrics: SocialMetric[] = [];
  seedClock = SEED_CLOCK;
  investigations: DiscrepancyInvestigation[] = [];
  trace: TraceProvider;
  traceSnap: TraceSnapshot;
  connectSnap: TraceSnapshot | null = null;
  adapterMode: MetrcAdapterMode = "mock";
  demoLive = false;
  monitors: Monitor[] = [];
  plumbingSchedules: MonitorSchedule[] = [];
  plumbingRuns: MonitorRun[] = [];
  plumbingFindings: Finding[] = [];
  plumbingPrechecks: PreCheckServerRun[] = [];
  plumbingAudit: PlumbingAuditEvent[] = [];
  private eid = 100;
  private oid = 1100;
  private fid = 40;
  private lotSeq = 200;
  private runSeq = 10;
  private invSeq = 20;
  private iid = 10;
  private rid = 200;
  private plumbingRid = 1;
  private plumbingFid = 1;
  private labDelayMs: number;
  private traceLatencyMs: number;
  private labTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private listeners = new Set<Listener>();
  private demoElapsed = 0;
  private scriptedLintDone = false;
  private scriptedLockoutDone = false;
  private standingChecksDone = false;
  private precheckFixApplied: Record<string, boolean> = {};
  private auditBackup: AuditRow[] | null = null;
  private auditTampered = false;

  constructor(opts?: {
    labDelayMs?: number;
    traceLatencyMs?: number;
    trace?: TraceProvider;
    adapterMode?: MetrcAdapterMode;
  }) {
    this.labDelayMs = opts?.labDelayMs ?? 1800;
    this.traceLatencyMs = opts?.traceLatencyMs ?? 40;
    this.adapterMode = opts?.adapterMode ?? "mock";
    this.trace = opts?.trace ?? new MetrcMockAdapter({ latencyMs: this.traceLatencyMs });
    this.traceSnap = this.trace.hydrate();
    this.seed();
  }

  setAdapterMode(mode: MetrcAdapterMode): void {
    if (this.adapterMode === mode) return;
    this.adapterMode = mode;
    this.emit();
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit(): void {
    this.revision += 1;
    this.listeners.forEach((listener) => listener());
  }

  private nextId(): string {
    this.eid += 1;
    return `e${this.eid}`;
  }

  private nextAudit(): string {
    return `A-${41000 + Math.floor(Math.random() * 900)}`;
  }

  seed(): void {
    this.events = SEED_EVENTS.map((item) => ({ ...item }));
    this.review = SEED_REVIEW.map((item) => ({ ...item }));
    this.rcs = SEED_RCS.map((item) => ({ ...item }));
    this.drafts = SEED_DRAFTS.map((item) => ({ ...item }));
    this.tuning = SEED_TUNING.map((item) => ({ ...item }));
    this.canon = SEED_CANON.map((item) => ({ ...item }));
    this.skus = SEED_SKUS.map((item) => ({ ...item, formats: item.formats.slice() }));
    this.collection = { ...NUMBERED_COLLECTION };
    this.lots = SEED_LOTS.map((item) => ({ ...item }));
    this.runs = SEED_RUNS.map((item) => ({ ...item }));
    this.accounts = SEED_ACCOUNTS.map((item) => ({ ...item }));
    this.orders = SEED_ORDERS.map((item) => ({ ...item, lines: cloneLines(item.lines) }));
    this.economics = SEED_ECONOMICS.map((item) => ({ ...item }));
    this.findings = SEED_FINDINGS.map((item) => ({ ...item }));
    this.incidents = SEED_INCIDENTS.map((item) => ({ ...item }));
    this.rules = SEED_RULES.map((item) => ({ ...item }));
    this.waivers = SEED_WAIVERS.map((item) => ({ ...item }));
    this.auditRows = SEED_AUDIT.map((item) => ({ ...item }));
    this.dsar = SEED_DSAR.map((item) => ({ ...item }));
    this.vendors = SEED_VENDORS.map((item) => ({ ...item }));
    this.scanner = SEED_SCANNER.map((item) => ({ ...item }));
    this.prechecks = SEED_PRECHECK.map((item) => ({ ...item }));
    this.soc2 = SEED_SOC2.map((item) => ({ ...item }));
    this.socialPipeline = SEED_SOCIAL_PIPELINE.map((item) => ({
      ...item,
      auditFlags: item.auditFlags.slice(),
    }));
    this.deskStrips = SEED_DESK_STRIPS.map((item) => ({ ...item }));
    this.research = SEED_RESEARCH.map((item) => ({ ...item }));
    this.variations = SEED_VARIATIONS.map((item) => ({ ...item }));
    this.socialMetrics = SEED_SOCIAL_METRICS.map((item) => ({ ...item }));
    this.clearLabTimers();
    this.trace.reset();
    this.traceSnap = this.trace.hydrate();
    this.connectSnap = null;
    this.investigations = SEED_INVESTIGATIONS.map((item) => ({ ...item }));
    this.seedClock = SEED_CLOCK;
    this.eid = 100;
    this.oid = 1100;
    this.fid = 40;
    this.lotSeq = 200;
    this.runSeq = 10;
    this.invSeq = 20;
    this.iid = 10;
    this.rid = 200;
    this.plumbingRid = 1;
    this.plumbingFid = 1;
    this.plumbingSchedules = seedMonitorSchedules();
    this.plumbingRuns = [];
    this.plumbingFindings = [];
    this.plumbingPrechecks = [];
    this.plumbingAudit = appendAuditEvent([], {
      id: "aud-plumb-0",
      time: "14:20:00",
      actor: "Felix",
      action: "plumbing.boot",
      target: "audit_events",
      note: "Production chain stub. Tamper Test never writes here.",
    });
    this.filter = { agent: null, type: null, allData: false };
    this.live = false;
    this.demoLive = false;
    this.demoElapsed = 0;
    this.scriptedLintDone = false;
    this.scriptedLockoutDone = false;
    this.standingChecksDone = false;
    this.precheckFixApplied = {};
    this.auditBackup = null;
    this.auditTampered = false;
    this.monitors = seedMonitors();
    this.sealAuditChain();
  }

  private clearLabTimers(): void {
    for (const timer of this.labTimers.values()) clearTimeout(timer);
    this.labTimers.clear();
  }

  listEvents(): AgentEvent[] {
    let out = this.events.slice();
    if (this.filter.agent) out = out.filter((event) => event.agent === this.filter.agent);
    if (this.filter.type) out = out.filter((event) => event.type === this.filter.type);
    return out;
  }

  addEvent(event: AgentEvent): void {
    this.events.unshift(event);
    this.emit();
  }

  genEvent(now = new Date()): AgentEvent {
    const pick = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)] ?? EVENT_POOL[0];
    return {
      id: this.nextId(),
      time: clockTime(now),
      agent: pick.agent,
      type: pick.type,
      summary: pick.summary,
      sub: pick.sub,
      audit: this.nextAudit(),
    };
  }

  setFilter(patch: Partial<StoreFilter>): void {
    this.filter = { ...this.filter, ...patch };
    this.emit();
  }

  toggleAgent(agent: AgentName): void {
    this.filter.agent = this.filter.agent === agent ? null : agent;
    this.emit();
  }

  setType(type: EventType | null): void {
    this.filter.type = type;
    this.emit();
  }

  toggleAllData(): void {
    this.filter.allData = !this.filter.allData;
    this.emit();
  }

  setLive(on: boolean): void {
    this.live = on;
    this.emit();
  }

  listReview(): ReviewItem[] {
    return this.review.slice();
  }

  openReviewCount(): number {
    return this.review.filter((item) => item.state === "open").length;
  }

  resolveReview(id: string, action: Exclude<ReviewState, "open">, note = ""): void {
    const item = this.review.find((row) => row.id === id);
    if (!item || item.state !== "open") return;
    item.state = action;
    const verb =
      action === "approved" ? "Owner approved" : action === "rejected" ? "Owner rejected" : "Owner sent back";
    this.events.unshift({
      id: this.nextId(),
      time: clockTime(),
      agent: "JB",
      type: "Agent Decision",
      summary: `${verb}: ${item.title}`,
      sub: note ? `Note: ${note}` : "Logged to the decision record",
      audit: this.nextAudit(),
    });
    this.emit();
  }

  listQueue(): QueueSnapshot {
    return {
      rcs: this.rcs.map((item) => ({ ...item })),
      drafts: this.drafts.map((item) => ({ ...item })),
    };
  }

  submitDirective(text: string, target = "", priority = "Normal", due = ""): void {
    const words = text.trim().split(/\s+/).slice(0, 8).join(" ");
    this.events.unshift({
      id: this.nextId(),
      time: clockTime(),
      agent: "JB",
      type: "Agent Decision",
      summary: `Directive received: ${words}... routed by JB`,
      sub: `Target: ${target || "JB decides"} . Priority: ${priority}${due ? ` . Due: ${due}` : ""}`,
      audit: this.nextAudit(),
    });
    this.emit();
  }

  listTuning(): TuningProposal[] {
    return this.tuning.map((item) => ({ ...item }));
  }

  applyTuning(id: string): void {
    const item = this.tuning.find((row) => row.id === id);
    if (!item) return;
    item.state = "applied";
    this.events.unshift({
      id: this.nextId(),
      time: clockTime(),
      agent: "M",
      type: "Evolution",
      summary: `Tuning applied: ${item.proposal}`,
      sub: "Owner action . rollback available",
      audit: this.nextAudit(),
    });
    this.emit();
  }

  rejectTuning(id: string, note = ""): void {
    const item = this.tuning.find((row) => row.id === id);
    if (!item) return;
    item.state = "rejected";
    this.events.unshift({
      id: this.nextId(),
      time: clockTime(),
      agent: "M",
      type: "Self-Tune",
      summary: `Tuning rejected: ${item.proposal}`,
      sub: note ? `Note: ${note}` : "Owner declined",
      audit: this.nextAudit(),
    });
    this.emit();
  }

  rollbackTuning(id: string): void {
    const item = this.tuning.find((row) => row.id === id);
    if (!item || item.state !== "applied") return;
    item.state = "proposed";
    this.events.unshift({
      id: this.nextId(),
      time: clockTime(),
      agent: "M",
      type: "Evolution",
      summary: `Tuning rolled back: ${item.proposal}`,
      sub: "Owner action . prior behavior restored",
      audit: this.nextAudit(),
    });
    this.emit();
  }

  listCanon(): CanonDoc[] {
    return this.canon.map((item) => ({ ...item }));
  }

  listSkus(): Sku[] {
    return this.skus.map((item) => ({ ...item, formats: item.formats.slice() }));
  }

  collectionFrame(): CollectionFrame {
    return { ...this.collection };
  }

  skuMetrics(): SkuMetrics {
    const list = this.listSkus();
    const formats = new Set<string>();
    const lifecycle: Partial<Record<SkuLifecycle, number>> = {};
    for (const sku of list) {
      for (const format of sku.formats) formats.add(format);
      lifecycle[sku.lifecycle] = (lifecycle[sku.lifecycle] ?? 0) + 1;
    }
    return {
      active: list.filter((sku) => sku.lifecycle === "active").length,
      formats: formats.size,
      lifecycle,
    };
  }

  addSku(sku: Sku): void {
    if (this.skus.some((row) => row.id === sku.id)) return;
    this.skus.push({ ...sku, formats: sku.formats.slice() });
    this.trace.addItem({ id: `item-${sku.id}`, skuId: sku.id, name: sku.editionName });
    this.traceSnap = this.trace.hydrate();
    this.emit();
  }

  skuById(id: string): Sku | undefined {
    return this.skus.find((sku) => sku.id === id);
  }

  listLots(): InventoryLot[] {
    return this.lots.map((item) => ({ ...item }));
  }

  listRuns(): ProductionRun[] {
    return this.runs.map((item) => ({ ...item }));
  }

  unitsForSku(skuId: string): { onHand: number; reserved: number; available: number } {
    const lots = this.lots.filter((lot) => lot.skuId === skuId);
    const onHand = lots.reduce((sum, lot) => sum + lot.onHand, 0);
    const reserved = lots.reduce((sum, lot) => sum + lot.reserved, 0);
    return { onHand, reserved, available: onHand - reserved };
  }

  unitsInProcess(): number {
    return this.runs.reduce((sum, run) => sum + run.expectedYield, 0);
  }

  licenseState(account: WholesaleAccount, asOf = this.seedClock): LicenseState {
    const days = dayDiff(asOf, account.expiresOn);
    if (days < 0) return "expired";
    if (days <= 60) return "expiring";
    return "active";
  }

  listAccounts(): WholesaleAccount[] {
    return this.accounts.map((item) => ({ ...item }));
  }

  accountById(id: string): WholesaleAccount | undefined {
    return this.accounts.find((item) => item.id === id);
  }

  facilityForAccount(account: WholesaleAccount) {
    return this.traceSnap.facilities.find(
      (item) => item.id === account.facilityId || item.licenseNumber === account.license,
    );
  }

  orderGate(accountId: string): { ok: true } | { ok: false; reason: string } {
    const account = this.accountById(accountId);
    if (!account) return { ok: false, reason: "Account not found." };
    if (this.licenseState(account) === "expired") {
      return { ok: false, reason: "License gate: Expired mock license. Order blocked." };
    }
    const facility = this.facilityForAccount(account);
    if (!facility || !facility.active || !facility.licensed) {
      return { ok: false, reason: "Facility gate: Metrc facility is inactive. Order blocked." };
    }
    return { ok: true };
  }

  canOrderAgainst(accountId: string): boolean {
    return this.orderGate(accountId).ok;
  }

  private displaySync() {
    if (this.adapterMode === "connect") {
      return this.connectSnap?.sync ?? {
        lastPull: {
          packages: "",
          transfers: "",
          labResults: "",
          tags: "",
          facilities: "",
          items: "",
        },
        nextScheduled: "",
        stale: true,
        asOf: "none",
      };
    }
    return this.traceSnap.sync;
  }

  private displayPackages() {
    return this.adapterMode === "connect" ? this.connectSnap?.packages ?? [] : this.traceSnap.packages;
  }

  private displayTags() {
    return this.adapterMode === "connect" ? this.connectSnap?.tags ?? null : this.traceSnap.tags;
  }

  displayTraceSnap(): TraceSnapshot {
    if (this.adapterMode === "connect") {
      return (
        this.connectSnap ?? {
          packages: [],
          transfers: [],
          facilities: [],
          items: [],
          tags: {
            packageTags: 0,
            retailQrIds: 0,
            packageTagThreshold: 0,
            retailQrThreshold: 0,
            packageUids: [],
            retailIds: [],
          },
          labs: [],
          sync: this.displaySync(),
        }
      );
    }
    return this.traceSnap;
  }

  applyConnectSnapshot(snap: TraceSnapshot): void {
    this.connectSnap = {
      packages: snap.packages.map((item) => ({ ...item })),
      transfers: snap.transfers.map((item) => ({ ...item })),
      facilities: snap.facilities.map((item) => ({ ...item })),
      items: snap.items.map((item) => ({ ...item })),
      tags: {
        ...snap.tags,
        packageUids: snap.tags.packageUids.slice(),
        retailIds: snap.tags.retailIds.slice(),
      },
      labs: snap.labs.map((item) => ({ ...item })),
      sync: { ...snap.sync, lastPull: { ...snap.sync.lastPull } },
    };
    this.emit();
  }

  stamp(): string {
    return metrcStamp(this.displaySync());
  }

  allocatableLots(skuId?: string): InventoryLot[] {
    return this.lots.filter((lot) => {
      if (skuId && lot.skuId !== skuId) return false;
      return isAllocatableStatus(lot.testStatus) && lot.onHand - lot.reserved > 0;
    });
  }

  allocatableForSku(skuId: string): number {
    return this.allocatableLots(skuId).reduce((sum, lot) => sum + (lot.onHand - lot.reserved), 0);
  }

  listOrders(): WholesaleOrder[] {
    return this.orders.map((item) => ({ ...item, lines: cloneLines(item.lines) }));
  }

  availableForSku(skuId: string): number {
    return this.unitsForSku(skuId).available;
  }

  createOrderRequest(input: {
    accountId: string;
    lines: Array<Pick<OrderLine, "skuId" | "format" | "qty">>;
    promisedOn: string;
    notes?: string;
    actor?: string;
  }): OrderAttempt {
    const gate = this.orderGate(input.accountId);
    if (!gate.ok) return gate;
    const written: OrderLine[] = [];
    for (const line of input.lines) {
      if (!Number.isFinite(line.qty) || line.qty <= 0) {
        return { ok: false, reason: "Quantity must be at least 1." };
      }
      if (line.skuId !== "no-1" && line.skuId !== "no-2" && line.skuId !== "no-3") {
        return { ok: false, reason: "SKU is not on the partner book." };
      }
      written.push({
        skuId: line.skuId,
        format: line.format || "1g",
        qty: line.qty,
        batchLabel: "Unallocated request",
        lotId: "",
        metrcUid: "",
      });
    }
    if (!written.length) {
      return { ok: false, reason: "Add at least one line." };
    }
    const notes = sanitizeOrderNotes(input.notes);
    const promisedOn = input.promisedOn || this.seedClock;
    const late = dayDiff(promisedOn, this.seedClock) > 0;
    this.oid += 1;
    const id = `ord-${this.oid}`;
    const account = this.accountById(input.accountId);
    const order: WholesaleOrder = {
      id,
      accountId: input.accountId,
      stage: "draft",
      promisedOn,
      late,
      manifestNumber: "",
      lines: cloneLines(written),
      documents: "Partner request. Draft only. No Metrc write.",
      notes,
      source: "partner",
    };
    this.orders.unshift(order);
    const event: AgentEvent = {
      id: this.nextId(),
      time: clockTime(),
      agent: "Q",
      type: "ORDER_REQUEST",
      summary: "ORDER_REQUEST",
      sub: `${id} . ${account?.name ?? input.accountId} . draft . no Metrc write`,
      audit: this.nextAudit(),
    };
    this.events.unshift(event);
    this.appendAudit({
      actor: input.actor || input.accountId,
      action: "order.request",
      target: id,
      note: "Partner request. Draft only. No Metrc write.",
    });
    this.emit();
    return { ok: true, id };
  }

  ingestPartnerRequests(bundle: { orders: WholesaleOrder[]; events: AgentEvent[] }): void {
    let changed = false;
    for (const order of bundle.orders) {
      if (this.orders.some((row) => row.id === order.id)) continue;
      this.orders.unshift({
        ...order,
        stage: "draft",
        source: "partner",
        lines: cloneLines(order.lines),
      });
      const numeric = Number(String(order.id).replace(/^ord-/, ""));
      if (Number.isFinite(numeric) && numeric > this.oid) this.oid = numeric;
      changed = true;
    }
    for (const event of bundle.events) {
      if (this.events.some((row) => row.id === event.id)) continue;
      this.events.unshift({ ...event });
      changed = true;
    }
    if (changed) this.emit();
  }

  createOrder(input: {
    accountId: string;
    lines: OrderLine[];
    promisedOn: string;
    documents?: string;
  }): OrderAttempt {
    const gate = this.orderGate(input.accountId);
    if (!gate.ok) return gate;
    if (!input.lines.length) {
      return { ok: false, reason: "Add at least one line." };
    }
    const reserved: { lot: InventoryLot; take: number }[] = [];
    const written: OrderLine[] = [];
    for (const line of input.lines) {
      if (!Number.isFinite(line.qty) || line.qty <= 0) {
        return { ok: false, reason: "Quantity must be at least 1." };
      }
      const pick = this.pickLots(line.skuId, line.qty, line.lotId);
      if (!pick.ok) {
        for (const row of reserved) row.lot.reserved -= row.take;
        return pick;
      }
      for (const row of pick.used) {
        row.lot.reserved += row.take;
        reserved.push(row);
      }
      const first = pick.used[0]?.lot;
      written.push({
        skuId: line.skuId,
        format: line.format,
        qty: line.qty,
        batchLabel: pick.used.map((row) => row.lot.batchLabel).join(" . "),
        lotId: first?.id ?? "",
        metrcUid: first?.metrcUid ?? "",
      });
    }
    const promisedOn = input.promisedOn || this.seedClock;
    const late = dayDiff(promisedOn, this.seedClock) > 0;
    this.oid += 1;
    const id = `ord-${this.oid}`;
    this.orders.unshift({
      id,
      accountId: input.accountId,
      stage: "draft",
      promisedOn,
      late,
      manifestNumber: "",
      lines: cloneLines(written),
      documents: input.documents || "Mock draft. Not a live order.",
    });
    if (late) {
      this.pushAlertEvent(
        "Late mock order filed",
        `${id} promised ${promisedOn}. Alert raised from the order clock.`,
      );
    }
    this.emit();
    return { ok: true, id };
  }

  private pickLots(
    skuId: string,
    qty: number,
    lotId?: string,
  ): { ok: true; used: { lot: InventoryLot; take: number }[] } | { ok: false; reason: string } {
    if (lotId) {
      const lot = this.lots.find((row) => row.id === lotId);
      if (!lot || lot.skuId !== skuId) return { ok: false, reason: "Lot is not on that SKU." };
      if (!isAllocatableStatus(lot.testStatus)) {
        return {
          ok: false,
          reason: `Test gate: lot is ${lot.testStatus}. Allocation disabled until TestPassed or RetestPassed.`,
        };
      }
      const free = lot.onHand - lot.reserved;
      if (free < qty) return { ok: false, reason: "Reserved stock cannot be double allocated." };
      return { ok: true, used: [{ lot, take: qty }] };
    }
    let remain = qty;
    const used: { lot: InventoryLot; take: number }[] = [];
    for (const lot of this.allocatableLots(skuId)) {
      const take = Math.min(lot.onHand - lot.reserved, remain);
      if (take <= 0) continue;
      used.push({ lot, take });
      remain -= take;
      if (remain <= 0) break;
    }
    if (remain > 0) {
      if (this.availableForSku(skuId) >= qty) {
        return {
          ok: false,
          reason: "Test gate: allocatable lots are short. TestingRequired stock cannot be allocated.",
        };
      }
      return { ok: false, reason: "Reserved stock cannot be double allocated." };
    }
    return { ok: true, used };
  }

  createAccount(input: {
    name: string;
    license: string;
    expiresOn: string;
    contact: string;
    terms: string;
    region: string;
  }): AccountAttempt {
    if (!input.name.trim() || !input.license.trim() || !input.expiresOn.trim()) {
      return { ok: false, reason: "Name, mock license, and expiry are required." };
    }
    if (!/mock|prototype/i.test(input.license)) {
      return { ok: false, reason: "License must be labeled mock or prototype." };
    }
    const id = `acct-${input.license.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`;
    if (this.accounts.some((row) => row.id === id || row.license === input.license)) {
      return { ok: false, reason: "That mock license is already on the book." };
    }
    const facilityId = `fac-${id.replace(/^acct-/, "")}`;
    const existing = this.traceSnap.facilities.find((item) => item.licenseNumber === input.license.trim());
    if (!existing) {
      this.trace.addFacility({
        id: facilityId,
        licenseNumber: input.license.trim(),
        name: input.name.trim(),
        active: true,
        licensed: true,
        expiresOn: input.expiresOn,
      });
    }
    this.traceSnap = this.trace.hydrate();
    const facility = this.traceSnap.facilities.find(
      (item) => item.licenseNumber === input.license.trim() || item.id === facilityId,
    );
    const verification = facility
      ? `Mock verification: ${input.license.trim()} labeled mock/prototype. Facility ${facility.active && facility.licensed ? "active" : "inactive"}.`
      : "Mock verification: license labeled, no Metrc facility match.";
    this.accounts.push({
      id,
      name: input.name.trim(),
      license: input.license.trim(),
      licenseMark: "mock/prototype",
      facilityId: facility?.id ?? facilityId,
      expiresOn: input.expiresOn,
      contact: input.contact.trim() || "unset@example.test",
      terms: input.terms.trim() || "Net 15 mock",
      region: input.region.trim() || "Unset",
      velocity: 0,
      notes: "Added from mock intake.",
      receivableDays: 0,
    });
    this.emit();
    return { ok: true, id, verification };
  }

  listEconomics(): SkuEconomics[] {
    return this.skus.map((sku) => {
      const row = this.economics.find((item) => item.skuId === sku.id);
      return (
        row ?? {
          skuId: sku.id,
          mockCost: 0,
          mockWholesale: 0,
          mockSellIn: 0,
          mockReorderPct: 0,
          mockMtdUnits: 0,
          mockPlanUnits: 0,
        }
      );
    });
  }

  setSkuCost(skuId: string, mockCost: number): void {
    if (!Number.isFinite(mockCost) || mockCost < 0) return;
    const row = this.economics.find((item) => item.skuId === skuId);
    if (row) {
      row.mockCost = mockCost;
    } else {
      this.economics.push({
        skuId,
        mockCost,
        mockWholesale: 0,
        mockSellIn: 0,
        mockReorderPct: 0,
        mockMtdUnits: 0,
        mockPlanUnits: 0,
      });
    }
    this.emit();
  }

  dashboardSnapshot(): DashboardSnapshot {
    const stageCounts: Partial<Record<OrderStage, number>> = {};
    let openOrders = 0;
    let weekShipments = 0;
    for (const order of this.orders) {
      stageCounts[order.stage] = (stageCounts[order.stage] ?? 0) + 1;
      if (order.stage !== "paid" && order.stage !== "delivered") openOrders += 1;
      if (order.stage === "shipped" || order.stage === "delivered" || order.stage === "paid") {
        weekShipments += order.lines.reduce((sum, line) => sum + line.qty, 0);
      }
    }
    const economics = this.listEconomics();
    return {
      openOrders,
      stageCounts,
      unitsOnHand: this.skus.map((sku) => ({ skuId: sku.id, ...this.unitsForSku(sku.id) })),
      unitsInProcess: this.unitsInProcess(),
      weekShipments,
      mtdUnits: economics.reduce((sum, row) => sum + row.mockMtdUnits, 0),
      planUnits: economics.reduce((sum, row) => sum + row.mockPlanUnits, 0),
      topAccounts: this.accounts
        .slice()
        .sort((a, b) => b.velocity - a.velocity)
        .slice(0, 5)
        .map((account) => ({ id: account.id, name: account.name, velocity: account.velocity })),
      stamp: this.stamp(),
      syncStale: this.displaySync().stale,
    };
  }

  listAlerts(): ProductAlert[] {
    const alerts: ProductAlert[] = [];
    for (const sku of this.skus) {
      const units = this.unitsForSku(sku.id);
      if (units.available > 0 && units.available < 20) {
        alerts.push({
          id: `al-stock-${sku.id}`,
          kind: "low stock",
          title: `Low available on ${sku.number} ${sku.editionName}`,
          detail: `${units.available} units free against mock velocity. Mock seed.`,
          severity: "action",
          href: "/vauxhall/product/inventory",
        });
      }
    }
    for (const lot of this.lots) {
      if (lot.agingDays >= 60) {
        const sku = this.skuById(lot.skuId);
        alerts.push({
          id: `al-age-${lot.id}`,
          kind: "aging lot",
          title: `Aging lot ${lot.batchLabel}`,
          detail: `${lot.agingDays} days on ${sku ? `${sku.number} ${sku.editionName}` : lot.skuId}. ${lot.coaNote}`,
          severity: "watch",
          href: "/vauxhall/product/inventory",
        });
      }
    }
    for (const run of this.runs) {
      if (run.late) {
        const sku = this.skuById(run.skuId);
        alerts.push({
          id: `al-run-${run.id}`,
          kind: "late run",
          title: `Late production ${run.id}`,
          detail: `${sku ? `${sku.number} ${sku.editionName}` : run.skuId} . ${run.note}`,
          severity: "action",
          href: "/vauxhall/product/production",
        });
      }
    }
    for (const account of this.accounts) {
      const state = this.licenseState(account);
      if (state === "expired" || state === "expiring") {
        alerts.push({
          id: `al-lic-${account.id}`,
          kind: "license expiry",
          title: `${state === "expired" ? "Expired" : "Expiring"} mock license`,
          detail: `${account.name} . ${account.license} . ${account.licenseMark}.`,
          severity: state === "expired" ? "action" : "watch",
          href: "/vauxhall/product/accounts",
        });
      }
      if (account.receivableDays > 45) {
        alerts.push({
          id: `al-ar-${account.id}`,
          kind: "receivables",
          title: `Receivables aging on ${account.name}`,
          detail: `${account.receivableDays} days. Mock book only.`,
          severity: "watch",
          href: "/vauxhall/product/accounts",
        });
      }
    }
    for (const order of this.orders) {
      if (order.late && order.stage !== "delivered" && order.stage !== "paid") {
        alerts.push({
          id: `al-late-${order.id}`,
          kind: "late order",
          title: `Late order ${order.id}`,
          detail: `Promised ${order.promisedOn}. Still ${order.stage}.`,
          severity: "action",
          href: "/vauxhall/product/orders",
        });
      }
    }
    const tags = this.displayTags();
    if (tags && tags.packageTags < tags.packageTagThreshold) {
      alerts.push({
        id: "al-tags-package",
        kind: "low tags",
        title: "Low mock package tag inventory",
        detail: `${tags.packageTags} tags left. Threshold ${tags.packageTagThreshold}.`,
        severity: "action",
        href: "/vauxhall/product/trace",
      });
    }
    if (tags.retailQrIds < tags.retailQrThreshold) {
      alerts.push({
        id: "al-tags-retail",
        kind: "low tags",
        title: "Low mock retail QR inventory",
        detail: `${tags.retailQrIds} retail IDs left. Threshold ${tags.retailQrThreshold}.`,
        severity: "watch",
        href: "/vauxhall/product/trace",
      });
    }
    for (const row of this.listDiscrepancies()) {
      alerts.push({
        id: `al-disc-${row.lotId}`,
        kind: "discrepancy",
        title: `Discrepancy beyond 2 percent on ${row.batchLabel}`,
        detail: `ERP ${row.erpQty} versus Metrc ${row.metrcQty}. Variance ${row.variancePct.toFixed(1)} percent.`,
        severity: "action",
        href: "/vauxhall/product/trace",
      });
    }
    alerts.push({
      id: "al-felix-1",
      kind: "felix flag",
      title: "Felix commercial watch",
      detail: "Mock flag: late Peak run has commercial impact. Not a live Metrc event.",
      severity: "watch",
      href: "/vauxhall/security",
    });
    return alerts;
  }

  listDiscrepancies(): DiscrepancyRow[] {
    const rows: DiscrepancyRow[] = [];
    for (const lot of this.lots) {
      const pack = this.displayPackages().find((item) => item.uid === lot.metrcUid || item.lotId === lot.id);
      if (!pack) continue;
      const pct = variancePercent(lot.onHand, pack.quantity);
      if (pct <= DISCREPANCY_THRESHOLD_PCT) continue;
      const open = this.investigations.find((item) => item.lotId === lot.id && item.state === "open");
      rows.push({
        lotId: lot.id,
        uid: pack.uid,
        batchLabel: lot.batchLabel,
        skuId: lot.skuId,
        erpQty: lot.onHand,
        metrcQty: pack.quantity,
        variancePct: pct,
        investigationId: open?.id,
      });
    }
    return rows;
  }

  listInvestigations(): DiscrepancyInvestigation[] {
    return this.investigations.map((item) => ({ ...item }));
  }

  openInvestigation(lotId: string): { ok: true; id: string; findingId: string } | { ok: false; reason: string } {
    const row = this.listDiscrepancies().find((item) => item.lotId === lotId);
    if (!row) return { ok: false, reason: "No discrepancy above 2 percent on that lot." };
    const existing = this.investigations.find((item) => item.lotId === lotId && item.state === "open");
    if (existing) return { ok: true, id: existing.id, findingId: existing.findingId };
    const findingId = this.raiseFinding({
      severity: "P1",
      source: "Trace discrepancy",
      surface: "Product Trace",
      citation: "NY discrepancy threshold. Variance beyond 2 percent.",
      owner: "Felix",
      due: this.seedClock,
      cite: `ERP quantity and Metrc quantity disagree on ${row.batchLabel}.`,
      remediate: "Investigate the gap. Metrc wins on paper. Do not hide the variance.",
      document: "Mock investigation record attached. Not a live Metrc ticket.",
      state: "open",
      closedEvidence: "",
      openedOn: this.seedClock,
      escape: false,
    });
    this.invSeq += 1;
    const id = `inv-${this.invSeq}`;
    this.investigations.unshift({
      id,
      lotId: row.lotId,
      uid: row.uid,
      batchLabel: row.batchLabel,
      erpQty: row.erpQty,
      metrcQty: row.metrcQty,
      variancePct: row.variancePct,
      findingId,
      state: "open",
    });
    this.pushAlertEvent(
      `Discrepancy beyond 2 percent on ${row.batchLabel}`,
      `ERP ${row.erpQty} versus Metrc ${row.metrcQty}. Felix finding opened. Mock Trace.`,
    );
    this.emit();
    return { ok: true, id, findingId };
  }

  resolveInvestigation(id: string): void {
    const item = this.investigations.find((row) => row.id === id);
    if (!item || item.state !== "open") return;
    item.state = "resolved";
    this.emit();
  }

  async refreshFromMetrc(): Promise<void> {
    if (this.adapterMode === "connect") return;
    const [packages, transfers, facilities, items, tags, sync] = await Promise.all([
      this.trace.getPackages(),
      this.trace.getTransfers(),
      this.trace.getFacilities(),
      this.trace.getItems(),
      this.trace.getTagInventory(),
      this.trace.getSyncStatus(),
    ]);
    this.traceSnap = {
      ...this.traceSnap,
      packages,
      transfers,
      facilities,
      items,
      tags,
      sync,
    };
    for (const lot of this.lots) {
      const pack = packages.find((item) => item.uid === lot.metrcUid || item.lotId === lot.id);
      if (pack) lot.testStatus = pack.testStatus;
    }
    this.emit();
  }

  demoSeedDiscrepancy(): { ok: true; lotId: string } | { ok: false; reason: string } {
    if (this.adapterMode === "connect") {
      return { ok: false, reason: "Demo seed controls are closed in Connect mode." };
    }
    const lot = this.lots.find((item) => item.id === "lot-u1") ?? this.lots.find((item) => item.id !== "lot-p1");
    if (!lot) return { ok: false, reason: "No mock lot available." };
    const metrcQty = Math.max(1, Math.round(lot.onHand * 0.7));
    this.trace.seedDiscrepancy(lot.metrcUid, metrcQty);
    this.traceSnap = this.trace.hydrate();
    this.openInvestigation(lot.id);
    this.emit();
    return { ok: true, lotId: lot.id };
  }

  demoSeedStale(): void {
    if (this.adapterMode === "connect") return;
    this.trace.seedStaleSync();
    this.traceSnap = this.trace.hydrate();
    this.emit();
  }

  advanceRun(id: string): { ok: true; stage: string } | { ok: false; reason: string } {
    const run = this.runs.find((item) => item.id === id);
    if (!run) return { ok: false, reason: "Run not found." };
    const idx = RUN_STAGES.indexOf(run.stage);
    if (idx < 0 || idx >= RUN_STAGES.length - 1) {
      return { ok: false, reason: "Run is already at ready." };
    }
    run.stage = RUN_STAGES[idx + 1] ?? run.stage;
    this.emit();
    return { ok: true, stage: run.stage };
  }

  async completeRun(id: string): Promise<{ ok: true; lotId: string; uid: string } | { ok: false; reason: string }> {
    const run = this.runs.find((item) => item.id === id);
    if (!run) return { ok: false, reason: "Run not found." };
    if (run.stage !== "packaged" && run.stage !== "ready") {
      return { ok: false, reason: "Advance the run to packaged or ready before completing." };
    }
    const sku = this.skuById(run.skuId);
    this.lotSeq += 1;
    const lotId = `lot-${this.lotSeq}`;
    const uid = `MOCK-UID-${this.lotSeq}`;
    const batchLabel = `MOCK-LOT-${this.lotSeq}`;
    const lot: InventoryLot = {
      id: lotId,
      skuId: run.skuId,
      batchLabel,
      metrcUid: uid,
      testStatus: "TestingRequired",
      onHand: run.expectedYield,
      reserved: 0,
      location: "Prototype vault A",
      packagedOn: this.seedClock,
      agingDays: 0,
      coaNote: "No COA on file. Mock seed.",
    };
    this.lots.unshift(lot);
    await this.trace.registerPackage({
      uid,
      lotId,
      skuId: run.skuId,
      itemName: sku?.editionName ?? run.skuId,
      quantity: run.expectedYield,
      testStatus: "TestingRequired",
      packagedOn: this.seedClock,
      location: lot.location,
      labNote: "Mock lab stub. No COA URL.",
    });
    this.traceSnap = this.trace.hydrate();
    run.stage = "ready";
    run.note = `Completed into ${batchLabel}. TestingRequired until mock lab flip.`;
    if (this.labDelayMs > 0) {
      const timer = setTimeout(() => {
        void this.applyLabFlip(uid, "TestPassed");
      }, this.labDelayMs);
      this.labTimers.set(uid, timer);
    }
    this.emit();
    return { ok: true, lotId, uid };
  }

  async applyLabFlip(uid: string, status: TraceTestStatus = "TestPassed"): Promise<void> {
    const existing = this.labTimers.get(uid);
    if (existing) {
      clearTimeout(existing);
      this.labTimers.delete(uid);
    }
    const lot = this.lots.find((item) => item.metrcUid === uid);
    if (lot) lot.testStatus = status;
    await this.trace.setLabStatus(uid, status, this.seedClock);
    this.traceSnap = this.trace.hydrate();
    this.pushAlertEvent(
      `Mock lab flip on ${uid}`,
      `Status ${status}. Test gate now ${isAllocatableStatus(status) ? "open" : "closed"}.`,
    );
    this.emit();
  }

  advanceOrder(id: string): StageAttempt {
    const order = this.orders.find((item) => item.id === id);
    if (!order) return { ok: false, reason: "Order not found." };
    const idx = ORDER_STAGES.indexOf(order.stage);
    if (idx < 0 || idx >= ORDER_STAGES.length - 1) {
      return { ok: false, reason: "Order is already paid." };
    }
    const next = ORDER_STAGES[idx + 1];
    if (order.stage === "in fulfillment" && !order.manifestNumber.trim()) {
      return {
        ok: false,
        reason: "Manifest gate: order cannot move past In Fulfillment without a Metrc transfer manifest number.",
      };
    }
    if (!next) return { ok: false, reason: "Order is already paid." };
    order.stage = next;
    this.emit();
    return { ok: true, stage: order.stage };
  }

  async attachManifest(orderId: string, opts?: { operatorConfirmed?: boolean }): Promise<StageAttempt> {
    const order = this.orders.find((item) => item.id === orderId);
    if (!order) return { ok: false, reason: "Order not found." };
    const account = this.accountById(order.accountId);
    if (!account) return { ok: false, reason: "Account not found." };
    const dest = this.facilityForAccount(account);
    if (!dest) return { ok: false, reason: "Facility gate: no Metrc facility on the account." };
    if (this.adapterMode === "connect") {
      if (opts?.operatorConfirmed !== true) {
        return { ok: false, reason: "Confirm required: operator must confirm this Metrc transfer draft." };
      }
      return {
        ok: false,
        reason: "Connect writes run on the server after operator confirm. This desk does not treat mock Metrc as live.",
      };
    }
    const result = await this.trace.createTransferDraft({
      orderId,
      fromFacilityId: "fac-bond",
      toFacilityId: dest.id,
      operatorConfirmed: opts?.operatorConfirmed,
    });
    if (!result.ok) return result;
    order.manifestNumber = result.transfer.manifestNumber;
    this.traceSnap = this.trace.hydrate();
    this.emit();
    return { ok: true, stage: order.stage };
  }

  setManifestNumber(orderId: string, manifestNumber: string, opts?: { adapterMode?: MetrcAdapterMode }): StageAttempt {
    const order = this.orders.find((item) => item.id === orderId);
    if (!order) return { ok: false, reason: "Order not found." };
    const value = manifestNumber.trim();
    const mode = opts?.adapterMode ?? this.adapterMode;
    if (mode !== "connect" && value && !/mock/i.test(value)) {
      return { ok: false, reason: "Manifest number must be labeled mock." };
    }
    order.manifestNumber = value;
    this.emit();
    return { ok: true, stage: order.stage };
  }

  private pushAlertEvent(summary: string, sub: string): void {
    this.events.unshift({
      id: this.nextId(),
      time: clockTime(),
      agent: "Felix",
      type: "Alert",
      summary,
      sub,
      audit: this.nextAudit(),
    });
  }

  listFindings(): Finding[] {
    return this.findings.map((item) => ({ ...item }));
  }

  scorecard(): SecurityScorecard {
    const windowDays = 30;
    const inWindow = (openedOn: string) => dayDiff(openedOn, this.seedClock) <= windowDays;
    return {
      p0_30d: this.findings.filter((item) => item.severity === "P0" && inWindow(item.openedOn)).length,
      p1_30d: this.findings.filter((item) => item.severity === "P1" && inWindow(item.openedOn)).length,
      open: this.findings.filter((item) => item.state === "open").length,
      escapes_30d: this.findings.filter((item) => item.escape && inWindow(item.openedOn)).length,
    };
  }

  listIncidents(): Incident[] {
    return this.incidents.map((item) => ({
      ...item,
      beats: item.beats?.map((beat) => ({ ...beat })) ?? [],
      linkedFindingIds: item.linkedFindingIds?.slice() ?? (item.findingId ? [item.findingId] : []),
      rollbackStub: item.rollbackStub ?? "M rollback linkage stub. Phase A. No production rollback.",
    }));
  }

  listRules(): SecurityRule[] {
    return this.rules.map((item) => ({
      ...item,
      group: item.group ?? "platform",
      monitorIds: item.monitorIds?.slice() ?? [],
      editable: item.group === "agent conduct" ? false : item.editable !== false,
    }));
  }

  listWaivers(): Waiver[] {
    return this.waivers.map((item) => ({ ...item }));
  }

  listAudit(): AuditRow[] {
    return this.auditRows.map((item) => ({ ...item }));
  }

  listDsar(): DsarRequest[] {
    return this.dsar.map((item) => ({ ...item }));
  }

  listVendors(): Vendor[] {
    return this.vendors.map((item) => ({ ...item }));
  }

  listScanner(): ScannerItem[] {
    return this.scanner.map((item) => ({ ...item }));
  }

  listPreChecks(): PreCheckResult[] {
    return this.prechecks.map((item) => ({ ...item, reasons: item.reasons.slice() }));
  }

  precheckFor(candidate: string): PreCheckResult | undefined {
    return this.prechecks.find((item) => item.candidate === candidate);
  }

  mGateAllows(candidate: string): boolean {
    const result = this.precheckFor(candidate);
    return result?.verdict === "green";
  }

  listSoc2(): Soc2Control[] {
    return this.soc2.map((item) => ({ ...item }));
  }

  soc2Export(): string {
    const lines = [
      "Bond Vauxhall SOC 2 evidence export",
      "Mock seed. Not a live attestation.",
      "",
      ...this.soc2.map((row) => `${row.control}: ${row.evidence}`),
    ];
    return lines.join("\n");
  }

  raiseFinding(input: Omit<Finding, "id">): string {
    this.fid += 1;
    const id = `f-${this.fid}`;
    this.findings.unshift({ ...input, id });
    this.emit();
    return id;
  }

  listSocialPipeline(): SocialPipelineItem[] {
    return this.socialPipeline.map((item) => ({ ...item, auditFlags: item.auditFlags.slice() }));
  }

  listDeskStrips(): SocialDeskStrip[] {
    return this.deskStrips.map((item) => ({ ...item }));
  }

  listResearch(): ResearchRow[] {
    return this.research.map((item) => ({ ...item }));
  }

  listVariations(): ScriptVariation[] {
    return this.variations.map((item) => ({ ...item }));
  }

  listSocialMetrics(): SocialMetric[] {
    return this.socialMetrics.map((item) => ({ ...item }));
  }

  addManualDraft(title: string, body: string): SocialPipelineItem {
    const flags: string[] = [];
    const text = `${title} ${body}`.toLowerCase();
    if (/heal|therap|medic|cure|wellness benefit/.test(text)) flags.push("claims lint");
    if (title.includes("\u2013") || title.includes("\u2014") || body.includes("\u2013") || body.includes("\u2014")) {
      flags.push("dash lint");
    }
    if (!title.trim()) flags.push("voice check");
    flags.push("originality check");
    const id = `d-${200 + this.socialPipeline.length + 1}`;
    const item: SocialPipelineItem = {
      id,
      title: title.trim() || "Untitled mock draft",
      kind: "Manual",
      stage: flags.includes("claims lint") || flags.includes("dash lint") ? "held" : "felix",
      desk: "Create",
      note: "Manual draft. Agent audit attached. Mock seed.",
      approved: false,
      auditFlags: flags,
    };
    this.socialPipeline.unshift(item);
    this.emit();
    return item;
  }

  clearSocialDraft(id: string, actor: "felix" | "owner"): void {
    const item = this.socialPipeline.find((row) => row.id === id);
    if (!item) return;
    if (actor === "felix" && item.stage === "felix") {
      item.stage = "owner";
      item.note = "Felix cleared. Awaiting owner.";
      item.auditFlags = [];
    }
    if (actor === "owner" && (item.stage === "owner" || item.stage === "felix")) {
      item.stage = "approved";
      item.approved = true;
      item.note = "Owner approved. Scheduler still parked.";
    }
    this.emit();
  }

  sendBackDraft(id: string, note: string): void {
    const item = this.socialPipeline.find((row) => row.id === id);
    if (!item) return;
    item.stage = "held";
    item.approved = false;
    item.note = note.trim() || "Sent back. Hold.";
    this.emit();
  }

  attemptSchedule(id: string): ScheduleAttempt {
    const item = this.socialPipeline.find((row) => row.id === id);
    if (!item) return { ok: false, reason: "Draft not found." };
    if (!item.approved) {
      const findingId = this.raiseFinding({
        severity: "P1",
        source: "Felix review",
        surface: "Social Scheduler",
        citation: "Prompt 2 Social. Unapproved posts cannot schedule.",
        owner: "Felix",
        due: this.seedClock,
        cite: "An unapproved social post cannot reach Scheduler.",
        remediate: "Return the draft to Editor.",
        document: "Auto-raised from parked Scheduler. Mock seed.",
        state: "open",
        closedEvidence: "",
        openedOn: this.seedClock,
        escape: false,
      });
      return {
        ok: false,
        reason: "Unapproved post cannot reach Scheduler. P1 finding raised.",
        findingId,
      };
    }
    return { ok: true, note: "Scheduler parked. Prompt 2C stays parked for real Carver publish." };
  }

  listMonitors(): Monitor[] {
    return this.monitors.map((item) => ({
      ...item,
      sparkline: item.sparkline.slice(),
      history: item.history.map((run) => ({ ...run })),
    }));
  }

  listMonitorHistory(id: MonitorId): MonitorRun[] {
    const mon = this.monitors.find((item) => item.id === id);
    return mon ? mon.history.map((run) => ({ ...run })) : [];
  }

  setDemoLive(on: boolean): void {
    this.demoLive = on;
    if (!on) {
      this.emit();
      return;
    }
    this.ensureStandingSecurityChecks();
    this.emit();
  }

  tickMonitorEngine(stepMs = 2000): void {
    if (!this.demoLive) return;
    this.ensureStandingSecurityChecks();
    this.demoElapsed += stepMs;
    for (const mon of this.monitors) {
      if (this.demoElapsed >= mon.nextDueMs) {
        this.runMonitor(mon.id, "schedule");
        mon.nextDueMs = this.demoElapsed + mon.demoCadenceMs;
      }
    }
    this.emit();
  }

  triggerMonitorFailure(id: MonitorId): void {
    this.ensureStandingSecurityChecks();
    this.runMonitor(id, "trigger");
    this.emit();
  }

  ensureStandingSecurityChecks(): void {
    if (this.standingChecksDone) return;
    this.standingChecksDone = true;
    this.applyExpiredWaivers();
    this.flagVendorRenewals();
  }

  applyExpiredWaivers(): string[] {
    const reopened: string[] = [];
    for (const waiver of this.waivers) {
      const expired = waiver.state === "expired" || dayDiff(waiver.expiresOn, this.seedClock) > 0;
      if (!expired) continue;
      waiver.state = "expired";
      const finding = this.findings.find((item) => item.id === waiver.findingId);
      if (!finding || finding.state !== "closed") continue;
      finding.state = "open";
      finding.closedEvidence = "";
      finding.document = "Expired waiver reopened this finding. Mock seed.";
      reopened.push(finding.id);
      this.appendAudit({
        actor: "Felix",
        action: "waiver.expire",
        target: waiver.id,
        note: `Expired waiver ${waiver.id} reopened ${finding.id}.`,
      });
      this.pushMonitorEvent(
        "Felix",
        "Update",
        `Expired waiver ${waiver.id} reopened ${finding.id}`,
        "Automatic. Time box ended.",
      );
    }
    return reopened;
  }

  flagVendorRenewals(): string[] {
    const flagged: string[] = [];
    for (const vendor of this.vendors) {
      const days = dayDiff(this.seedClock, vendor.renewal);
      if (days < 0 || days > 60) continue;
      const existing = this.findings.find(
        (item) => item.source === "Vendor register" && item.surface === vendor.name && item.state === "open",
      );
      if (existing) continue;
      const id = this.raiseFindingSilent({
        severity: "P2",
        source: "Vendor register",
        surface: vendor.name,
        citation: "Vendor DPA renewal inside 60 days.",
        owner: "Felix",
        due: vendor.renewal,
        cite: `${vendor.name} renews ${vendor.renewal}. Inside 60 days.`,
        remediate: "Renew the mock DPA or replace the vendor.",
        document: "Auto-flagged from the vendor register. Mock seed.",
        state: "open",
        closedEvidence: "",
        openedOn: this.seedClock,
        escape: false,
      });
      flagged.push(id);
    }
    return flagged;
  }

  closeFinding(id: string, evidence: string): CloseFindingAttempt {
    const finding = this.findings.find((item) => item.id === id);
    if (!finding) return { ok: false, reason: "Finding not found." };
    if (finding.state === "closed") return { ok: false, reason: "Finding already closed." };
    const text = evidence.trim();
    if (!text) return { ok: false, reason: "Closure requires evidence text." };
    finding.state = "closed";
    finding.closedEvidence = text;
    this.appendAudit({
      actor: "Gary",
      action: "finding.close",
      target: id,
      note: text,
    });
    this.pushMonitorEvent(
      "Felix",
      "Agent Decision",
      `Finding ${id} closed with evidence`,
      text,
    );
    this.emit();
    return { ok: true, id };
  }

  editRule(id: string, patch: { citation?: string; enforcement?: string }): RuleEditAttempt {
    const rule = this.rules.find((item) => item.id === id);
    if (!rule) return { ok: false, reason: "Rule not found." };
    if (rule.group === "agent conduct" || rule.editable === false) {
      return {
        ok: false,
        reason: "Agent-conduct rules are read-only in Phase A. Changes route through Felix and counsel.",
      };
    }
    if (patch.citation !== undefined) rule.citation = patch.citation.trim() || rule.citation;
    if (patch.enforcement !== undefined) rule.enforcement = patch.enforcement.trim() || rule.enforcement;
    this.appendAudit({
      actor: "Gary",
      action: "rule.edit",
      target: id,
      note: "Owner edited a rule. Confirmation recorded.",
    });
    this.pushMonitorEvent("Felix", "Update", `Rule edited: ${rule.name}`, "Owner action with confirmation.");
    this.emit();
    return { ok: true, id };
  }

  ruleGroups(): typeof RULE_GROUPS {
    return RULE_GROUPS;
  }

  findingsForRule(ruleId: string): Finding[] {
    const rule = this.rules.find((item) => item.id === ruleId);
    return this.findings.filter((item) => {
      if (item.monitorId && rule?.monitorIds?.includes(item.monitorId)) return true;
      return item.citation === rule?.citation;
    });
  }

  verifyAuditChain(): AuditVerify {
    const chrono = [...this.auditRows].reverse();
    let prev = AUDIT_GENESIS;
    for (const row of chrono) {
      const expected = mockHash(`${prev}|${row.time}|${row.actor}|${row.action}|${row.target}|${row.note}`);
      if (row.prevHash !== prev || row.hash !== expected) {
        return { ok: false, brokenAt: row.id };
      }
      prev = row.hash ?? expected;
    }
    return { ok: true };
  }

  tamperAudit(): AuditVerify {
    if (this.auditTampered) return this.verifyAuditChain();
    const target = this.auditRows.find((row) => row.id === "aud-02") ?? this.auditRows[1] ?? this.auditRows[0];
    if (!target) return { ok: false, brokenAt: "missing" };
    this.auditBackup = this.auditRows.map((row) => ({ ...row }));
    this.auditTampered = true;
    target.note = `${target.note} [tamper]`;
    const verify = this.verifyAuditChain();
    const existing = this.findings.find((item) => item.monitorId === "audit-integrity" && item.state === "open");
    if (!existing) {
      this.raiseFindingSilent({
        severity: "P0",
        source: "Audit log integrity",
        surface: "Audit Log",
        citation: "Append-only hash chain must verify.",
        owner: "Felix",
        due: this.seedClock,
        cite: "Demo Tamper Test broke the mock hash chain.",
        remediate: "Reset restores the mock chain. No real database write.",
        document: "Phase A tamper is in-store only.",
        state: "open",
        closedEvidence: "",
        openedOn: this.seedClock,
        escape: false,
        monitorId: "audit-integrity",
      });
    }
    const mon = this.monitors.find((item) => item.id === "audit-integrity");
    if (mon) this.markMonitor(mon, "failing", "Hash chain verify failed. Demo Tamper Test.");
    this.pushMonitorEvent(
      "Felix",
      "Alert",
      "ALERT. Audit hash chain failed Tamper Test",
      "P0 banner in Security. Gary page simulated in-wing only. No phone call.",
    );
    this.emit();
    return verify;
  }

  resetAuditChain(): AuditVerify {
    if (this.auditBackup) {
      this.auditRows = this.auditBackup.map((row) => ({ ...row }));
      this.auditBackup = null;
    } else {
      this.sealAuditChain();
    }
    this.auditTampered = false;
    const finding = this.findings.find((item) => item.monitorId === "audit-integrity" && item.state === "open");
    if (finding) {
      finding.state = "closed";
      finding.closedEvidence = "Reset restored the mock chain.";
    }
    const mon = this.monitors.find((item) => item.id === "audit-integrity");
    if (mon) this.markMonitor(mon, "green", "Hash chain verify green after reset.");
    this.appendAudit({
      actor: "Gary",
      action: "audit.reset",
      target: "chain",
      note: "Demo Tamper Test reset. Mock chain restored.",
    });
    this.emit();
    return this.verifyAuditChain();
  }

  p0Banner(): string {
    const open = this.findings.filter((item) => item.severity === "P0" && item.state === "open");
    if (!open.length) return "";
    const first = open[0];
    return `P0 . ${first?.cite ?? "Monitor escalation."} Gary page simulated in-wing only.`;
  }

  runPreCheck(candidate: string): PreCheckResult {
    const reasons: string[] = [];
    let verdict: PreCheckResult["verdict"] = "green";
    if (this.traceSnap.sync.stale) {
      verdict = "blocked";
      reasons.push("Metrc sync stale beyond two cycles. Rule: Metrc sync health.");
    }
    if (candidate === "rc-118" && !this.precheckFixApplied["rc-118"]) {
      verdict = "blocked";
      reasons.push("Seeded violation: claims lint on prototype copy. Rule: Claims-language lint.");
    }
    if (verdict === "green") {
      reasons.push("headers", "CSP", "age gate", "claims lint", "dash lint", "Metrc sync fresh");
    }
    let row = this.prechecks.find((item) => item.candidate === candidate);
    if (!row) {
      row = { id: `pc-${candidate}`, candidate, verdict, reasons };
      this.prechecks.push(row);
    } else {
      row.verdict = verdict;
      row.reasons = reasons.slice();
    }
    const rc = this.rcs.find((item) => item.id === candidate);
    if (rc) {
      rc.note =
        verdict === "green"
          ? "Pre-Check green. Cleared to M gate."
          : `Pre-Check blocked. ${reasons[0] ?? "Rule cited."}`;
    }
    this.appendAudit({
      actor: "Vesper",
      action: "precheck.run",
      target: candidate,
      note: verdict === "green" ? "Green stamped clearance." : reasons.join(" "),
    });
    this.emit();
    return { ...row, reasons: row.reasons.slice() };
  }

  applyPreCheckFix(candidate: string): void {
    this.precheckFixApplied[candidate] = true;
    this.appendAudit({
      actor: "Gary",
      action: "precheck.fix",
      target: candidate,
      note: "Fix Applied. Seeded claims lint cleared. Awaiting rerun.",
    });
    this.emit();
  }

  soc2EvidencePack(now = new Date()): { filename: string; json: string } {
    const y = now.getFullYear();
    const m = pad(now.getMonth() + 1);
    const d = pad(now.getDate());
    const filename = `soc2-evidence-${y}${m}${d}.json`;
    const json = JSON.stringify(
      {
        mock: true,
        note: "Mock evidence pack. Not a live attestation.",
        exportedOn: `${y}-${m}-${d}`,
        families: this.soc2.map((row) => ({
          id: row.id,
          control: row.control,
          family: row.family ?? row.control,
          coverage: row.coverage ?? 0,
          evidence: row.evidence,
          sources: row.sources ?? [],
        })),
      },
      null,
      2,
    );
    return { filename, json };
  }

  dashboardSecurityTrends(): {
    opened90: number;
    closed90: number;
    mttr: { severity: string; days: number }[];
    uptime: { id: string; name: string; pct: number }[];
    escapes: number[];
  } {
    const opened90 = this.findings.filter((item) => dayDiff(item.openedOn, this.seedClock) <= 90).length;
    const closed90 = this.findings.filter(
      (item) => item.state === "closed" && dayDiff(item.openedOn, this.seedClock) <= 90,
    ).length;
    const mttr = (["P0", "P1", "P2", "P3"] as const).map((severity) => {
      const closed = this.findings.filter((item) => item.severity === severity && item.state === "closed");
      if (!closed.length) return { severity, days: 0 };
      const days =
        closed.reduce((sum, item) => sum + Math.max(0, dayDiff(item.openedOn, this.seedClock)), 0) / closed.length;
      return { severity, days: Math.round(days * 10) / 10 };
    });
    const uptime = this.monitors.map((mon) => {
      const runs = mon.history.length;
      const green = mon.history.filter((run) => run.state === "green").length;
      const pct = runs === 0 ? 100 : Math.round((green / runs) * 1000) / 10;
      return { id: mon.id, name: mon.name, pct };
    });
    return {
      opened90,
      closed90,
      mttr,
      uptime,
      escapes: Array.from({ length: 8 }, () => 0),
    };
  }

  private runMonitor(id: MonitorId, origin: "schedule" | "trigger"): void {
    const mon = this.monitors.find((item) => item.id === id);
    if (!mon) return;
    if (origin === "trigger") {
      this.applyTriggeredFailure(mon);
      return;
    }
    if (id === "content-lint" && !this.scriptedLintDone) {
      this.fireLintCatch(mon);
      return;
    }
    if (id === "auth-watch" && this.scriptedLintDone && !this.scriptedLockoutDone) {
      this.fireLockoutBurst(mon);
      return;
    }
    if (id === "metrc-sync") {
      this.evaluateMetrc(mon);
      return;
    }
    if (id === "audit-integrity") {
      this.evaluateAudit(mon);
      return;
    }
    this.markMonitor(mon, "green", `${mon.name} stayed green. Mock probe. No external call.`);
  }

  private fireLintCatch(mon: Monitor): void {
    this.scriptedLintDone = true;
    const copy = mockLintPageCopy();
    const hit = copy.includes(String.fromCharCode(0x2014)) || copy.includes(String.fromCharCode(0x2013));
    const findingId = this.raiseFindingSilent({
      severity: "P2",
      source: "Content lint sweep",
      surface: `mock page ${MOCK_LINT_PAGE}`,
      citation: "Dash lint. Zero em dash or en dash.",
      owner: "Vesper",
      due: this.seedClock,
      cite: `Seeded dash character on mock page ${MOCK_LINT_PAGE} element ${MOCK_LINT_ELEMENT}.`,
      remediate: "Replace the dash character with a period or comma.",
      document: "Monitor opened this finding with evidence. Mock page only.",
      state: "open",
      closedEvidence: "",
      openedOn: this.seedClock,
      escape: false,
      monitorId: mon.id,
    });
    this.recordRun(mon, "failing", `Lint catch on ${MOCK_LINT_PAGE} ${MOCK_LINT_ELEMENT}. Hit=${hit}.`, findingId);
    this.pushMonitorEvent(
      "Vesper",
      "Report",
      `Content lint sweep cited a dash on mock page ${MOCK_LINT_PAGE}`,
      `P2 finding ${findingId} opened. Element ${MOCK_LINT_ELEMENT}. Monitor authority.`,
    );
  }

  private fireLockoutBurst(mon: Monitor): void {
    this.scriptedLockoutDone = true;
    const findingId = this.raiseFindingSilent({
      severity: "P0",
      source: "Auth watch",
      surface: "/haus",
      citation: "Lockouts and bursts on /haus open an incident.",
      owner: "Felix",
      due: this.seedClock,
      cite: "Auth watch registered a lockout burst on /haus.",
      remediate: "Keep the door closed. Review the mock source. Do not revoke real credentials.",
      document: "Monitor opened this finding and assembled the incident timeline.",
      state: "open",
      closedEvidence: "",
      openedOn: this.seedClock,
      escape: false,
      monitorId: mon.id,
    });
    const now = clockTime();
    const beats: IncidentBeat[] = [
      { at: now, kind: "detection", note: "Auth watch saw five failed passwords in one window." },
      { at: now, kind: "action", note: "Incident opened on monitor authority. No credential revoke in Phase A." },
      { at: now, kind: "notification", note: "Gary page simulated in-wing only. No phone call." },
      { at: now, kind: "resolution", note: "Door remained closed. Awaiting owner evidence." },
      { at: now, kind: "root cause", note: "Seeded lockout burst for Demo Live." },
    ];
    this.iid += 1;
    const incidentId = `inc-${this.iid}`;
    this.incidents.unshift({
      id: incidentId,
      title: "Auth watch lockout burst on /haus",
      timeline: beats.map((beat) => `${beat.kind}: ${beat.note}`).join(" "),
      impact: "Admin door stayed closed. No credentials revoked.",
      actions: "In-wing P0 banner. Live Feed ALERT. No phone page.",
      rootCause: "Seeded burst of failed /haus passwords. Mock source only.",
      findingId,
      beats,
      linkedFindingIds: [findingId],
      rollbackStub: "M rollback linkage stub. Phase A. No production rollback.",
    });
    this.recordRun(mon, "failing", "Lockout burst. Incident assembled.", findingId, incidentId);
    this.appendAudit({
      actor: "Felix",
      action: "incident.open",
      target: incidentId,
      note: "Auth watch lockout burst. Simulated page only.",
    });
    this.pushMonitorEvent(
      "Felix",
      "Alert",
      "ALERT. Auth watch lockout burst on /haus",
      "P0 banner in Security. Gary page simulated in-wing only. No phone call.",
    );
  }

  private evaluateMetrc(mon: Monitor): void {
    const stale = this.traceSnap.sync.stale;
    const discs = this.listDiscrepancies().length;
    if (stale) {
      const existing = this.findings.find((item) => item.monitorId === "metrc-sync" && item.state === "open");
      const findingId =
        existing?.id ??
        this.raiseFindingSilent({
          severity: "P1",
          source: "Metrc sync health",
          surface: "Product Trace",
          citation: "Trace staleness beyond two cycles blocks M gate.",
          owner: "Felix",
          due: this.seedClock,
          cite: "Trace mock is stale beyond two cycles.",
          remediate: "Refresh the Trace mock. Live Metrc adapter stays closed.",
          document: "Monitor reads TraceProvider mock only.",
          state: "open",
          closedEvidence: "",
          openedOn: this.seedClock,
          escape: false,
          monitorId: mon.id,
        });
      this.recordRun(mon, "failing", "Trace mock stale. M gate blocked by construction.", findingId);
      return;
    }
    if (discs > 0) {
      this.markMonitor(mon, "degraded", `Trace mock fresh. ${discs} open discrepancies already on Findings.`);
      return;
    }
    this.markMonitor(mon, "green", "Trace mock fresh. Live Metrc adapter stays closed.");
  }

  private evaluateAudit(mon: Monitor): void {
    const verify = this.verifyAuditChain();
    if (!verify.ok) {
      this.markMonitor(mon, "failing", `Hash chain broken at ${verify.brokenAt ?? "unknown"}.`);
      return;
    }
    this.markMonitor(mon, "green", "Hash chain verify green.");
  }

  private applyTriggeredFailure(mon: Monitor): void {
    if (mon.id === "audit-integrity") {
      this.tamperAudit();
      return;
    }
    if (mon.id === "auth-watch") {
      if (!this.scriptedLockoutDone) this.fireLockoutBurst(mon);
      else this.markMonitor(mon, "failing", "Auth watch already holding the lockout burst.");
      return;
    }
    if (mon.id === "content-lint") {
      if (!this.scriptedLintDone) this.fireLintCatch(mon);
      else this.markMonitor(mon, "failing", "Content lint already holding the seeded dash catch.");
      return;
    }
    const severity = failSeverityFor(mon.id);
    const existing = this.findings.find((item) => item.monitorId === mon.id && item.state === "open");
    const findingId =
      existing?.id ??
      this.raiseFindingSilent({
        severity,
        source: mon.name,
        surface: mon.id === "metrc-sync" ? "Product Trace" : "Security Monitors",
        citation: mon.citation,
        owner: "Felix",
        due: this.seedClock,
        cite: `${mon.name} triggered to a failing state. Demo only.`,
        remediate: "Owner Demo Trigger. No real external monitor call.",
        document:
          mon.id === "form-abuse"
            ? "Auto-action throttle is Phase B. Simulated only."
            : "Demo Trigger opened this finding. No production action.",
        state: "open",
        closedEvidence: "",
        openedOn: this.seedClock,
        escape: false,
        monitorId: mon.id,
      });
    this.recordRun(mon, "failing", "Demo Trigger fired this monitor. No external call.", findingId);
    this.pushMonitorEvent(
      "Felix",
      severity === "P0" ? "Alert" : "Report",
      severity === "P0" ? `ALERT. ${mon.name} failing` : `${mon.name} failing`,
      "Demo Trigger. No phone page. No credential revoke.",
    );
  }

  private markMonitor(mon: Monitor, state: MonitorState, note: string): void {
    this.recordRun(mon, state, note);
  }

  private recordRun(
    mon: Monitor,
    state: MonitorState,
    note: string,
    findingId?: string,
    incidentId?: string,
  ): void {
    const at = clockTime();
    this.rid += 1;
    const run: MonitorRun = {
      id: `run-${this.rid}`,
      monitorId: mon.id,
      at,
      state,
      note,
      findingId,
      incidentId,
    };
    mon.state = state;
    mon.lastRun = at;
    mon.nextRun = at;
    mon.sparkline = pushSpark(mon.sparkline, state);
    mon.history = [run, ...mon.history].slice(0, 24);
  }

  private raiseFindingSilent(input: Omit<Finding, "id">): string {
    this.fid += 1;
    const id = `f-${this.fid}`;
    this.findings.unshift({ ...input, id });
    return id;
  }

  private appendAudit(input: Omit<AuditRow, "id" | "time" | "hash" | "prevHash">): void {
    const latest = this.auditRows[0];
    const prev = latest?.hash ?? AUDIT_GENESIS;
    const time = clockTime();
    const body = `${prev}|${time}|${input.actor}|${input.action}|${input.target}|${input.note}`;
    this.auditRows.unshift({
      id: `aud-${400 + this.auditRows.length}`,
      time,
      actor: input.actor,
      action: input.action,
      target: input.target,
      note: input.note,
      prevHash: prev,
      hash: mockHash(body),
    });
  }

  private sealAuditChain(): void {
    const chrono = [...this.auditRows].reverse();
    let prev = AUDIT_GENESIS;
    for (const row of chrono) {
      row.prevHash = prev;
      row.hash = mockHash(`${prev}|${row.time}|${row.actor}|${row.action}|${row.target}|${row.note}`);
      prev = row.hash;
    }
    this.auditRows = chrono.reverse();
  }

  private pushMonitorEvent(agent: AgentName, type: EventType, summary: string, sub: string): void {
    this.events.unshift({
      id: this.nextId(),
      time: clockTime(),
      agent,
      type,
      summary,
      sub,
      audit: this.nextAudit(),
    });
  }

  listMonitorSchedules(): MonitorSchedule[] {
    return this.plumbingSchedules.map((item) => ({ ...item }));
  }

  refreshMonitorSchedules(rows?: MonitorSchedule[]): MonitorSchedule[] {
    this.plumbingSchedules = (rows && rows.length === 14 ? rows : seedMonitorSchedules()).map((item) => ({
      ...item,
      executionMode: "dry-run",
      liveEnabled: false,
    }));
    this.plumbingAudit = appendAuditEvent(this.plumbingAudit, {
      id: `aud-plumb-${this.plumbingAudit.length}`,
      time: clockTime(),
      actor: "Gary",
      action: "schedule.refresh",
      target: "monitor_schedules",
      note: "Owner refreshed schedules. No probe fired.",
    });
    this.emit();
    return this.listMonitorSchedules();
  }

  listPlumbingRuns(): MonitorRun[] {
    return this.plumbingRuns.map((item) => ({ ...item }));
  }

  listPlumbingFindings(): Finding[] {
    return this.plumbingFindings.map((item) => ({ ...item }));
  }

  listPlumbingPreChecks(): PreCheckServerRun[] {
    return this.plumbingPrechecks.map((item) => ({ ...item, reasons: item.reasons.slice() }));
  }

  listPlumbingAudit(): PlumbingAuditEvent[] {
    return this.plumbingAudit.map((item) => ({ ...item }));
  }

  listAutoActions(): AutoActionItem[] {
    return AUTO_ACTION_ALLOWLIST.map((item) => ({ ...item }));
  }

  attemptAutoAction(id: AutoActionItem["id"]): { ok: false; executed: false; reason: string } {
    return executeAutoAction(id);
  }

  weeklyAudit(): WeeklyAuditChecklist {
    return {
      ...VESPER_WEEKLY_AUDIT,
      items: VESPER_WEEKLY_AUDIT.items.map((item) => ({ ...item })),
    };
  }

  shipPrecondition(candidate: string): ShipPrecondition {
    const pre = this.precheckFor(candidate);
    const monitorsGreen = this.monitors.every((item) => item.state === "green");
    const metrc = this.monitors.find((item) => item.id === "metrc-sync");
    return evaluateShipPrecondition({
      candidate,
      preCheckGreen: pre?.verdict === "green",
      monitorsGreen,
      metrcSyncGreen: metrc?.state === "green" && this.traceSnap.sync.stale === false,
    });
  }

  shipPreconditionText(): string {
    return M_SHIP_PRECONDITION_TEXT;
  }

  runPlumbingDry(id: MonitorId, origin: "schedule" | "owner" = "owner"): MonitorRun {
    const at = clockTime();
    const record = runMonitorDry(id, origin, at, this.seedClock, this.plumbingSchedules);
    this.plumbingRid += 1;
    const run: MonitorRun = { id: `prun-${this.plumbingRid}`, ...record.run };
    this.plumbingFid += 1;
    const draft: Finding = { id: `pf-${this.plumbingFid}`, ...record.draft };
    run.findingId = draft.id;
    this.plumbingRuns = [run, ...this.plumbingRuns].slice(0, 48);
    this.plumbingFindings = [draft, ...this.plumbingFindings].slice(0, 48);
    this.plumbingAudit = appendAuditEvent(this.plumbingAudit, {
      id: `aud-plumb-${this.plumbingAudit.length}`,
      time: at,
      actor: "Felix",
      action: "monitor.dry_run",
      target: id,
      note: run.note,
    });
    this.emit();
    return { ...run };
  }

  runAllPlumbingDry(): MonitorRun[] {
    return this.monitors.map((mon) => this.runPlumbingDry(mon.id, "schedule"));
  }

  runPreCheckServerDry(candidate: string): PreCheckServerRun {
    const result = runPreCheckServerDry({
      candidate,
      metrcStale: this.traceSnap.sync.stale,
      claimsLintCleared: this.precheckFixApplied[candidate] === true,
    });
    const existing = this.plumbingPrechecks.find((item) => item.candidate === candidate);
    if (existing) {
      existing.verdict = result.verdict;
      existing.reasons = result.reasons.slice();
    } else {
      this.plumbingPrechecks.push(result);
    }
    this.plumbingAudit = appendAuditEvent(this.plumbingAudit, {
      id: `aud-plumb-${this.plumbingAudit.length}`,
      time: clockTime(),
      actor: "Vesper",
      action: "precheck.server_dry_run",
      target: candidate,
      note: result.verdict === "green" ? "Server dry-run green. Trace mock only." : result.reasons[0] ?? "Blocked.",
    });
    this.emit();
    return { ...result, reasons: result.reasons.slice() };
  }

  ingestScanPayload(payload: unknown): { items: ScannerItem[]; drafts: Finding[] } {
    const ingested = ingestScanArtifact(payload, this.seedClock);
    const items = ingested.items.map((item, index) => ({
      ...item,
      id: `scan-dry-${this.scanner.length + index + 1}`,
    }));
    const drafts = ingested.drafts.map((draft) => {
      this.plumbingFid += 1;
      return { id: `pf-${this.plumbingFid}`, ...draft };
    });
    this.scanner = [...items, ...this.scanner];
    this.plumbingFindings = [...drafts, ...this.plumbingFindings].slice(0, 48);
    this.plumbingAudit = appendAuditEvent(this.plumbingAudit, {
      id: `aud-plumb-${this.plumbingAudit.length}`,
      time: clockTime(),
      actor: "Felix",
      action: "scanner.ingest",
      target: "dependency-secret",
      note: "CI scan mapped into findings drafts. Merge block stays off.",
    });
    this.emit();
    return { items, drafts };
  }

  verifyProductionAudit(): { ok: boolean; note: string } {
    const local = scheduledVerifyJobStub(this.plumbingAudit);
    const checkpoint = checkpointAuditOffsite();
    return {
      ok: local.result.ok,
      note: local.result.ok
        ? `Production chain verify green. ${checkpoint.note}`
        : `Production chain failed at ${local.result.brokenAt ?? "unknown"}.`,
    };
  }

  signOut(): void {
    this.live = false;
    this.demoLive = false;
    this.emit();
  }

  agentSummary(name: AgentName): AgentSummary {
    const events = this.events.filter((event) => event.agent === name).slice(0, 10);
    let status: AgentSummary["status"] = "Active";
    let task = "Standing by";
    let blocker = "";
    if (name === "Vesper") {
      status = "Verifying";
      task = "Verification pass on rc-118";
    }
    if (name === "Carver") {
      status = "Blocked";
      task = "4 social drafts held";
      blocker = "Awaiting Felix originality check";
    }
    if (name === "M") task = "Holding rc-118 at the gate";
    if (name === "Felix") task = "Runtime and pre-check watch";
    if (name === "JB") task = "Routing recommendations to Review";
    if (name === "Q") task = "Ingesting extraction studies";
    if (name === "Moneypenny") task = "Canon version control";
    const recs = name === "M" || name === "JB" || name === "Q" ? 1 : 0;
    return { name, status, task, blocker, events, errors: 0, recs };
  }

  roster(): AgentSummary[] {
    return AGENTS.map((name) => this.agentSummary(name));
  }
}

let singleton: VauxhallStore | null = null;

export function getVauxhallStore(): VauxhallStore {
  if (!singleton) {
    singleton = new VauxhallStore();
  }
  return singleton;
}

export function resetVauxhallStoreForTests(): VauxhallStore {
  singleton = new VauxhallStore({ labDelayMs: 0, traceLatencyMs: 0 });
  return singleton;
}
