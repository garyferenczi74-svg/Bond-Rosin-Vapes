import { hashLockoutValue } from "../lockout.ts";
import { deliverHausUpdateConfirmation, type HausUpdateDelivery } from "./haus-updates-mail.ts";

export type HausMailPurpose = "unsub" | "confirm";

export const HAUS_CONFIRM_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;

const OPAQUE_HAUS_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HausUpdateToken = {
  emailHmac: string;
  purpose: HausMailPurpose;
  expiresAt: string | null;
};

export type HausUpdateWrite = {
  recordHausUpdate(
    email: string,
    source: string,
    emailHmac: string,
  ): Promise<{ ok: boolean; reason?: string }> | { ok: boolean; reason?: string };
  issueHausUpdateToken(
    emailHmac: string,
    purpose: HausMailPurpose,
  ): Promise<{ id: string }> | { id: string };
  readHausUpdateToken(
    id: string,
  ): Promise<HausUpdateToken | null> | HausUpdateToken | null;
  hasHausAge21Ack(email: string): Promise<boolean> | boolean;
  unsubscribeHausUpdate(emailHmac: string): Promise<{ ok: boolean }> | { ok: boolean };
  confirmHausUpdate(emailHmac: string): Promise<{ ok: boolean }> | { ok: boolean };
};

export type HausSalonStore = HausUpdateWrite & {
  hasHausUpdate(email: string): Promise<boolean> | boolean;
  reoptHausUpdate(email: string): Promise<boolean> | boolean;
};

const HAUS_COULD_NOT_SAVE = "Bond could not save that opt in.";
const HAUS_UPDATES_OFF = "Bond Haus updates are off for this email.";
const HAUS_UPDATES_ON = "Bond Haus updates are on for this email.";
const HAUS_UPDATES_ATTEST = "Bond accepts Haus updates only with your 21 or older attestation.";

export type HausSalonOptInResult = {
  ok: boolean;
  recorded: boolean;
  subscribed: boolean;
  message: string;
};

async function issuedHausToken(
  store: HausUpdateWrite,
  emailHmac: string,
  purpose: HausMailPurpose,
): Promise<string | undefined> {
  try {
    const issued = await store.issueHausUpdateToken(emailHmac, purpose);
    return issued.id;
  } catch {
    console.error("Haus update token was not issued.", purpose);
    return undefined;
  }
}

export function hausUpdatesDoubleOptInEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BOND_HAUS_UPDATES_DOUBLE_OPT_IN === "on";
}

export function hausUpdateOptInAccepted(input: {
  optedIn: boolean;
  serverAge21Ack: boolean;
}): boolean {
  return input.optedIn && input.serverAge21Ack;
}

export function isOpaqueHausToken(token: string | null | undefined): token is string {
  return typeof token === "string" && OPAQUE_HAUS_TOKEN.test(token);
}

export function hausConfirmTokenExpired(
  row: { purpose: HausMailPurpose; expiresAt: string | null },
  now = Date.now(),
): boolean {
  if (row.purpose !== "confirm") return false;
  if (!row.expiresAt) return true;
  const at = Date.parse(row.expiresAt);
  return Number.isNaN(at) || at <= now;
}

export function rfc8058OneClick(body: string, header: string | null): boolean {
  return body.includes("List-Unsubscribe=One-Click") || header === "List-Unsubscribe=One-Click";
}

export async function recordHausUpdateOptIn(input: {
  email: string;
  source: string;
  optedIn: boolean;
  store: HausUpdateWrite;
  env?: NodeJS.ProcessEnv;
  deliver?: (delivery: HausUpdateDelivery) => Promise<{ attempted: false }>;
}): Promise<{
  ok: boolean;
  recorded: boolean;
  reason?: string;
  confirmationAttempted: boolean;
  unsubscribeToken?: string;
  confirmToken?: string;
}> {
  const serverAge21Ack = await input.store.hasHausAge21Ack(input.email);
  if (!hausUpdateOptInAccepted({
    optedIn: input.optedIn,
    serverAge21Ack,
  })) {
    return { ok: true, recorded: false, confirmationAttempted: false };
  }

  let emailHmac = "";
  try {
    emailHmac = hashLockoutValue(input.email);
  } catch {
    return { ok: false, recorded: false, reason: "closed", confirmationAttempted: false };
  }
  if (!emailHmac) {
    return { ok: false, recorded: false, reason: "closed", confirmationAttempted: false };
  }

  const written = await input.store.recordHausUpdate(input.email, input.source, emailHmac);
  if (!written.ok) {
    return {
      ok: false,
      recorded: false,
      reason: written.reason ?? "suppressed",
      confirmationAttempted: false,
    };
  }

  const unsubId = await issuedHausToken(input.store, emailHmac, "unsub");
  const env = input.env ?? process.env;
  if (!hausUpdatesDoubleOptInEnabled(env)) {
    return {
      ok: true,
      recorded: true,
      confirmationAttempted: false,
      unsubscribeToken: unsubId,
    };
  }

  const confirmId = await issuedHausToken(input.store, emailHmac, "confirm");
  if (!confirmId) {
    return {
      ok: true,
      recorded: true,
      confirmationAttempted: false,
      unsubscribeToken: unsubId,
    };
  }
  const deliver = input.deliver ?? deliverHausUpdateConfirmation;
  await deliver({
    email: input.email.trim().toLowerCase(),
    confirmUrl: `/haus/updates/confirm?token=${confirmId}`,
  });
  return {
    ok: true,
    recorded: true,
    confirmationAttempted: true,
    unsubscribeToken: unsubId,
    confirmToken: confirmId,
  };
}

