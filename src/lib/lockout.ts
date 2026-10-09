import { createHmac } from "node:crypto";
import { createSupabaseServiceRole } from "./supabase/service.ts";

const DEV_HASH_KEY = "bond-dev-hash-key";

// Server-only. Separate from BOND_SESSION_SECRET. Never NEXT_PUBLIC_, never logged.
export function hashKey(): string {
  const set = process.env.BOND_HASH_KEY?.trim() ?? "";
  if (set) return set;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BOND_HASH_KEY is not configured");
  }
  return DEV_HASH_KEY;
}

// HMAC-SHA256 of lower(trim(value)), hex. The same input and key always
// produce the same digest, so lockout still matches on the email digest.
export function hashLockoutValue(value: string | null | undefined, key = hashKey()): string {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "";
  return createHmac("sha256", key).update(normalized).digest("hex");
}

export function hashLockoutIp(ip: string | null | undefined, key = hashKey()): string {
  return hashLockoutValue(ip, key);
}

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
  let emailHash = "";
  let ipHash = "";
  try {
    emailHash = hashLockoutValue(email);
    ipHash = hashLockoutValue(ip);
  } catch {
    // Production with no BOND_HASH_KEY. Do not store the raw email or IP, and do not allow the attempt.
    return { allowed: false, locked: true };
  }

  try {
    const client = createSupabaseServiceRole();
    const { data, error } = await client.rpc("record_auth_attempt", {
      p_email: emailHash,
      p_ip: ipHash,
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
