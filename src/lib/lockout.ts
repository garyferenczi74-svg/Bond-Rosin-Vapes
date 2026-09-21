import { createSupabaseServiceRole } from "./supabase/service.ts";

export type LockoutState = {
  allowed: boolean;
  locked: boolean;
};

export type LockoutOutcome = "fail" | "success" | "blocked" | "lockout" | "check";

export function lockoutFallback(outcome: LockoutOutcome): LockoutState {
  return { allowed: outcome === "success", locked: false };
}

export function readLockoutState(data: unknown, outcome: LockoutOutcome): LockoutState {
  if (!data || typeof data !== "object") {
    return lockoutFallback(outcome);
  }
  const row = data as { allowed?: boolean; locked?: boolean };
  return {
    allowed: Boolean(row.allowed),
    locked: Boolean(row.locked),
  };
}

export async function recordAuthAttempt(
  email: string,
  ip: string | null,
  outcome: LockoutOutcome,
): Promise<LockoutState> {
  try {
    const client = createSupabaseServiceRole();
    const { data, error } = await client.rpc("record_auth_attempt", {
      p_email: email,
      p_ip: ip ?? "",
      p_outcome: outcome,
    });
    if (error || !data) {
      return lockoutFallback(outcome);
    }
    return readLockoutState(data, outcome);
  } catch {
    return lockoutFallback(outcome);
  }
}
