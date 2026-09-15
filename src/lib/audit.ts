import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequestMeta } from "@/lib/request-meta";

export type AuditPayload = {
  actor: string;
  action: string;
  target: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  meta: RequestMeta;
};

export async function writeAudit(client: SupabaseClient, payload: AuditPayload) {
  const { error } = await client.from("audit_log").insert({
    actor: payload.actor,
    action: payload.action,
    target: payload.target,
    before: payload.before,
    after: payload.after,
    ip: payload.meta.ip,
    user_agent: payload.meta.userAgent,
    path: payload.meta.path,
  });

  if (error) {
    throw new Error("audit write failed");
  }
}
