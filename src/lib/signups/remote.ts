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

type HausRow = {
  id: string;
  email: string;
  age21_ack: boolean;
  age21_ack_at: string;
  requested_dispensary: string;
  created_at: string;
};

function mapHaus(row: HausRow): HausSignupRecord {
  return {
    id: row.id,
    email: row.email,
    age21Ack: row.age21_ack,
    age21AckAt: row.age21_ack_at,
    requestedDispensary: row.requested_dispensary,
    createdAt: row.created_at,
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
    await this.touchDispensary(accountId);
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
    await this.touchDispensary(input.dispensaryAccountId);
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
      .from("haus_requests")
      .select("id, email, age21_ack, age21_ack_at, requested_dispensary, created_at")
      .eq("email", session.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      email: session.email,
      signup: signup ? mapHaus(signup as HausRow) : null,
    };
  }

  async closeHausSession(sessionId: string): Promise<void> {
    await client().from("haus_sessions").delete().eq("id", sessionId);
  }

  async hasHausAge21Ack(email: string): Promise<boolean> {
    const { data, error } = await client()
      .from("haus_requests")
      .select("age21_ack")
      .eq("email", email.trim().toLowerCase())
      .eq("age21_ack", true)
      .limit(1)
      .maybeSingle();
    if (error || !data) return false;
    return (data as { age21_ack?: boolean }).age21_ack === true;
  }

  async recordHausSignup(email: string, requestedDispensary = ""): Promise<HausSignupRecord> {
    const mark = email.trim().toLowerCase();
    const dispensary = requestedDispensary.trim().replace(/\s+/g, " ");
    const { data: existing } = await client()
      .from("haus_requests")
      .select("id, email, age21_ack, age21_ack_at, requested_dispensary, created_at")
      .eq("email", mark)
      .limit(1)
      .maybeSingle();
    if (existing) {
      const row = mapHaus(existing as HausRow);
      if (!row.requestedDispensary && dispensary) {
        await client().from("haus_requests").update({ requested_dispensary: dispensary }).eq("id", row.id);
        row.requestedDispensary = dispensary;
      }
      return row;
    }
    const { data, error } = await client()
      .from("haus_requests")
      .insert({
        email: mark,
        age21_ack: true,
        age21_ack_at: new Date().toISOString(),
        requested_dispensary: dispensary,
      })
      .select("id, email, age21_ack, age21_ack_at, requested_dispensary, created_at")
      .single();
    if (error || !data) throw new Error("Haus request was not stored.");
    return mapHaus(data as HausRow);
  }

  async recordHausUpdate(
    email: string,
    source: string,
    emailHmac: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const { data, error } = await client().rpc("bond_record_haus_update", {
      p_email: email,
      p_source: source,
      p_email_hmac: emailHmac,
    });
    if (error) throw new Error("Haus update was not stored.");
    if (data !== true) return { ok: false, reason: "suppressed" };
    return { ok: true };
  }

  async issueHausUpdateToken(
    emailHmac: string,
    purpose: "unsub" | "confirm",
  ): Promise<{ id: string }> {
    const { data, error } = await client().rpc("bond_issue_haus_update_token", {
      p_email_hmac: emailHmac,
      p_purpose: purpose,
    });
    if (error || typeof data !== "string" || !data) throw new Error("Haus update token was not stored.");
    return { id: data };
  }

  async readHausUpdateToken(
    id: string,
  ): Promise<{ emailHmac: string; purpose: "unsub" | "confirm"; expiresAt: string | null } | null> {
    const { data, error } = await client().rpc("bond_read_haus_update_token", { p_id: id });
    if (error || !data || typeof data !== "object") return null;
    const row = data as { email_hmac?: unknown; purpose?: unknown; expires_at?: unknown };
    if (row.purpose !== "unsub" && row.purpose !== "confirm") return null;
    if (typeof row.email_hmac !== "string") return null;
    const expiresAt = typeof row.expires_at === "string" && row.expires_at ? row.expires_at : null;
    return { emailHmac: row.email_hmac, purpose: row.purpose, expiresAt };
  }

  async unsubscribeHausUpdate(emailHmac: string): Promise<{ ok: boolean }> {
    const { data, error } = await client().rpc("bond_unsubscribe_haus_update", {
      p_email_hmac: emailHmac,
    });
    if (error || data !== true) throw new Error("Unsubscribe was not stored.");
    return { ok: true };
  }

  async confirmHausUpdate(emailHmac: string): Promise<{ ok: boolean }> {
    const { data, error } = await client().rpc("bond_confirm_haus_update", {
      p_email_hmac: emailHmac,
    });
    if (error || data !== true) return { ok: false };
    return { ok: true };
  }

  private async touchDispensary(accountId: string): Promise<void> {
    const stamped = new Date().toISOString();
    const { error } = await client()
      .from("dispensary_accounts")
      .update({ last_active_at: stamped, updated_at: stamped })
      .eq("id", accountId);
    if (error) throw new Error("Dispensary activity was not stored.");
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
  return { source, dispensaries: [], orders: [], haus: [], updates: [] };
}
