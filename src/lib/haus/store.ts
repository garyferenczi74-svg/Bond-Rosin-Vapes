import { clockStamp, daysUntil, isoDay } from "./dates.ts";
import { lintBlocksPublish, lintFields } from "./lint.ts";
import { SEED_BATCHES, SEED_EVENTS, SEED_GUIDE, SEED_RESERVE, seedHausPersist } from "./seed.ts";
import { normalizeEmail } from "../member.ts";
import {
  PRIVACY_WALL,
  type HausAccount,
  type HausAttention,
  type HausAudit,
  type HausBoardRow,
  type HausDashboard,
  type HausInvitation,
  type HausPersist,
  type HouseWrite,
  type WriteLink,
} from "./types.ts";

type Listener = () => void;

function clonePersist(data: HausPersist): HausPersist {
  return JSON.parse(JSON.stringify(data)) as HausPersist;
}

function nextWriteId(writes: HouseWrite[]): string {
  let max = 0;
  for (const write of writes) {
    const n = Number(String(write.id).replace("HW-", ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `HW-${max + 1}`;
}

function countState<T extends { state: string }>(list: T[], state: string): number {
  return list.filter((item) => item.state === state).length;
}

export class HausStore {
  revision = 0;
  actor = "Gary";
  data: HausPersist;
  private listeners = new Set<Listener>();

  constructor(initial?: HausPersist) {
    this.data = initial ? clonePersist(initial) : seedHausPersist();
    this.data.settings.privacyWall = PRIVACY_WALL;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit(): void {
    this.revision += 1;
    for (const listener of this.listeners) listener();
  }

  snapshot(): HausPersist {
    return clonePersist(this.data);
  }

  hydrate(next: HausPersist): void {
    this.data = clonePersist(next);
    this.data.settings.privacyWall = PRIVACY_WALL;
    this.emit();
  }

  private audit(action: string, before: string, after: string): void {
    const row: HausAudit = {
      ts: clockStamp(),
      actor: this.actor,
      action,
      before,
      after,
    };
    this.data.audit = [row, ...this.data.audit].slice(0, 40);
  }

  listHouseWrites(state?: string): HouseWrite[] {
    const rows = this.data.houseWrites.slice().sort((a, b) => a.order - b.order);
    if (state) return rows.filter((row) => row.state === state);
    return rows;
  }

  publishedWrites(): HouseWrite[] {
    return this.listHouseWrites("published");
  }

  getWrite(id: string): HouseWrite | undefined {
    return this.data.houseWrites.find((row) => row.id === id);
  }

  createHouseWrite(): HouseWrite {
    const write: HouseWrite = {
      id: nextWriteId(this.data.houseWrites),
      title: "",
      body: "",
      link: "",
      from: "",
      until: "",
      order: this.data.houseWrites.length + 1,
      state: "draft",
    };
    this.data.houseWrites = [...this.data.houseWrites, write];
    this.audit(`Created ${write.id}`, "", "draft");
    this.emit();
    return { ...write };
  }

  updateHouseWrite(
    id: string,
    patch: Partial<Pick<HouseWrite, "title" | "body" | "link" | "from" | "order">>,
  ): HouseWrite | undefined {
    const write = this.getWrite(id);
    if (write == null) return undefined;
    if (typeof patch.title === "string") write.title = patch.title;
    if (typeof patch.body === "string") write.body = patch.body.slice(0, 90);
    if (typeof patch.link === "string") write.link = patch.link as WriteLink;
    if (typeof patch.from === "string") write.from = patch.from;
    if (typeof patch.order === "number" && Number.isFinite(patch.order)) write.order = patch.order;
    this.emit();
    return { ...write };
  }

  publishHouseWrite(id: string): { ok: boolean; hits: ReturnType<typeof lintFields> } {
    const write = this.getWrite(id);
    if (write == null) return { ok: false, hits: [] };
    const hits = lintFields([write.title, write.body]);
    if (lintBlocksPublish(hits)) return { ok: false, hits };
    const before = write.state;
    write.state = "published";
    this.audit(`Published House Write ${id}`, before, "published");
    this.emit();
    return { ok: true, hits: [] };
  }

  retireHouseWrite(id: string): boolean {
    const write = this.getWrite(id);
    if (write == null) return false;
    const before = write.state;
    write.state = "retired";
    this.audit(`Retired ${id}`, before, "retired");
    this.emit();
    return true;
  }

  listInvitations(): HausInvitation[] {
    return this.data.invitations.map((row) => ({ ...row }));
  }

  listHausEmails(): string[] {
    return this.data.hausList.slice();
  }

  listAccounts(): HausAccount[] {
    return this.data.accounts.map((row) => ({ ...row }));
  }

  issueInvitation(email: string): { ok: boolean; reason?: string } {
    if (this.data.settings.invitationWindow === false) {
      return { ok: false, reason: "Invitation window is closed." };
    }
    const norm = normalizeEmail(email);
    if (this.data.hausList.includes(norm) === false) {
      return { ok: false, reason: "Choose a Haus email." };
    }
    this.data.hausList = this.data.hausList.filter((item) => item !== norm);
    this.data.invitations = [
      {
        email: norm,
        state: "issued",
        issued: isoDay(0),
        expires: isoDay(30),
      },
      ...this.data.invitations,
    ];
    this.audit(`Issued invitation ${norm}`, "", "issued");
    this.emit();
    return { ok: true };
  }

  reissueInvitation(email: string): { ok: boolean } {
    const invite = this.data.invitations.find((row) => row.email === normalizeEmail(email));
    if (invite == null) return { ok: false };
    if (invite.state === "issued" || invite.state === "accepted") return { ok: false };
    const before = invite.state;
    invite.state = "issued";
    invite.issued = isoDay(0);
    invite.expires = isoDay(30);
    this.audit(`Reissued invitation ${invite.email}`, before, "issued");
    this.emit();
    return { ok: true };
  }

  revokeInvitation(email: string): { ok: boolean } {
    const invite = this.data.invitations.find((row) => row.email === normalizeEmail(email));
    if (invite == null) return { ok: false };
    if (invite.state === "issued") {
      const before = invite.state;
      invite.state = "revoked";
      this.audit(`Revoked invitation ${invite.email}`, before, "revoked");
      this.emit();
      return { ok: true };
    }
    return { ok: false };
  }

  acceptInvitation(email: string): { ok: boolean } {
    const norm = normalizeEmail(email);
    const invite = this.data.invitations.find((row) => row.email === norm);
    if (invite == null || invite.state !== "issued") return { ok: false };
    const before = invite.state;
    invite.state = "accepted";
    const existing = this.data.accounts.find((row) => row.email === norm);
    if (existing) {
      existing.state = "active";
    } else {
      this.data.accounts = [...this.data.accounts, { email: norm, state: "active" }];
    }
    this.audit(`Accepted invitation ${norm}`, before, "accepted");
    this.emit();
    return { ok: true };
  }

  expireIfNeeded(email: string): void {
    const invite = this.data.invitations.find((row) => row.email === normalizeEmail(email));
    if (invite == null || invite.state !== "issued") return;
    if (daysUntil(invite.expires) < 0) {
      const before = invite.state;
      invite.state = "expired";
      this.audit(`Expired invitation ${invite.email}`, before, "expired");
      this.emit();
    }
  }

  setInvitationWindow(open: boolean): void {
    const before = String(this.data.settings.invitationWindow);
    this.data.settings.invitationWindow = open;
    this.audit(`Setting invitationWindow to ${open}`, before, String(open));
    this.emit();
  }

  setRegistrationPause(paused: boolean): void {
    const before = String(this.data.settings.registrationPause);
    this.data.settings.registrationPause = paused;
    this.audit(`Setting registrationPause to ${paused}`, before, String(paused));
    this.emit();
  }

  setWelcomeText(text: string): { ok: boolean; hits: ReturnType<typeof lintFields> } {
    const hits = lintFields([text]);
    if (lintBlocksPublish(hits)) return { ok: false, hits };
    const before = this.data.settings.welcomeText;
    this.data.settings.welcomeText = text;
    this.audit("Edited welcome text", before, text);
    this.emit();
    return { ok: true, hits: [] };
  }

  welcomeText(): string {
    return this.data.settings.welcomeText;
  }

  privacyWall(): string {
    return PRIVACY_WALL;
  }

  settings() {
    return {
      invitationWindow: this.data.settings.invitationWindow,
      registrationPause: this.data.settings.registrationPause,
      welcomeText: this.data.settings.welcomeText,
      privacyWall: PRIVACY_WALL,
    };
  }

  noteCount(batch: string): number {
    const row = SEED_BATCHES.find((item) => item.batch === batch);
    return row ? row.shelfCount : 0;
  }

  attention(): HausAttention[] {
    const out: HausAttention[] = [];
    for (const write of this.data.houseWrites) {
      if (write.state === "draft" && lintFields([write.title, write.body]).length > 0) {
        out.push({
          kind: "Lint blocked draft",
          text: write.title || write.id,
          href: `/vauxhall/haus/content?write=${write.id}`,
          resolve: "phase-a",
        });
      }
    }
    for (const invite of this.data.invitations) {
      if (invite.state === "issued") {
        const days = daysUntil(invite.expires);
        if (days >= 0 && days <= 7) {
          out.push({
            kind: "Invitation expiring",
            text: `${invite.email} in ${days} days`,
            href: "/vauxhall/haus/members",
            resolve: "phase-a",
          });
        }
      }
    }
    for (const event of SEED_EVENTS) {
      if (event.state === "open" && event.confirmed >= event.capacity * 0.9) {
        out.push({
          kind: "Event near capacity",
          text: `${event.name} ${event.confirmed} of ${event.capacity}`,
          href: "/vauxhall/haus/events",
          resolve: "parked",
        });
      }
    }
    for (const batch of SEED_BATCHES) {
      if (batch.state !== "retired" && batch.coa === "") {
        out.push({
          kind: "Batch missing COA",
          text: `${batch.batch} cannot publish`,
          href: "/vauxhall/haus/batches",
          resolve: "parked",
        });
      }
    }
    return out;
  }

  activity(limit = 20): HausAudit[] {
    return this.data.audit.slice(0, limit).map((row) => ({ ...row }));
  }

  dashboard(): HausDashboard {
    const writes = this.data.houseWrites;
    const writeLint = (state: string) =>
      writes.filter(
        (row) => row.state === state && state === "draft" && lintFields([row.title, row.body]).length > 0,
      ).length;
    const board: HausBoardRow[] = [
      {
        id: "writes",
        label: "House Writes",
        href: "/vauxhall/haus/content",
        live: true,
        draft: countState(writes, "draft"),
        published: countState(writes, "published"),
        retired: countState(writes, "retired"),
        lintBlocked: writeLint("draft"),
      },
      {
        id: "batches",
        label: "Batches",
        href: "/vauxhall/haus/batches",
        live: false,
        draft: countState(SEED_BATCHES, "draft"),
        published: countState(SEED_BATCHES, "published"),
        retired: countState(SEED_BATCHES, "retired"),
        lintBlocked: 0,
      },
      {
        id: "guide",
        label: "Guide chapters",
        href: "/vauxhall/haus/guide",
        live: false,
        draft: countState(SEED_GUIDE, "draft"),
        published: countState(SEED_GUIDE, "published"),
        retired: countState(SEED_GUIDE, "retired"),
        lintBlocked: 0,
      },
      {
        id: "events",
        label: "Events",
        href: "/vauxhall/haus/events",
        live: false,
        draft: countState(SEED_EVENTS, "draft"),
        published: countState(SEED_EVENTS, "published"),
        retired: countState(SEED_EVENTS, "retired"),
        lintBlocked: 0,
      },
    ];
    const invites = this.data.invitations;
    const issuedTotal = invites.length;
    const accepted = countState(invites, "accepted");
    const expired = countState(invites, "expired");
    return {
      activeMembers: this.data.accounts.filter((row) => row.state === "active").length,
      invitationsOut: countState(invites, "issued"),
      shelvesHolding: this.data.counts.activeShelves,
      ritualsThisMonth: this.data.counts.ritualsThisMonth,
      notesHeld: this.data.counts.notesHeld,
      houseWritesLive: countState(writes, "published"),
      board,
      invitationFunnel: {
        issued: issuedTotal,
        accepted,
        expired,
        conversion: issuedTotal > 0 ? Math.round((accepted / issuedTotal) * 100) : 0,
      },
      events: SEED_EVENTS.filter((row) => row.state === "open"),
      reserve: SEED_RESERVE.find((row) => row.state === "open") ?? null,
      attention: this.attention(),
      activity: this.activity(20),
    };
  }
}

let singleton: HausStore | null = null;

export function getHausStore(): HausStore {
  if (singleton == null) singleton = new HausStore();
  return singleton;
}

export function resetHausStoreForTests(initial?: HausPersist): HausStore {
  singleton = new HausStore(initial);
  return singleton;
}
