import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRole } from "@/lib/supabase/service";
import type {
  DispensaryRecord,
  HausSessionView,
  HausSignupRecord,
  OrderLineRecord,
  OrderRequestRecord,
  SignupLedger,
} from "./types.ts";

const DAY_SECONDS = 60 * 60 * 24;

type AccountRow = {
  id: string;
  dispensary_name: string;
  address: string;
  contact_name: string;
  phone: string;
  ocm_license: string;
  email: string;
  password_hash: string;
  password_salt: string;
  age21_ack_at: string;
  status: DispensaryRecord["status"];
  created_at: string;
  updated_at: string;
};

function mapAccount(row: AccountRow): DispensaryRecord {
  return {
    id: row.id,
    dispensaryName: row.dispensary_name,
    address: row.address,
    contactName: row.contact_name,
    phone: row.phone,
    ocmLicense: row.ocm_license,
    email: row.email,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    age21AckAt: row.age21_ack_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function client(): SupabaseClient {
  return createSupabaseServiceRole() as unknown as SupabaseClient;
}

export class RemoteSignupStore {
  readonly source = "supabase" as const;

  async listAccounts(): Promise<DispensaryRecord[]> {
    const { data, error } = await client()
      .from("dispensary_accounts")
      .select("id, dispensary_name, address, contact_name, phone, ocm_license, email, password_hash, password_salt, age21_ack_at, status, created_at, updated_at");
    if (error) throw new Error("Dispensary accounts are unavailable.");
    return ((data ?? []) as AccountRow[]).map(mapAccount);
  }

  async insertDispensary(input: Omit<DispensaryRecord, "id" | "status" | "createdAt" | "updatedAt">): Promise<DispensaryRecord> {
    const { data, error } = await client()
      .from("dispensary_accounts")
      .insert({
        dispensary_name: input.dispensaryName,
        address: input.address,
        contact_name: input.contactName,
        phone: input.phone,
        ocm_license: input.ocmLicense.trim().toUpperCase(),
        email: input.email.trim().toLowerCase(),
        password_hash: input.passwordHash,
        password_salt: input.passwordSalt,
        age21_ack_at: input.age21AckAt,
        status: "pending",
      })
      .select("id, dispensary_name, address, contact_name, phone, ocm_license, email, password_hash, password_salt, age21_ack_at, status, created_at, updated_at")
      .single();
    if (error || !data) throw new Error("Dispensary account was not stored.");
    return mapAccount(data as AccountRow);
  }

  async openDispensarySession(accountId: string): Promise<string> {
    const expires = new Date(Date.now() + DAY_SECONDS * 1000).toISOString();
    const { data, error } = await client()
      .from("dispensary_sessions")
      .insert({ account_id: accountId, expires_at: expires })
      .select("id")
      .single();
    if (error || !data) throw new Error("Dispensary session was not stored.");
    return String((data as { id: string }).id);
  }

  async accountForDispensarySession(sessionId: string): Promise<DispensaryRecord | null> {
    const { data: session, error } = await client()
      .from("dispensary_sessions")
      .select("account_id, expires_at")
      .eq("id", sessionId)
      .maybeSingle();
    if (error || !session) return null;
    const row = session as { account_id: string; expires_at: string };
    if (Date.parse(row.expires_at) <= Date.now()) return null;
    const { data: account, error: accountError } = await client()
      .from("dispensary_accounts")
      .select("id, dispensary_name, address, contact_name, phone, ocm_license, email, password_hash, password_salt, age21_ack_at, status, created_at, updated_at")
      .eq("id", row.account_id)
      .maybeSingle();
    if (accountError || !account) return null;
    return mapAccount(account as AccountRow);
  }

  async closeDispensarySession(sessionId: string): Promise<void> {
    await client().from("dispensary_sessions").delete().eq("id", sessionId);
  }

  async insertOrder(input: {
    dispensaryAccountId: string;
    lines: OrderLineRecord[];
    promisedOn: string;
    notes: string;
  }): Promise<OrderRequestRecord> {
    const account = await this.accountById(input.dispensaryAccountId);
    if (!account || account.status !== "approved") throw new Error("Account is not approved.");
    const lines = input.lines.map((line) => ({ skuId: line.skuId, format: line.format, qty: line.qty }));
    const { data, error } = await client()
      .from("order_requests")
      .insert({
        dispensary_account_id: input.dispensaryAccountId,
        lines,
        promised_on: input.promisedOn,
        notes: input.notes,
      })
      .select("id, dispensary_account_id, lines, promised_on, notes, created_at")
      .single();
    if (error || !data) throw new Error("Order request was not stored.");
    const row = data as {
      id: string;
      dispensary_account_id: string;
      lines: OrderLineRecord[];
      promised_on: string;
      notes: string;
      created_at: string;
    };
    return {
      id: row.id,
      dispensaryAccountId: row.dispensary_account_id,
      lines: row.lines,
      promisedOn: row.promised_on,
      notes: row.notes ?? "",
      createdAt: row.created_at,
    };
  }

  async openHausSession(email: string): Promise<string> {
    const expires = new Date(Date.now() + DAY_SECONDS * 1000).toISOString();
    const { data, error } = await client()
      .from("haus_sessions")
      .insert({ email: email.trim().toLowerCase(), expires_at: expires })
      .select("id")
      .single();
    if (error || !data) throw new Error("Haus session was not stored.");
    return String((data as { id: string }).id);
  }

  async readHausSession(sessionId: string): Promise<HausSessionView | null> {
    const { data, error } = await client()
      .from("haus_sessions")
      .select("email, expires_at")
      .eq("id", sessionId)
      .maybeSingle();
    if (error || !data) return null;
    const session = data as { email: string; expires_at: string };
    if (Date.parse(session.expires_at) <= Date.now()) return null;
    const { data: signup } = await client()
      .from("haus_signups")
      .select("id, email, age21_ack_at, created_at")
      .eq("email", session.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      email: session.email,
      signup: signup
        ? {
            id: (signup as HausSignupRecord & { age21_ack_at: string; created_at: string }).id,
            email: (signup as { email: string }).email,
            age21AckAt: (signup as { age21_ack_at: string }).age21_ack_at,
            createdAt: (signup as { created_at: string }).created_at,
          }
        : null,
    };
  }

  async closeHausSession(sessionId: string): Promise<void> {
    await client().from("haus_sessions").delete().eq("id", sessionId);
  }

  async recordHausSignup(email: string): Promise<HausSignupRecord> {
    const mark = email.trim().toLowerCase();
    const { data: existing } = await client()
      .from("haus_signups")
      .select("id, email, age21_ack_at, created_at")
      .eq("email", mark)
      .limit(1)
      .maybeSingle();
    if (existing) {
      const row = existing as { id: string; email: string; age21_ack_at: string; created_at: string };
      return { id: row.id, email: row.email, age21AckAt: row.age21_ack_at, createdAt: row.created_at };
    }
    const { data, error } = await client()
      .from("haus_signups")
      .insert({ email: mark, age21_ack_at: new Date().toISOString() })
      .select("id, email, age21_ack_at, created_at")
      .single();
    if (error || !data) throw new Error("Haus sign-up was not stored.");
    const row = data as { id: string; email: string; age21_ack_at: string; created_at: string };
    return { id: row.id, email: row.email, age21AckAt: row.age21_ack_at, createdAt: row.created_at };
  }

  private async accountById(id: string): Promise<DispensaryRecord | null> {
    const { data, error } = await client()
      .from("dispensary_accounts")
      .select("id, dispensary_name, address, contact_name, phone, ocm_license, email, password_hash, password_salt, age21_ack_at, status, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return mapAccount(data as AccountRow);
  }
}

export function emptyLedger(source: SignupLedger["source"]): SignupLedger {
  return { source, dispensaries: [], orders: [], haus: [] };
}
