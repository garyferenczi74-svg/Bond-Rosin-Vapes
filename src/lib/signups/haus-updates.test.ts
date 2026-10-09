import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { hashLockoutValue } from "../lockout.ts";
import {
  applyUnsubscribe,
  confirmHausUpdate,
  hausUpdateOptInAccepted,
  hausUpdatesDoubleOptInEnabled,
  openHausMailToken,
  recordHausUpdateOptIn,
  rfc8058OneClick,
  sealHausMailToken,
} from "./haus-updates.ts";
import { deliverHausUpdateConfirmation } from "./haus-updates-mail.ts";
import { MemorySignupStore } from "./memory.ts";

const root = fileURLToPath(new URL("../../..", import.meta.url));

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const door = {
  email: "member@bond.test",
  source: "haus_door",
  optedIn: true,
  attested21: true,
  ageVerified: true,
};

test("the Bond Haus updates checkbox is unticked and separate from the request", () => {
  const welcome = read("src/app/haus/welcome-client.tsx");
  assert.match(welcome, /I confirm I am 21 or older\./);
  assert.match(welcome, /This is a self-attestation\./);
  assert.match(welcome, /Send me Bond Haus updates by email\. I can unsubscribe at any time\./);
  const tag = welcome.match(/<input[^>]*name="hausUpdates"[^>]*>/);
  assert.ok(tag);
  assert.equal(tag[0].includes("defaultChecked"), false);
  assert.equal(/\schecked\b/.test(tag[0]), false);
  assert.equal(tag[0].includes("required"), false);
  const actions = read("src/app/haus/actions.ts");
  assert.match(actions, /recordHausUpdateOptIn/);
  assert.match(actions, /hausUpdates/);
  assert.match(actions, /ageGate/);
  assert.match(actions, /source: "haus_door"/);
});

test("opt-in is accepted only with the 21+ attestation and age verification", async () => {
  assert.equal(hausUpdateOptInAccepted({ optedIn: true, attested21: true, ageVerified: true }), true);
  assert.equal(hausUpdateOptInAccepted({ optedIn: true, attested21: false, ageVerified: true }), false);
  assert.equal(hausUpdateOptInAccepted({ optedIn: true, attested21: true, ageVerified: false }), false);
  assert.equal(hausUpdateOptInAccepted({ optedIn: false, attested21: true, ageVerified: true }), false);

  const skipped = new MemorySignupStore();
  const without = await recordHausUpdateOptIn({
    ...door,
    optedIn: false,
    store: skipped,
    env: {},
  });
  assert.equal(without.recorded, false);
  assert.equal(without.confirmationAttempted, false);
  assert.equal(skipped.listHausUpdates().length, 0);
  await skipped.recordHausSignup("member@bond.test", "Harbor House");
  assert.equal(skipped.listHausUpdates().length, 0);

  const blocked = new MemorySignupStore();
  const refused = await recordHausUpdateOptIn({
    ...door,
    attested21: false,
    store: blocked,
    env: {},
  });
  assert.equal(refused.recorded, false);
  assert.equal(blocked.listHausUpdates().length, 0);
});

test("a suppressed email is rejected and a repeat opt-in stays one row", async () => {
  const store = new MemorySignupStore();
  const first = await recordHausUpdateOptIn({ ...door, store, env: {} });
  assert.equal(first.recorded, true);
  const consentAt = store.listHausUpdates()[0]?.consentAt;
  const second = await recordHausUpdateOptIn({ ...door, store, env: {} });
  assert.equal(second.recorded, true);
  assert.equal(store.listHausUpdates().length, 1);
  assert.equal(store.listHausUpdates()[0]?.consentAt, consentAt);
  assert.equal(store.listHausUpdates()[0]?.confirmedAt, null);
  assert.equal(store.listHausUpdates()[0]?.source, "haus_door");

  const hmac = hashLockoutValue(door.email);
  await store.unsubscribeHausUpdate(door.email, hmac);
  const again = await recordHausUpdateOptIn({ ...door, store, env: {} });
  assert.equal(again.ok, false);
  assert.equal(again.reason, "suppressed");
  assert.equal(store.listHausUpdates().length, 0);
});

