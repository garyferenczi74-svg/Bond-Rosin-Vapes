import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequestMeta } from "./request-meta.ts";
import { hashLockoutIp } from "./lockout.ts";

export type AuditPayload = {
  actor: string;
  action: string;
  target: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  meta: RequestMeta;
};

export async function writeAudit(client: SupabaseClient, payload: AuditPayload) {
  // Keyed HMAC of the IP. hashLockoutIp throws in production when BOND_HASH_KEY is missing,
  // so this insert does not run and the raw address is not stored.
  const ip = hashLockoutIp(payload.meta.ip);
  const { error } = await client.from("audit_log").insert({
    actor: payload.actor,
    action: payload.action,
    target: payload.target,
    before: payload.before,
    after: payload.after,
    ip,
    user_agent: payload.meta.userAgent,
    path: payload.meta.path,
  });

  if (error) {
    throw new Error("audit write failed");
  }
}
