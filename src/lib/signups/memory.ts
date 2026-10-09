import { randomUUID } from "node:crypto";
import { HAUS_CONFIRM_TOKEN_MS } from "./haus-updates.ts";
import { SEED_PARTNER_ACCOUNTS } from "../order/seed.ts";
import type {
  DispensaryRecord,
  DispensaryStatus,
  HausSessionView,
  HausSignupRecord,
  HausUpdateRecord,
  OrderLineRecord,
  OrderRequestRecord,
  SignupLedger,
} from "./types.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

type DispensarySessionRow = { id: string; accountId: string; expiresAt: number };
type HausSessionRow = { id: string; email: string; expiresAt: number };

function nowIso() {
  return new Date().toISOString();
}

function seedRecords(): DispensaryRecord[] {
  const stamped = nowIso();
  return SEED_PARTNER_ACCOUNTS.map((row) => ({
    id: row.accountId,
    dispensaryName: row.dispensaryName,
    address: row.address,
    contactName: row.contactName,
    phone: row.phone,
    ocmLicense: row.license,
    email: row.email,
    passwordHash: row.passwordHash,
    passwordSalt: row.passwordSalt,
    age21AckAt: stamped,
    status: row.elevated ? "approved" : "pending",
    createdAt: stamped,
    updatedAt: stamped,
    lastActiveAt: stamped,
    closedAt: null,
  }));
}

export class MemorySignupStore {
  readonly source = "memory" as const;
  private accounts = new Map<string, DispensaryRecord>();
  private dispensarySessions = new Map<string, DispensarySessionRow>();
  private orders: OrderRequestRecord[] = [];
  private haus: HausSignupRecord[] = [];
  private hausSessions = new Map<string, HausSessionRow>();
  private updates = new Map<string, HausUpdateRecord>();
  private updateHmac = new Map<string, string>();
  private updateSuppression = new Set<string>();
  private updateTokens = new Map<string, { emailHmac: string; purpose: "unsub" | "confirm"; expiresAt: string | null }>();

  constructor() {
    for (const row of seedRecords()) this.accounts.set(row.id, row);
  }

  listAccounts(): DispensaryRecord[] {
    return [...this.accounts.values()].map((row) => ({ ...row }));
  }

  insertDispensary(input: Omit<DispensaryRecord, "id" | "status" | "createdAt" | "updatedAt"> & { id?: string }): DispensaryRecord {
    const email = input.email.trim().toLowerCase();
    const license = input.ocmLicense.trim().toUpperCase();
    for (const row of this.accounts.values()) {
      if (row.email === email || row.ocmLicense === license) {
        throw new Error("Account already exists.");
      }
    }
    const stamped = nowIso();
    const row: DispensaryRecord = {
      ...input,
      email,
      ocmLicense: license,
      id: input.id || randomUUID(),
      status: "pending",
      createdAt: stamped,
      updatedAt: stamped,
      lastActiveAt: stamped,
      closedAt: null,
    };
    this.accounts.set(row.id, row);
    return { ...row };
  }

  setStatus(id: string, status: DispensaryStatus): DispensaryRecord | null {
    const row = this.accounts.get(id);
    if (!row) return null;
    if (status === "rejected" && row.status !== "rejected" && !row.closedAt) {
      row.closedAt = nowIso();
    }
    row.status = status;
    row.updatedAt = nowIso();
    return { ...row };
  }

  openDispensarySession(accountId: string): string {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error("Account not found.");
    account.lastActiveAt = nowIso();
    account.updatedAt = account.lastActiveAt;
    const id = randomUUID();
    this.dispensarySessions.set(id, { id, accountId, expiresAt: Date.now() + DAY_MS });
    return id;
  }

  accountForDispensarySession(sessionId: string): DispensaryRecord | null {
    const session = this.dispensarySessions.get(sessionId);
    if (!session || session.expiresAt <= Date.now()) return null;
    const account = this.accounts.get(session.accountId);
    return account ? { ...account } : null;
  }

  closeDispensarySession(sessionId: string): void {
    this.dispensarySessions.delete(sessionId);
  }

  insertOrder(input: {
    dispensaryAccountId: string;
    lines: OrderLineRecord[];
    promisedOn: string;
    notes: string;
  }): OrderRequestRecord {
    const account = this.accounts.get(input.dispensaryAccountId);
    if (!account) throw new Error("Account not found.");
    if (account.status !== "approved") throw new Error("Account is not approved.");
    const row: OrderRequestRecord = {
      id: randomUUID(),
      dispensaryAccountId: input.dispensaryAccountId,
      lines: input.lines.map((line) => ({ skuId: line.skuId, format: line.format, qty: line.qty })),
      promisedOn: input.promisedOn,
      notes: input.notes,
      createdAt: nowIso(),
    };
    account.lastActiveAt = row.createdAt;
    account.updatedAt = row.createdAt;
    this.orders.unshift(row);
    return { ...row, lines: row.lines.map((line) => ({ ...line })) };
  }

