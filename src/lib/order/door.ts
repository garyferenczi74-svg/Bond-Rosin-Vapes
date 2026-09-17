import { GENERIC_DOOR } from "../access.ts";
import { isMemberEmail, normalizeEmail } from "../member.ts";
import { ORDER_COPY } from "./copy.ts";
import { assertPasswordShape, hashPassword, verifyPassword } from "./password.ts";
import { clonePartnerAccounts, SEED_PARTNER_ACCOUNTS } from "./seed.ts";
import { isLicenseString, normalizeLicense, type PartnerAccount, type PartnerSession } from "./types.ts";

export function listPartnerAccounts(rows: PartnerAccount[] = SEED_PARTNER_ACCOUNTS): PartnerAccount[] {
  return rows.map((row) => ({ ...row }));
}

export function mergePartnerAccounts(
  seed: PartnerAccount[],
  persisted: PartnerAccount[],
): PartnerAccount[] {
  const map = new Map<string, PartnerAccount>();
  for (const row of seed) {
    map.set(normalizeEmail(row.email), { ...row });
  }
  for (const row of persisted) {
    const key = normalizeEmail(row.email);
    const current = map.get(key);
    if (!current) {
      map.set(key, { ...row });
      continue;
    }
    map.set(key, {
      ...current,
      elevated: current.elevated || row.elevated,
      accountId: current.accountId || row.accountId,
      dispensaryName: row.dispensaryName || current.dispensaryName,
      address: row.address || current.address,
      contactName: row.contactName || current.contactName,
      phone: row.phone || current.phone,
    });
  }
  return [...map.values()];
}

export function accountsToPersist(
  rows: PartnerAccount[],
  seed: PartnerAccount[] = SEED_PARTNER_ACCOUNTS,
): PartnerAccount[] {
  const seedByEmail = new Map(seed.map((row) => [normalizeEmail(row.email), row]));
  return rows
    .filter((row) => {
      const base = seedByEmail.get(normalizeEmail(row.email));
      if (!base) return true;
      return row.elevated && !base.elevated;
    })
    .map((row) => {
      const base = seedByEmail.get(normalizeEmail(row.email));
      if (base) {
        return {
          ...row,
          passwordSalt: "",
          passwordHash: "",
        };
      }
      return { ...row };
    });
}

export function findPartnerAccount(
  input: { email: string; license: string },
  rows: PartnerAccount[] = SEED_PARTNER_ACCOUNTS,
): PartnerAccount | undefined {
  const email = normalizeEmail(input.email);
  const license = normalizeLicense(input.license);
  return rows.find((row) => row.email === email && normalizeLicense(row.license) === license);
}

export function findPartnerAccountByEmail(
  email: string,
  rows: PartnerAccount[] = SEED_PARTNER_ACCOUNTS,
): PartnerAccount | undefined {
  const mark = normalizeEmail(email);
  return rows.find((row) => row.email === mark);
}

function sessionFromAccount(account: PartnerAccount): PartnerSession {
  return {
    email: account.email,
    accountId: account.accountId,
    license: account.license,
    age21: true,
    role: "partner",
  };
}

function pendingAccountId(license: string): string {
  return `acct-${normalizeLicense(license).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function registerPartnerDoor(
  input: {
    email: string;
    license: string;
    password: string;
    confirm: string;
    age21: boolean;
  },
  rows: PartnerAccount[] = clonePartnerAccounts(),
): { ok: true; session: PartnerSession } | { ok: false; message: string } {
  if (!input.age21) {
    return { ok: false, message: "Please confirm you are 21 and over." };
  }
  if (!isMemberEmail(input.email) || !isLicenseString(input.license)) {
    return { ok: false, message: GENERIC_DOOR };
  }
  if (input.password !== input.confirm) {
    return { ok: false, message: ORDER_COPY.matchFail };
  }
  const shape = assertPasswordShape(input.password);
  if (!shape.ok) return shape;

  const email = normalizeEmail(input.email);
  const license = normalizeLicense(input.license);
  if (rows.some((row) => row.email === email || normalizeLicense(row.license) === license)) {
    return { ok: false, message: GENERIC_DOOR };
  }

  const creds = hashPassword(input.password);
  const account: PartnerAccount = {
    email,
    license,
    accountId: pendingAccountId(license),
    elevated: false,
    passwordSalt: creds.passwordSalt,
    passwordHash: creds.passwordHash,
    dispensaryName: "",
    address: "",
    contactName: "",
    phone: "",
  };
  rows.push(account);
  return { ok: true, session: sessionFromAccount(account) };
}

export function openPartnerDoor(
  input: { email: string; password: string },
  rows: PartnerAccount[] = SEED_PARTNER_ACCOUNTS,
): { ok: true; session: PartnerSession } | { ok: false; message: string } {
  if (!isMemberEmail(input.email)) {
    return { ok: false, message: GENERIC_DOOR };
  }
  const account = findPartnerAccountByEmail(input.email, rows);
  if (!account || !verifyPassword(input.password, account)) {
    return { ok: false, message: GENERIC_DOOR };
  }
  return { ok: true, session: sessionFromAccount(account) };
}

export function elevatePartnerAccount(
  license: string,
  rows: PartnerAccount[] = SEED_PARTNER_ACCOUNTS,
): { ok: true } | { ok: false; reason: string } {
  const mark = normalizeLicense(license);
  const row = rows.find((item) => normalizeLicense(item.license) === mark);
  if (!row) return { ok: false, reason: "Account not found." };
  row.elevated = true;
  return { ok: true };
}

export function isPartnerElevated(
  input: { email: string; license: string },
  rows: PartnerAccount[] = SEED_PARTNER_ACCOUNTS,
): boolean {
  return findPartnerAccount(input, rows)?.elevated === true;
}
