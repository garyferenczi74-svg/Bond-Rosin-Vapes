import { hashLockoutValue } from "../lockout.ts";
import { deliverHausUpdateConfirmation, type HausUpdateDelivery } from "./haus-updates-mail.ts";

export type HausMailPurpose = "unsub" | "confirm";

const OPAQUE_HAUS_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HausUpdateToken = {
  emailHmac: string;
  purpose: HausMailPurpose;
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
  unsubscribeHausUpdate(emailHmac: string): Promise<{ ok: boolean }> | { ok: boolean };
  confirmHausUpdate(emailHmac: string): Promise<{ ok: boolean }> | { ok: boolean };
};

export function hausUpdatesDoubleOptInEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BOND_HAUS_UPDATES_DOUBLE_OPT_IN === "on";
}

export function hausUpdateOptInAccepted(input: {
  optedIn: boolean;
  attested21: boolean;
  ageVerified: boolean;
}): boolean {
  return input.optedIn && input.attested21 && input.ageVerified;
}

export function isOpaqueHausToken(token: string | null | undefined): token is string {
  return typeof token === "string" && OPAQUE_HAUS_TOKEN.test(token);
}

export function rfc8058OneClick(body: string, header: string | null): boolean {
  return body.includes("List-Unsubscribe=One-Click") || header === "List-Unsubscribe=One-Click";
}

export async function recordHausUpdateOptIn(input: {
  email: string;
  source: string;
  optedIn: boolean;
  attested21: boolean;
  ageVerified: boolean;
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
  if (!hausUpdateOptInAccepted(input)) {
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

  const unsub = await input.store.issueHausUpdateToken(emailHmac, "unsub");
  const env = input.env ?? process.env;
  if (!hausUpdatesDoubleOptInEnabled(env)) {
    return {
      ok: true,
      recorded: true,
      confirmationAttempted: false,
      unsubscribeToken: unsub.id,
    };
  }

  const confirm = await input.store.issueHausUpdateToken(emailHmac, "confirm");
  const deliver = input.deliver ?? deliverHausUpdateConfirmation;
  await deliver({
    email: input.email.trim().toLowerCase(),
    confirmUrl: `/haus/updates/confirm?token=${confirm.id}`,
  });
  return {
    ok: true,
    recorded: true,
    confirmationAttempted: true,
    unsubscribeToken: unsub.id,
    confirmToken: confirm.id,
  };
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
): Promise<{ ok: true; sent: false } | { ok: false; reason: "off" | "token" | "missing"; sent: false }> {
  if (!hausUpdatesDoubleOptInEnabled(env)) {
    return { ok: false, reason: "off", sent: false };
  }
  if (!isOpaqueHausToken(token)) return { ok: false, reason: "token", sent: false };
  const row = await store.readHausUpdateToken(token);
  if (!row || row.purpose !== "confirm" || !/^[0-9a-f]{64}$/.test(row.emailHmac)) {
    return { ok: false, reason: "token", sent: false };
  }
  const confirmed = await store.confirmHausUpdate(row.emailHmac);
  if (!confirmed.ok) return { ok: false, reason: "missing", sent: false };
  return { ok: true, sent: false };
}