  openHausSession(email: string): string {
    const id = randomUUID();
    this.hausSessions.set(id, { id, email: email.trim().toLowerCase(), expiresAt: Date.now() + DAY_MS });
    return id;
  }

  readHausSession(sessionId: string): HausSessionView | null {
    const session = this.hausSessions.get(sessionId);
    if (!session || session.expiresAt <= Date.now()) return null;
    const signup = this.haus.find((row) => row.email === session.email) ?? null;
    return { email: session.email, signup: signup ? { ...signup } : null };
  }

  closeHausSession(sessionId: string): void {
    this.hausSessions.delete(sessionId);
  }

  hasHausAge21Ack(email: string): boolean {
    const mark = email.trim().toLowerCase();
    return this.haus.some((row) => row.email === mark && row.age21Ack === true);
  }

  recordHausSignup(email: string, requestedDispensary = ""): HausSignupRecord {
    const mark = email.trim().toLowerCase();
    const dispensary = requestedDispensary.trim().replace(/\s+/g, " ");
    const existing = this.haus.find((row) => row.email === mark);
    if (existing) {
      if (!existing.requestedDispensary && dispensary) existing.requestedDispensary = dispensary;
      return { ...existing };
    }
    const stamped = nowIso();
    const row: HausSignupRecord = {
      id: randomUUID(),
      email: mark,
      age21Ack: true,
      age21AckAt: stamped,
      requestedDispensary: dispensary,
      createdAt: stamped,
    };
    this.haus.unshift(row);
    return { ...row };
  }

  recordHausUpdate(
    email: string,
    source: string,
    emailHmac: string,
  ): { ok: boolean; reason?: string } {
    const mark = email.trim().toLowerCase();
    const origin = source.trim();
    if (!mark || !origin || !emailHmac) return { ok: false, reason: "closed" };
    if (this.updateSuppression.has(emailHmac)) return { ok: false, reason: "suppressed" };
    if (!this.updates.has(mark)) {
      this.updates.set(mark, {
        email: mark,
        consentAt: nowIso(),
        source: origin,
        confirmedAt: null,
      });
      this.updateHmac.set(mark, emailHmac);
    }
    return { ok: true };
  }

  issueHausUpdateToken(emailHmac: string, purpose: "unsub" | "confirm"): { id: string } {
    const id = randomUUID();
    const expiresAt = purpose === "confirm" ? new Date(Date.now() + HAUS_CONFIRM_TOKEN_MS).toISOString() : null;
    this.updateTokens.set(id, { emailHmac, purpose, expiresAt });
    return { id };
  }

  readHausUpdateToken(id: string): { emailHmac: string; purpose: "unsub" | "confirm"; expiresAt: string | null } | null {
    const row = this.updateTokens.get(id);
    return row ? { ...row } : null;
  }

  setHausUpdateTokenExpiry(id: string, expiresAt: string | null): void {
    const row = this.updateTokens.get(id);
    if (!row) return;
    row.expiresAt = expiresAt;
  }

  unsubscribeHausUpdate(emailHmac: string): { ok: boolean } {
    for (const [email, hmac] of this.updateHmac) {
      if (hmac === emailHmac) {
        this.updates.delete(email);
        this.updateHmac.delete(email);
      }
    }
    for (const [id, token] of [...this.updateTokens]) {
      if (token.emailHmac === emailHmac) this.updateTokens.delete(id);
    }
    if (emailHmac) this.updateSuppression.add(emailHmac);
    return { ok: true };
  }

  confirmHausUpdate(emailHmac: string): { ok: boolean } {
    for (const [email, hmac] of this.updateHmac) {
      if (hmac !== emailHmac) continue;
      const row = this.updates.get(email);
      if (!row) return { ok: false };
      if (!row.confirmedAt) row.confirmedAt = nowIso();
      return { ok: true };
    }
    return { ok: false };
  }

  listHausUpdates(): HausUpdateRecord[] {
    return [...this.updates.values()].map((row) => ({ ...row }));
  }

  ledger(): SignupLedger {
    return {
      source: "memory",
      dispensaries: [...this.accounts.values()].map((row) => ({
        id: row.id,
        dispensaryName: row.dispensaryName,
        email: row.email,
        ocmLicense: row.ocmLicense,
        status: row.status,
        createdAt: row.createdAt,
      })),
      orders: this.orders.map((row) => ({
        id: row.id,
        dispensaryAccountId: row.dispensaryAccountId,
        promisedOn: row.promisedOn,
        lineCount: row.lines.length,
        createdAt: row.createdAt,
      })),
      haus: this.haus.map((row) => ({
        id: row.id,
        email: row.email,
        age21Ack: row.age21Ack,
        age21AckAt: row.age21AckAt,
        requestedDispensary: row.requestedDispensary,
      })),
      updates: this.listHausUpdates(),
    };
  }
}
