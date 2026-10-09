import { cookies } from "next/headers";
import { openSessionId, sealSessionId } from "@/lib/signups/cookie";
import { getSignupStore } from "@/lib/signups";
import type { DispensaryRecord } from "@/lib/signups/types";
import { mergePartnerDraftBundle, parsePartnerDraftBundle, serializePartnerDraftBundle } from "./persist.ts";
import {
  PARTNER_ACCOUNT_COOKIE,
  PARTNER_DRAFT_COOKIE,
  PARTNER_SESSION_COOKIE,
  parsePartnerSession,
  type PartnerAccount,
  type PartnerDraftBundle,
  type PartnerSession,
} from "./types.ts";

export { parsePartnerSession };

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

function partnerFromRecord(row: DispensaryRecord): PartnerAccount {
  return {
    email: row.email,
    license: row.ocmLicense,
    accountId: row.id,
    elevated: row.status === "approved",
    passwordSalt: row.passwordSalt,
    passwordHash: row.passwordHash,
    dispensaryName: row.dispensaryName,
    address: row.address,
    contactName: row.contactName,
    phone: row.phone,
  };
}

function sessionFromRecord(row: DispensaryRecord): PartnerSession {
  return {
    email: row.email,
    accountId: row.id,
    license: row.ocmLicense,
    age21: true,
    role: "partner",
  };
}

function readSeal(raw: string | undefined): string | null {
  try {
    return openSessionId(raw);
  } catch {
    return null;
  }
}

export async function readPartnerSession(): Promise<PartnerSession | null> {
  const account = await readSessionPartnerRecord();
  return account ? sessionFromRecord(account) : null;
}

export async function readSessionPartnerAccount(): Promise<PartnerAccount | null> {
  const account = await readSessionPartnerRecord();
  return account ? partnerFromRecord(account) : null;
}

async function readSessionPartnerRecord(): Promise<DispensaryRecord | null> {
  const jar = await cookies();
  const id = readSeal(jar.get(PARTNER_SESSION_COOKIE)?.value);
  if (!id) return null;
  return getSignupStore().accountForDispensarySession(id);
}

export async function writePartnerSessionId(sessionId: string): Promise<void> {
  const jar = await cookies();
  jar.set(PARTNER_SESSION_COOKIE, sealSessionId(sessionId), {
    ...cookieBase(),
    maxAge: 60 * 60 * 24,
  });
  jar.set(PARTNER_ACCOUNT_COOKIE, "", {
    ...cookieBase(),
    maxAge: 0,
  });
}

export async function clearPartnerSession(): Promise<void> {
  const jar = await cookies();
  const id = readSeal(jar.get(PARTNER_SESSION_COOKIE)?.value);
  if (id) await getSignupStore().closeDispensarySession(id);
  jar.set(PARTNER_SESSION_COOKIE, "", {
    ...cookieBase(),
    maxAge: 0,
  });
  jar.set(PARTNER_ACCOUNT_COOKIE, "", {
    ...cookieBase(),
    maxAge: 0,
  });
}

export async function readPartnerDraftPersist(): Promise<PartnerDraftBundle> {
  const store = await cookies();
  return parsePartnerDraftBundle(store.get(PARTNER_DRAFT_COOKIE)?.value);
}

export async function writePartnerDraftPersist(bundle: PartnerDraftBundle): Promise<void> {
  const store = await cookies();
  const current = parsePartnerDraftBundle(store.get(PARTNER_DRAFT_COOKIE)?.value);
  store.set(PARTNER_DRAFT_COOKIE, serializePartnerDraftBundle(mergePartnerDraftBundle(current, bundle)), {
    ...cookieBase(),
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function readPartnerAccountBook(): Promise<PartnerAccount[]> {
  const rows = await getSignupStore().listAccounts();
  return rows.map(partnerFromRecord);
}
