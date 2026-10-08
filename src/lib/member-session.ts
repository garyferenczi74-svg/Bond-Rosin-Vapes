import { cookies } from "next/headers";
import { openSessionId, sealSessionId } from "@/lib/signups/cookie";
import { getSignupStore } from "@/lib/signups";
import {
  MEMBER_ACK_COOKIE,
  MEMBER_SESSION_COOKIE,
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

function readSeal(raw: string | undefined): string | null {
  try {
    return openSessionId(raw);
  } catch {
    return null;
  }
}

export async function readMemberSession(): Promise<MemberSession | null> {
  const jar = await cookies();
  const id = readSeal(jar.get(MEMBER_SESSION_COOKIE)?.value);
  if (!id) return null;
  const view = await getSignupStore().readHausSession(id);
  return view ? seedMemberSession(view.email) : null;
}

export async function readMemberAck(): Promise<MemberAck | null> {
  const jar = await cookies();
  const id = readSeal(jar.get(MEMBER_SESSION_COOKIE)?.value);
  if (!id) return null;
  const view = await getSignupStore().readHausSession(id);
  if (!view?.signup) return null;
  return { email: view.email, welcomeSeen: true, age21: true };
}

export async function writeMemberSession(session: MemberSession = seedMemberSession()): Promise<void> {
  const sessionId = await getSignupStore().openHausSession(session.email);
  const jar = await cookies();
  jar.set(MEMBER_SESSION_COOKIE, sealSessionId(sessionId), {
    ...cookieBase(),
    maxAge: 60 * 60 * 24,
  });
  jar.set(MEMBER_ACK_COOKIE, "", {
    ...cookieBase(),
    maxAge: 0,
  });
}

export async function writeMemberAck(ack: MemberAck, requestedDispensary = ""): Promise<void> {
  if (ack.age21) await getSignupStore().recordHausSignup(ack.email, requestedDispensary);
  const jar = await cookies();
  jar.set(MEMBER_ACK_COOKIE, "", {
    ...cookieBase(),
    maxAge: 0,
  });
}

export async function clearMemberSession(): Promise<void> {
  const jar = await cookies();
  const id = readSeal(jar.get(MEMBER_SESSION_COOKIE)?.value);
  if (id) await getSignupStore().closeHausSession(id);
  jar.set(MEMBER_SESSION_COOKIE, "", {
    ...cookieBase(),
    maxAge: 0,
  });
  jar.set(MEMBER_ACK_COOKIE, "", {
    ...cookieBase(),
    maxAge: 0,
  });
}
