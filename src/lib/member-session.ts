import { cookies } from "next/headers";
import {
  MEMBER_ACK_COOKIE,
  MEMBER_SESSION_COOKIE,
  parseMemberAck,
  parseMemberSession,
  seedMemberSession,
  type MemberAck,
  type MemberSession,
} from "@/lib/member";

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function readMemberSession(): Promise<MemberSession | null> {
  const store = await cookies();
  return parseMemberSession(store.get(MEMBER_SESSION_COOKIE)?.value);
}

export async function readMemberAck(): Promise<MemberAck | null> {
  const store = await cookies();
  return parseMemberAck(store.get(MEMBER_ACK_COOKIE)?.value);
}

export async function writeMemberSession(session: MemberSession = seedMemberSession()): Promise<void> {
  const store = await cookies();
  store.set(MEMBER_SESSION_COOKIE, JSON.stringify(seedMemberSession(session.email)), {
    ...cookieBase(),
    maxAge: 60 * 60 * 24,
  });
}

export async function writeMemberAck(ack: MemberAck): Promise<void> {
  const store = await cookies();
  store.set(MEMBER_ACK_COOKIE, JSON.stringify(ack), {
    ...cookieBase(),
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearMemberSession(): Promise<void> {
  const store = await cookies();
  store.set(MEMBER_SESSION_COOKIE, "", {
    ...cookieBase(),
    maxAge: 0,
  });
}