test("unsubscribe deletes the row, adds suppression, and rejects an invalid token", async () => {
  const store = new MemorySignupStore();
  await recordHausUpdateOptIn({ ...door, store, env: {} });
  const token = sealHausMailToken(door.email, "unsub");
  assert.equal(openHausMailToken(token, "unsub"), door.email);
  assert.equal(openHausMailToken(token, "confirm"), null);
  assert.equal(openHausMailToken(`${token}tamper`, "unsub"), null);
  assert.equal(openHausMailToken("hm1.unsub.aaaa.bbbb", "unsub"), null);

  const invalid = await applyUnsubscribe("not-a-token", {
    recordHausUpdate() {
      throw new Error("should not write");
    },
    unsubscribeHausUpdate() {
      throw new Error("should not write");
    },
    confirmHausUpdate() {
      throw new Error("should not write");
    },
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.reason, "token");
  assert.equal(store.listHausUpdates().length, 1);

  const done = await applyUnsubscribe(token, store);
  assert.equal(done.ok, true);
  assert.equal(store.listHausUpdates().length, 0);
  const ledger = store.ledger();
  assert.equal(ledger.updates.length, 0);

  const confirmToken = sealHausMailToken(door.email, "confirm");
  const wrong = await applyUnsubscribe(confirmToken, store);
  assert.equal(wrong.ok, false);
});

test("the double opt-in flag is off, so no send is attempted", async () => {
  const previous = process.env.BOND_HAUS_UPDATES_DOUBLE_OPT_IN;
  delete process.env.BOND_HAUS_UPDATES_DOUBLE_OPT_IN;
  const store = new MemorySignupStore();
  let delivered = 0;
  try {
    assert.equal(hausUpdatesDoubleOptInEnabled(), false);
    assert.equal(hausUpdatesDoubleOptInEnabled({}), false);
    const result = await recordHausUpdateOptIn({
      ...door,
      store,
      deliver: async () => {
        delivered += 1;
        return { attempted: false };
      },
    });
    assert.equal(result.confirmationAttempted, false);
    assert.equal(delivered, 0);
    assert.equal(store.listHausUpdates()[0]?.confirmedAt, null);

    let confirmWrites = 0;
    const confirm = await confirmHausUpdate(sealHausMailToken(door.email, "confirm"), {
      recordHausUpdate() {
        return { ok: true };
      },
      unsubscribeHausUpdate() {
        return { ok: true };
      },
      confirmHausUpdate() {
        confirmWrites += 1;
        return { ok: true };
      },
    }, {});
    assert.equal(confirm.ok, false);
    if (!confirm.ok) assert.equal(confirm.reason, "off");
    assert.equal(confirm.sent, false);
    assert.equal(confirmWrites, 0);
  } finally {
    if (previous === undefined) delete process.env.BOND_HAUS_UPDATES_DOUBLE_OPT_IN;
    else process.env.BOND_HAUS_UPDATES_DOUBLE_OPT_IN = previous;
  }

  const mail = read("src/lib/signups/haus-updates-mail.ts");
  assert.match(mail, /Provider plug-in/);
  assert.equal(/\bfetch\s*\(/.test(mail), false);
  assert.equal(/smtp|nodemailer|resend|postmark|sendgrid|mailgun/i.test(mail), false);
  let fetched = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    fetched += 1;
    throw new Error("send");
  };
  try {
    const sent = await deliverHausUpdateConfirmation({
      email: door.email,
      confirmUrl: "/haus/updates/confirm?token=unused",
    });
    assert.equal(sent.attempted, false);
    assert.equal(fetched, 0);
  } finally {
    globalThis.fetch = original;
  }

  const route = read("src/app/haus/unsubscribe/route.ts");
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /List-Unsubscribe=One-Click/);
  assert.match(route, /applyUnsubscribe/);
  assert.equal(rfc8058OneClick("List-Unsubscribe=One-Click", null), true);
  assert.equal(rfc8058OneClick("", "List-Unsubscribe=One-Click"), true);
  assert.equal(rfc8058OneClick("token=1", null), false);
  const confirmRoute = read("src/app/haus/updates/confirm/route.ts");
  assert.match(confirmRoute, /confirmHausUpdate/);
  assert.equal(/\bfetch\s*\(/.test(confirmRoute), false);
  assert.equal(/\bfetch\s*\(/.test(route), false);
});

test("owner reads update subscribers and Privacy matches the update list", () => {
  const ledger = read("src/lib/signups/ledger.ts");
  assert.match(ledger, /if \(role !== "owner"\) return null/);
  assert.match(ledger, /from\("haus_updates"\)/);
  const view = read("src/components/vauxhall/signup-ledger.tsx");
  assert.match(view, /Bond Haus updates/);
  assert.match(view, /subscribed/);
  assert.equal(/download|csv|export subscribers/i.test(view), false);

  const privacy = read("Privacy.dc.html");
  const terms = read("Terms.dc.html");
  assert.equal(privacy.includes("There is no Bond Haus email list"), false);
  assert.equal(terms.includes("There is no Bond Haus email list"), false);
  assert.match(privacy, /Bond does not store a Haus correspondence preference/);
  assert.match(
    privacy,
    /If you opt in on the Haus door, Bond keeps your email, the time you consented, and the source, so Bond can send Bond Haus updates\. That opt in is separate from a product request and it starts unticked\./,
  );
  assert.match(
    privacy,
    /Bond Haus updates are opt in\. You can unsubscribe from a link in every email, or from the unsubscribe page\. When you unsubscribe, Bond deletes the email and keeps only a keyed hash so the address is not added again\./,
  );
  assert.match(privacy, /Bond keeps that email, the consent time, and the source until you unsubscribe\./);
  assert.match(privacy, /Bond sends no Bond Haus update emails yet\./);
  assert.match(privacy, /Any email service will be named on this page before the first send\./);
  for (const sentence of [
    "If you opt in on the Haus door, Bond keeps your email, the time you consented, and the source, so Bond can send Bond Haus updates. That opt in is separate from a product request and it starts unticked.",
    "Bond Haus updates are opt in. You can unsubscribe from a link in every email, or from the unsubscribe page. When you unsubscribe, Bond deletes the email and keeps only a keyed hash so the address is not added again.",
    "Bond keeps that email, the consent time, and the source until you unsubscribe. Bond sends no Bond Haus update emails yet. Any email service will be named on this page before the first send.",
  ]) {
    assert.equal(sentence.includes("!"), false);
    assert.equal(sentence.includes(String.fromCharCode(0x2013)), false);
    assert.equal(sentence.includes(String.fromCharCode(0x2014)), false);
    assert.equal(/\b(free|discount|code|price|stock)\b/i.test(sentence), false);
  }

  const migration = read("supabase/migrations/20261009190000_haus_updates_optin.sql");
  assert.match(migration, /CREATE TABLE public\.haus_updates/);
  assert.match(migration, /email text PRIMARY KEY/);
  assert.match(migration, /consent_at timestamptz NOT NULL/);
  assert.match(migration, /source text NOT NULL/);
  assert.match(migration, /confirmed_at timestamptz/);
  assert.match(migration, /CREATE TABLE public\.haus_updates_suppression/);
  assert.match(migration, /email_hmac text PRIMARY KEY/);
  assert.match(migration, /created_at timestamptz NOT NULL/);
  assert.match(migration, /USING \(public\.is_owner\(\)\)/);
  assert.match(migration, /FOR INSERT\s+TO anon/);
  assert.match(migration, /haus_updates_suppression suppressed/);
  assert.equal(migration.includes("GRANT UPDATE"), false);
  assert.equal(migration.includes("GRANT DELETE"), false);
  assert.equal(migration.includes("is_admin()"), false);
});

test("a missing hash key in production does not store the update", async () => {
  const prevNode = process.env.NODE_ENV;
  const prevHash = process.env.BOND_HASH_KEY;
  process.env.NODE_ENV = "production";
  delete process.env.BOND_HASH_KEY;
  try {
    const store = new MemorySignupStore();
    const result = await recordHausUpdateOptIn({ ...door, store, env: {} });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "closed");
    assert.equal(result.confirmationAttempted, false);
    assert.equal(store.listHausUpdates().length, 0);
  } finally {
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
    if (prevHash === undefined) delete process.env.BOND_HASH_KEY;
    else process.env.BOND_HASH_KEY = prevHash;
  }
});
