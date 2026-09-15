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
import type {
  AgentEvent,
  AgentName,
  AgentSummary,
  AuditRow,
  CanonDoc,
  CollectionFrame,
  DashboardSnapshot,
  DsarRequest,
  EventType,
  Finding,
  Incident,
  InventoryLot,
  LicenseState,
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
  StoreFilter,
  TuningProposal,
  Vendor,
  Waiver,
  WholesaleAccount,
  WholesaleOrder,
} from "./types.ts";
import { AGENTS } from "./types.ts";

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
  private eid = 100;
  private oid = 1100;
  private fid = 40;
  private listeners = new Set<Listener>();

  constructor() {
    this.seed();
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
    this.seedClock = SEED_CLOCK;
    this.eid = 100;
    this.oid = 1100;
    this.fid = 40;
    this.filter = { agent: null, type: null, allData: false };
    this.live = false;
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

  canOrderAgainst(accountId: string): boolean {
    const account = this.accountById(accountId);
    if (!account) return false;
    return this.licenseState(account) !== "expired";
  }

  listOrders(): WholesaleOrder[] {
    return this.orders.map((item) => ({ ...item, lines: cloneLines(item.lines) }));
  }

  availableForSku(skuId: string): number {
    return this.unitsForSku(skuId).available;
  }

  createOrder(input: {
    accountId: string;
    lines: OrderLine[];
    promisedOn: string;
    documents?: string;
  }): OrderAttempt {
    if (!this.canOrderAgainst(input.accountId)) {
      return { ok: false, reason: "Expired mock license. Order blocked." };
    }
    if (!input.lines.length) {
      return { ok: false, reason: "Add at least one line." };
    }
    const needed = new Map<string, number>();
    for (const line of input.lines) {
      needed.set(line.skuId, (needed.get(line.skuId) ?? 0) + line.qty);
    }
    for (const [skuId, qty] of needed) {
      if (this.availableForSku(skuId) < qty) {
        return { ok: false, reason: "Reserved stock cannot be double allocated." };
      }
    }
    for (const [skuId, qty] of needed) {
      let remain = qty;
      for (const lot of this.lots.filter((row) => row.skuId === skuId)) {
        const free = lot.onHand - lot.reserved;
        const take = Math.min(free, remain);
        lot.reserved += take;
        remain -= take;
        if (remain <= 0) break;
      }
    }
    this.oid += 1;
    const id = `ord-${this.oid}`;
    this.orders.unshift({
      id,
      accountId: input.accountId,
      stage: "draft",
      promisedOn: input.promisedOn || this.seedClock,
      late: false,
      lines: cloneLines(input.lines),
      documents: input.documents || "Mock draft. Not a live order.",
    });
    this.emit();
    return { ok: true, id };
  }

  createAccount(input: {
    name: string;
    license: string;
    expiresOn: string;
    contact: string;
    terms: string;
    region: string;
  }): { ok: true; id: string } | { ok: false; reason: string } {
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
    this.accounts.push({
      id,
      name: input.name.trim(),
      license: input.license.trim(),
      licenseMark: "mock/prototype",
      expiresOn: input.expiresOn,
      contact: input.contact.trim() || "unset@example.test",
      terms: input.terms.trim() || "Net 15 mock",
      region: input.region.trim() || "Unset",
      velocity: 0,
      notes: "Added from mock intake.",
      receivableDays: 0,
    });
    this.emit();
    return { ok: true, id };
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
        });
      }
      if (account.receivableDays > 45) {
        alerts.push({
          id: `al-ar-${account.id}`,
          kind: "receivables",
          title: `Receivables aging on ${account.name}`,
          detail: `${account.receivableDays} days. Mock book only.`,
          severity: "watch",
        });
      }
    }
    alerts.push({
      id: "al-felix-1",
      kind: "felix flag",
      title: "Felix commercial watch",
      detail: "Mock flag: late Peak run has commercial impact. Not a live Metrc event.",
      severity: "watch",
    });
    return alerts;
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
    return this.incidents.map((item) => ({ ...item }));
  }

  listRules(): SecurityRule[] {
    return this.rules.map((item) => ({ ...item }));
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

  signOut(): void {
    this.live = false;
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
  singleton = new VauxhallStore();
  return singleton;
}
