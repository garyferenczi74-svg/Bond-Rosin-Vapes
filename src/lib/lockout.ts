import type { SupabaseClient } from "@supabase/supabase-js";

export type LockoutState = {
  allowed: boolean;
  locked: boolean;
};

export async function recordAuthAttempt(
  client: SupabaseClient,
  email: string,
  ip: string | null,
  outcome: "fail" | "success" | "blocked" | "lockout" | "check",
): Promise<LockoutState> {
  const { data, error } = await client.rpc("record_auth_attempt", {
    p_email: email,
    p_ip: ip,
    p_outcome: outcome,
  });

  if (error || !data) {
    return { allowed: outcome === "success", locked: false };
  }

  const row = data as { allowed?: boolean; locked?: boolean };
  return {
    allowed: Boolean(row.allowed),
    locked: Boolean(row.locked),
  };
}
