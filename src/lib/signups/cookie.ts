import { createHmac, timingSafeEqual } from "node:crypto";

const DEV_SESSION_SECRET = "bond-dev-session-secret";

export function sessionSecret(): string {
  const set = process.env.BOND_SESSION_SECRET?.trim() ?? "";
  if (set) return set;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BOND_SESSION_SECRET is not configured");
  }
  return DEV_SESSION_SECRET;
}

export function sealSessionId(id: string, secret = sessionSecret()): string {
  const body = `v1.${id}`;
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function openSessionId(token: string | null | undefined, secret = sessionSecret()): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !parts[1] || !parts[2]) return null;
  const body = `${parts[0]}.${parts[1]}`;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const got = Buffer.from(parts[2]);
  const want = Buffer.from(expected);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  return parts[1];
}