export async function saveHausSalonOptIn(input: {
  email: string;
  optedIn: boolean;
  store: HausSalonStore;
  env?: NodeJS.ProcessEnv;
}): Promise<HausSalonOptInResult> {
  if (!input.optedIn) {
    let current = false;
    try {
      current = await input.store.hasHausUpdate(input.email);
    } catch {
      return { ok: false, recorded: false, subscribed: true, message: HAUS_COULD_NOT_SAVE };
    }
    if (!current) {
      return { ok: true, recorded: false, subscribed: false, message: "" };
    }
    try {
      await input.store.unsubscribeHausUpdate(hashLockoutValue(input.email));
      return { ok: true, recorded: false, subscribed: false, message: HAUS_UPDATES_OFF };
    } catch {
      return { ok: false, recorded: false, subscribed: true, message: HAUS_COULD_NOT_SAVE };
    }
  }

  try {
    const result = await recordHausUpdateOptIn({
      email: input.email,
      source: "haus_page",
      optedIn: true,
      store: input.store,
      env: input.env,
    });
    if (result.reason === "suppressed") {
      const lifted = await input.store.reoptHausUpdate(input.email);
      if (!lifted) {
        return { ok: false, recorded: false, subscribed: false, message: HAUS_COULD_NOT_SAVE };
      }
      await issuedHausToken(input.store, hashLockoutValue(input.email), "unsub");
      return { ok: true, recorded: true, subscribed: true, message: HAUS_UPDATES_ON };
    }
    if (!result.recorded) {
      return {
        ok: false,
        recorded: false,
        subscribed: false,
        message: result.reason === "closed" ? HAUS_COULD_NOT_SAVE : HAUS_UPDATES_ATTEST,
      };
    }
    return { ok: true, recorded: true, subscribed: true, message: HAUS_UPDATES_ON };
  } catch {
    return { ok: false, recorded: false, subscribed: false, message: HAUS_COULD_NOT_SAVE };
  }
}

export async function applyUnsubscribe(
  token: string | null | undefined,
  store: HausUpdateWrite,
): Promise<{ ok: true } | { ok: false; reason: "token" }> {
  if (!isOpaqueHausToken(token)) return { ok: false, reason: "token" };
  const row = await store.readHausUpdateToken(token);
  if (!row || row.purpose !== "unsub" || !/^[0-9a-f]{64}$/.test(row.emailHmac)) {
    return { ok: false, reason: "token" };
  }
  await store.unsubscribeHausUpdate(row.emailHmac);
  return { ok: true };
}

export async function confirmHausUpdate(
  token: string | null | undefined,
  store: HausUpdateWrite,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: true; sent: false } | { ok: false; reason: "off" | "token" | "expired" | "missing"; sent: false }> {
  if (!hausUpdatesDoubleOptInEnabled(env)) {
    return { ok: false, reason: "off", sent: false };
  }
  if (!isOpaqueHausToken(token)) return { ok: false, reason: "token", sent: false };
  const row = await store.readHausUpdateToken(token);
  if (!row || row.purpose !== "confirm" || !/^[0-9a-f]{64}$/.test(row.emailHmac)) {
    return { ok: false, reason: "token", sent: false };
  }
  if (hausConfirmTokenExpired(row)) {
    return { ok: false, reason: "expired", sent: false };
  }
  const confirmed = await store.confirmHausUpdate(row.emailHmac);
  if (!confirmed.ok) return { ok: false, reason: "missing", sent: false };
  return { ok: true, sent: false };
}
