import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const SUPABASE_SERVICE_ROLE_KEY = "SUPABASE_SERVICE_ROLE_KEY";

export type ServiceRoleEnvLookup = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  [key: string]: string | undefined;
};

export type ServiceRoleConfig =
  | { ok: true; url: string; key: string }
  | { ok: false; reason: string };

export function assertServiceRoleServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Supabase service role client is server-only.");
  }
}

function pickEnv(source: ServiceRoleEnvLookup, name: keyof ServiceRoleEnvLookup): string {
  const value = source[name];
  return typeof value === "string" ? value.trim() : "";
}

export function readServiceRoleConfig(source: ServiceRoleEnvLookup = process.env): ServiceRoleConfig {
  assertServiceRoleServerOnly();
  const url = pickEnv(source, "NEXT_PUBLIC_SUPABASE_URL");
  const key = pickEnv(source, SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) {
    return { ok: false, reason: "Supabase service role env is not configured" };
  }
  return { ok: true, url, key };
}

export function createSupabaseServiceRole(
  source: ServiceRoleEnvLookup = process.env,
): SupabaseClient<Database> {
  const config = readServiceRoleConfig(source);
  if (!config.ok) {
    throw new Error(config.reason);
  }
  return createClient<Database>(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
