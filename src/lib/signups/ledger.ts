import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSignupStore, signupBackend } from "./index.ts";
import { MemorySignupStore } from "./memory.ts";
import type { HausUpdateRecord, SignupLedger } from "./types.ts";

export async function readOwnerSignupLedger(role: string): Promise<SignupLedger | null> {
  if (role !== "owner") return null;
  if (signupBackend() === "memory") {
    const store = getSignupStore();
    if (store instanceof MemorySignupStore) return store.ledger();
  }

  try {
    const supabase = (await createSupabaseServer()) as unknown as SupabaseClient;
    const accounts = await supabase
      .from("dispensary_accounts")
      .select("id, dispensary_name, email, ocm_license, status, created_at")
      .order("created_at", { ascending: false });
    const orders = await supabase
      .from("order_requests")
      .select("id, dispensary_account_id, promised_on, lines, created_at")
      .order("created_at", { ascending: false });
    const haus = await supabase
      .from("haus_requests")
      .select("id, email, age21_ack, age21_ack_at, requested_dispensary")
      .order("created_at", { ascending: false });
    const updates = await supabase
      .from("haus_updates")
      .select("email, consent_at, source, confirmed_at")
      .order("consent_at", { ascending: false });
    if (accounts.error || orders.error || haus.error) {
      return { source: "supabase", dispensaries: [], orders: [], haus: [], updates: [], unavailable: true };
    }
    const updateRows: HausUpdateRecord[] = updates.error
      ? []
      : ((updates.data ?? []) as Array<Record<string, string | null>>).map((row) => ({
          email: String(row.email),
          consentAt: String(row.consent_at ?? ""),
          source: String(row.source ?? ""),
          confirmedAt: row.confirmed_at ? String(row.confirmed_at) : null,
        }));
    return {
      source: "supabase",
      dispensaries: ((accounts.data ?? []) as Array<Record<string, string>>).map((row) => ({
        id: row.id,
        dispensaryName: row.dispensary_name,
        email: row.email,
        ocmLicense: row.ocm_license,
        status: row.status as SignupLedger["dispensaries"][number]["status"],
        createdAt: row.created_at,
      })),
      orders: ((orders.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        dispensaryAccountId: String(row.dispensary_account_id),
        promisedOn: String(row.promised_on ?? ""),
        lineCount: Array.isArray(row.lines) ? row.lines.length : 0,
        createdAt: String(row.created_at ?? ""),
      })),
      haus: ((haus.data ?? []) as Array<Record<string, string | boolean>>).map((row) => ({
        id: String(row.id),
        email: String(row.email),
        age21Ack: row.age21_ack === true,
        age21AckAt: String(row.age21_ack_at),
        requestedDispensary: String(row.requested_dispensary ?? ""),
      })),
      updates: updateRows,
      updatesUnavailable: Boolean(updates.error),
    };
  } catch {
    return { source: "supabase", dispensaries: [], orders: [], haus: [], updates: [], unavailable: true };
  }
}
