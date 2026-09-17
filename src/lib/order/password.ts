import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 32;
const SCRYPT = { N: 4096, r: 8, p: 1 } as const;
const MIN_LEN = 8;
const MAX_LEN = 128;

export type PasswordRecord = {
  passwordSalt: string;
  passwordHash: string;
};

export function assertPasswordShape(
  password: string,
): { ok: true } | { ok: false; message: string } {
  if (password.length < MIN_LEN) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if (password.length > MAX_LEN) {
    return { ok: false, message: "Password must be at most 128 characters." };
  }
  return { ok: true };
}

export function hashPassword(password: string): PasswordRecord {
  const passwordSalt = randomBytes(16).toString("hex");
  const passwordHash = scryptSync(password, passwordSalt, KEYLEN, SCRYPT).toString("hex");
  return { passwordSalt, passwordHash };
}

export function hashPasswordWithSalt(password: string, passwordSalt: string): PasswordRecord {
  const passwordHash = scryptSync(password, passwordSalt, KEYLEN, SCRYPT).toString("hex");
  return { passwordSalt, passwordHash };
}

export function verifyPassword(password: string, record: PasswordRecord): boolean {
  if (!record.passwordSalt || !record.passwordHash) return false;
  const next = scryptSync(password, record.passwordSalt, KEYLEN, SCRYPT);
  const prev = Buffer.from(record.passwordHash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}
