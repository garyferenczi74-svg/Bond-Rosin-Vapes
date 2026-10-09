import { createHmac, timingSafeEqual } from "node:crypto";
import { hashLockoutValue } from "../lockout.ts";
import { sessionSecret } from "./cookie.ts";
import { deliverHausUpdateConfirmation, type HausUpdateDelivery } from "./haus-updates-mail.ts";

const TOKEN_PREFIX = "hm1";

export type HausMailPurpose = "unsub" | "confirm";

export type HausUpdateWrite = {
  recordHausUpdate(
    email: string,
    source: string,
    emailHmac: string,
  ): Promise<{ ok: boolean; reason?: string }> | { ok: boolean; reason?: string };
  unsubscribeHausUpdate(
    email: string,
    emailHmac: string,
  ): Promise<{ ok: boolean }> | { ok: boolean };
  confirmHausUpdate(email: string): Promise<{ ok: boolean }> | { ok: boolean };
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

export function sealHausMailToken(
  email: string,
  purpose: HausMailPurpose,
  secret = sessionSecret(),
): string {
  const payload = Buffer.from(
    JSON.stringify({ e: email.trim().toLowerCase(), p: purpose }),
    "utf8",
  ).toString("base64url");
  const body = `${TOKEN_PREFIX}.${purpose}.${payload}`;
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function openHausMailToken(
  token: string | null | undefined,
  purpose: HausMailPurpose,
  secret = sessionSecret(),
): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== TOKEN_PREFIX || parts[1] !== purpose || !parts[2] || !parts[3]) {
    return null;
  }
  const body = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const got = Buffer.from(parts[3]);
  const want = Buffer.from(expected);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(parts[2], "base64url").toString("utf8")) as {
      e?: unknown;
      p?: unknown;
    };
    if (parsed.p !== purpose || typeof parsed.e !== "string" || !parsed.e.includes("@")) return null;
    return parsed.e.trim().toLowerCase();
  } catch {
    return null;
  }
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
}): Promise<{ ok: boolean; recorded: boolean; reason?: string; confirmationAttempted: boolean }> {
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

  const env = input.env ?? process.env;
  if (!hausUpdatesDoubleOptInEnabled(env)) {
    return { ok: true, recorded: true, confirmationAttempted: false };
  }

  const token = sealHausMailToken(input.email, "confirm");
  const deliver = input.deliver ?? deliverHausUpdateConfirmation;
  await deliver({
    email: input.email.trim().toLowerCase(),
    confirmUrl: `/haus/updates/confirm?token=${token}`,
  });
  return { ok: true, recorded: true, confirmationAttempted: true };
}

export async function applyUnsubscribe(
  token: string | null | undefined,
  store: HausUpdateWrite,
): Promise<{ ok: true } | { ok: false; reason: "token" | "closed" }> {
  let email: string | null = null;
  try {
    email = openHausMailToken(token, "unsub");
  } catch {
    return { ok: false, reason: "closed" };
  }
  if (!email) return { ok: false, reason: "token" };

  let emailHmac = "";
  try {
    emailHmac = hashLockoutValue(email);
  } catch {
    return { ok: false, reason: "closed" };
  }
  if (!emailHmac) return { ok: false, reason: "closed" };

  await store.unsubscribeHausUpdate(email, emailHmac);
  return { ok: true };
}

export async function confirmHausUpdate(
  token: string | null | undefined,
  store: HausUpdateWrite,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: true; sent: false } | { ok: false; reason: "off" | "token" | "missing" | "closed"; sent: false }> {
  if (!hausUpdatesDoubleOptInEnabled(env)) {
    return { ok: false, reason: "off", sent: false };
  }
  let email: string | null = null;
  try {
    email = openHausMailToken(token, "confirm");
  } catch {
    return { ok: false, reason: "closed", sent: false };
  }
  if (!email) return { ok: false, reason: "token", sent: false };
  const confirmed = await store.confirmHausUpdate(email);
  if (!confirmed.ok) return { ok: false, reason: "missing", sent: false };
  return { ok: true, sent: false };
}
