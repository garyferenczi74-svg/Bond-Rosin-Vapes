import { EVENT_POOL, SEED_CANON, SEED_DRAFTS, SEED_EVENTS, SEED_RCS, SEED_REVIEW, SEED_TUNING } from "./seed.ts";
import type {
  AgentEvent,
  AgentName,
  AgentSummary,
  CanonDoc,
  EventType,
  QueueSnapshot,
  ReviewItem,
  ReviewState,
  StoreFilter,
  TuningProposal,
} from "./types.ts";
import { AGENTS } from "./types.ts";

export const DEMO_OWNER_EMAIL = "owner@bond.test";
export const SESSION_FLAG_KEY = "bond.vauxhall.session";

type Listener = () => void;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function clockTime(now = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function readSessionFlag(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.sessionStorage.getItem(SESSION_FLAG_KEY);
  if (raw === "0") return false;
  return true;
}

function writeSessionFlag(session: boolean): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_FLAG_KEY, session ? "1" : "0");
}

export class VauxhallStore {
  revision = 0;
  session = true;
  live = false;
  filter: StoreFilter = { agent: null, type: null, allData: false };
  events: AgentEvent[] = [];
  review: ReviewItem[] = [];
  rcs = SEED_RCS.map((item) => ({ ...item }));
  drafts = SEED_DRAFTS.map((item) => ({ ...item }));
  tuning: TuningProposal[] = [];
  canon: CanonDoc[] = [];
  private eid = 100;
  private listeners = new Set<Listener>();
  private persistSession: boolean;

  constructor(options?: { persistSession?: boolean; session?: boolean }) {
    this.persistSession = options?.persistSession ?? false;
    this.session = options?.session ?? (this.persistSession ? readSessionFlag() : true);
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

  private persist(): void {
    if (this.persistSession) writeSessionFlag(this.session);
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
    this.eid = 100;
    this.filter = { agent: null, type: null, allData: false };
    this.live = false;
  }

  hydrateSession(): void {
    if (!this.persistSession) return;
    const next = readSessionFlag();
    if (next !== this.session) {
      this.session = next;
      this.emit();
    }
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

  signOut(): void {
    this.session = false;
    this.live = false;
    this.persist();
    this.emit();
  }

  restoreSession(): void {
    this.session = true;
    this.persist();
    this.emit();
  }

  acceptDemoCredentials(email: string, password: string): boolean {
    return email.trim().toLowerCase() === DEMO_OWNER_EMAIL && password.length > 0;
  }

  acceptDemoMfa(code: string): boolean {
    return code.trim().length === 6;
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
    singleton = new VauxhallStore({ persistSession: typeof window !== "undefined" });
  }
  return singleton;
}

export function resetVauxhallStoreForTests(options?: { session?: boolean }): VauxhallStore {
  singleton = new VauxhallStore({ persistSession: false, session: options?.session ?? true });
  return singleton;
}
