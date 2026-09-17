import { cookies } from "next/headers";
import { accountsToPersist, mergePartnerAccounts } from "./door.ts";
import { mergePartnerDraftBundle, parsePartnerDraftBundle, serializePartnerDraftBundle } from "./persist.ts";
import { clonePartnerAccounts, SEED_PARTNER_ACCOUNTS } from "./seed.ts";
import {
  PARTNER_ACCOUNT_COOKIE,
  PARTNER_DRAFT_COOKIE,
  PARTNER_SESSION_COOKIE,
  parsePartnerAccounts,
  parsePartnerSession,
  serializePartnerAccounts,
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

export async function readPartnerSession(): Promise<PartnerSession | null> {
  const store = await cookies();
  return parsePartnerSession(store.get(PARTNER_SESSION_COOKIE)?.value);
}

export async function writePartnerSession(session: PartnerSession): Promise<void> {
  const store = await cookies();
  store.set(PARTNER_SESSION_COOKIE, JSON.stringify(session), {
    ...cookieBase(),
    maxAge: 60 * 60 * 24,
  });
}

export async function clearPartnerSession(): Promise<void> {
  const store = await cookies();
  store.set(PARTNER_SESSION_COOKIE, "", {
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

export async function readPersistedPartnerAccounts(): Promise<PartnerAccount[]> {
  const store = await cookies();
  return parsePartnerAccounts(store.get(PARTNER_ACCOUNT_COOKIE)?.value);
}

export async function readPartnerAccountBook(): Promise<PartnerAccount[]> {
  const persisted = await readPersistedPartnerAccounts();
  return mergePartnerAccounts(clonePartnerAccounts(), persisted);
}

export async function writePartnerAccountBook(rows: PartnerAccount[]): Promise<void> {
  const store = await cookies();
  store.set(PARTNER_ACCOUNT_COOKIE, serializePartnerAccounts(accountsToPersist(rows, SEED_PARTNER_ACCOUNTS)), {
    ...cookieBase(),
    maxAge: 60 * 60 * 24 * 30,
  });
}
