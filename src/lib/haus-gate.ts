import { redirect } from "next/navigation";
import { adminPortalAllowed } from "@/lib/access";
import { readAdminRow } from "@/lib/gate";
import { memberDestination, type MemberAck, type MemberSession } from "@/lib/member";
import { readMemberAck, readMemberSession } from "@/lib/member-session";

export async function readDoorContext() {
  const member = await readMemberSession();
  const ack = await readMemberAck();

  try {
    const adminCtx = await readAdminRow();
    return { ...adminCtx, member, ack };
  } catch {
    return { supabase: null, user: null, admin: null, member, ack };
  }
}

export async function requireMemberSession(): Promise<{
  member: MemberSession;
  ack: MemberAck | null;
}> {
  const ctx = await readDoorContext();
  if (ctx.user && adminPortalAllowed({ admin: ctx.admin })) {
    redirect("/vauxhall");
  }
  if (!ctx.member) {
    redirect("/haus");
  }
  return { member: ctx.member, ack: ctx.ack };
}

export function floorPathForMember(ack: MemberAck | null, email: string) {
  return memberDestination(ack, email);
}
