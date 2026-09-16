export const DEMO_MEMBER_EMAIL = "member@bond.test";
export const MEMBER_SESSION_COOKIE = "bond_haus_member";
export const MEMBER_ACK_COOKIE = "bond_haus_ack";

export const MEMBER_ROOMS = [
  "salon",
  "library",
  "guide",
  "reserve",
  "events",
  "ritual",
  "account",
] as const;

export type MemberRoom = (typeof MEMBER_ROOMS)[number];

export type MemberSession = {
  email: string;
  role: "member";
  shelf: [];
};

export type MemberAck = {
  email: string;
  welcomeSeen: boolean;
  age21: boolean;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isDemoMemberEmail(email: string): boolean {
  return normalizeEmail(email) === DEMO_MEMBER_EMAIL;
}

export function seedEmptyShelf(): [] {
  return [];
}

export function seedMemberSession(email = DEMO_MEMBER_EMAIL): MemberSession {
  return {
    email: normalizeEmail(email),
    role: "member",
    shelf: seedEmptyShelf(),
  };
}

export function parseMemberSession(raw: string | null | undefined): MemberSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<MemberSession>;
    if (!value || typeof value.email !== "string") return null;
    if (!isDemoMemberEmail(value.email)) return null;
    if (value.role !== "member") return null;
    return seedMemberSession(value.email);
  } catch {
    return null;
  }
}

export function parseMemberAck(raw: string | null | undefined): MemberAck | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<MemberAck>;
    if (!value || typeof value.email !== "string") return null;
    if (!isDemoMemberEmail(value.email)) return null;
    return {
      email: normalizeEmail(value.email),
      welcomeSeen: value.welcomeSeen === true,
      age21: value.age21 === true,
    };
  } catch {
    return null;
  }
}

export function memberNeedsWelcome(ack: MemberAck | null, email: string): boolean {
  if (!ack || ack.email !== normalizeEmail(email)) return true;
  return !ack.welcomeSeen || !ack.age21;
}

export function memberDestination(ack: MemberAck | null, email: string): "/haus/welcome" | "/haus/salon" {
  return memberNeedsWelcome(ack, email) ? "/haus/welcome" : "/haus/salon";
}

export function isMemberRoom(value: string): value is MemberRoom {
  return (MEMBER_ROOMS as readonly string[]).includes(value);
}

export function isMemberFloorPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  if (path === "/haus/welcome") return true;
  return MEMBER_ROOMS.some((room) => path === `/haus/${room}`);
}

export function demoMemberNeverOpensVauxhall(email: string): boolean {
  return isDemoMemberEmail(email);
}
