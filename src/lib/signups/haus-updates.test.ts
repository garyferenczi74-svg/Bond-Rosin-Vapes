import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { hashLockoutValue } from "../lockout.ts";
import {
  applyUnsubscribe,
  confirmHausUpdate,
  hausConfirmTokenExpired,
  hausUpdateOptInAccepted,
  hausUpdatesDoubleOptInEnabled,
  isOpaqueHausToken,
  recordHausUpdateOptIn,
  rfc8058OneClick,
  saveHausSalonOptIn,
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
};

function withAck(store: MemorySignupStore) {
  store.recordHausSignup(door.email, "Harbor House");
  return store;
}

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
  assert.equal(actions.includes("ageGate"), false);
  assert.equal(welcome.includes("ageGate"), false);
  assert.match(actions, /source: "haus_door"/);
  assert.match(read("src/lib/signups/haus-updates.ts"), /source: "haus_page"/);
  assert.equal(actions.includes("attested21"), false);
  assert.match(welcome, /hausCheckRowStyle/);
  const optIn = read("src/app/haus/updates-opt-in.tsx");
  assert.match(optIn, /hausCheckRowStyle/);
  assert.match(optIn, /checked=\{on\}/);
  assert.match(optIn, /preventDefault\(\)/);
  assert.equal(optIn.includes("action={onSave}"), false);
  assert.match(read("src/app/haus/salon/page.tsx"), /subscribed=\{subscribed\}/);
  const salon = actions.slice(actions.indexOf("export async function optInHausUpdatesAction"));
  assert.match(salon, /saveHausSalonOptIn/);
  assert.match(salon, /email: session\.email/);
  assert.equal(salon.includes('formData.get("email")'), false);
  const choice = read("src/lib/signups/haus-updates.ts");
  assert.equal(choice.includes("so Bond will not add it again"), false);
  assert.match(choice, /reoptHausUpdate/);
  assert.match(choice, /unsubscribeHausUpdate/);
  const doorFn = actions.slice(
    actions.indexOf("export async function enterHausAction"),
    actions.indexOf("export async function optInHausUpdatesAction"),
  );
  assert.equal(doorFn.includes("reoptHausUpdate"), false);
  assert.equal(doorFn.includes("saveHausSalonOptIn"), false);
  assert.match(choice, /Bond Haus updates are off for this email\./);
  assert.match(choice, /Bond could not save that opt in\./);
  assert.equal(read("src/app/haus/unsubscribe/route.ts").includes("This email unsubscribed from Bond Haus updates"), false);
  const optInTag = optIn.match(/<input[^>]*name="hausUpdates"[^>]*>/);
  assert.ok(optInTag);
  assert.equal(optInTag[0].includes("defaultChecked"), false);
});

test("a server-side 21+ ack is required and a client age flag is not", async () => {
  assert.equal(hausUpdateOptInAccepted({ optedIn: true, serverAge21Ack: true }), true);
  assert.equal(hausUpdateOptInAccepted({ optedIn: true, serverAge21Ack: false }), false);
  assert.equal(hausUpdateOptInAccepted({ optedIn: false, serverAge21Ack: true }), false);

  const blocked = new MemorySignupStore();
  const refused = await recordHausUpdateOptIn({
    ...door,
    store: blocked,
    env: {},
  });
  assert.equal(refused.recorded, false);
  assert.equal(blocked.listHausUpdates().length, 0);

  const acceptedStore = withAck(new MemorySignupStore());
  const accepted = await recordHausUpdateOptIn({
    ...door,
    store: acceptedStore,
    env: {},
  });
  assert.equal(accepted.recorded, true);
  assert.equal(acceptedStore.listHausUpdates().length, 1);
});

test("opt-in is skipped when the box is unticked", async () => {

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
});

test("a suppressed email is rejected and a repeat opt-in stays one row", async () => {
  const store = withAck(new MemorySignupStore());
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
  await store.unsubscribeHausUpdate(hmac);
  assert.equal(store.hasHausUpdate(door.email), false);
  const again = await recordHausUpdateOptIn({ ...door, store, env: {} });
  assert.equal(again.ok, false);
  assert.equal(again.reason, "suppressed");
  assert.equal(store.listHausUpdates().length, 0);
});

test("unsubscribe deletes the row, adds suppression, and rejects an invalid token", async () => {
  const store = withAck(new MemorySignupStore());
  const recorded = await recordHausUpdateOptIn({ ...door, store, env: {} });
  const token = recorded.unsubscribeToken ?? "";
  assert.equal(isOpaqueHausToken(token), true);
  assert.equal(token.includes("@"), false);
  assert.equal(token.toLowerCase().includes("member"), false);
  assert.equal(Buffer.from(token, "base64url").toString("utf8").includes(door.email), false);
  assert.equal(store.readHausUpdateToken(token)?.purpose, "unsub");
  assert.equal(store.listHausUpdates().length, 1);

  const invalid = await applyUnsubscribe("not-a-token", {
    recordHausUpdate() {
      throw new Error("should not write");
    },
    issueHausUpdateToken() {
      throw new Error("should not write");
    },
    readHausUpdateToken() {
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
  assert.equal(store.readHausUpdateToken(token), null);
  const ledger = store.ledger();
  assert.equal(ledger.updates.length, 0);

  const confirmOnly = withAck(new MemorySignupStore());
  const withConfirm = await recordHausUpdateOptIn({
    ...door,
    store: confirmOnly,
    env: { BOND_HAUS_UPDATES_DOUBLE_OPT_IN: "on" },
    deliver: async (delivery) => {
      assert.equal(delivery.confirmUrl.includes(door.email), false);
      assert.equal(delivery.confirmUrl.includes("@"), false);
      assert.match(delivery.confirmUrl, /token=[0-9a-f-]{36}/i);
      return { attempted: false };
    },
  });
  assert.equal(isOpaqueHausToken(withConfirm.confirmToken), true);
  assert.equal((withConfirm.confirmToken ?? "").includes(door.email), false);
  const confirmRow = confirmOnly.readHausUpdateToken(withConfirm.confirmToken ?? "");
  const unsubRow = confirmOnly.readHausUpdateToken(withConfirm.unsubscribeToken ?? "");
  assert.equal(confirmRow?.purpose, "confirm");
  assert.equal(unsubRow?.expiresAt, null);
  assert.equal(hausConfirmTokenExpired(confirmRow ?? { purpose: "confirm", expiresAt: null }), false);
  assert.equal(hausConfirmTokenExpired(unsubRow ?? { purpose: "unsub", expiresAt: null }), false);
  const confirmLeft = Date.parse(confirmRow?.expiresAt ?? "") - Date.now();
  assert.ok(confirmLeft > 6 * 24 * 60 * 60 * 1000);
  assert.ok(confirmLeft < 8 * 24 * 60 * 60 * 1000);
  confirmOnly.setHausUpdateTokenExpiry(withConfirm.confirmToken ?? "", "2020-01-01T00:00:00.000Z");
  const expired = await confirmHausUpdate(withConfirm.confirmToken, confirmOnly, {
    BOND_HAUS_UPDATES_DOUBLE_OPT_IN: "on",
  });
  assert.equal(expired.ok, false);
  if (!expired.ok) assert.equal(expired.reason, "expired");
  assert.equal(confirmOnly.listHausUpdates()[0]?.confirmedAt, null);
  const wrong = await applyUnsubscribe(withConfirm.confirmToken, confirmOnly);
  assert.equal(wrong.ok, false);
  assert.equal(confirmOnly.listHausUpdates().length, 1);
  assert.equal(confirmOnly.readHausUpdateToken(withConfirm.confirmToken ?? "")?.purpose, "confirm");
  const cleared = await applyUnsubscribe(withConfirm.unsubscribeToken, confirmOnly);
  assert.equal(cleared.ok, true);
  assert.equal(confirmOnly.readHausUpdateToken(withConfirm.unsubscribeToken ?? ""), null);
  assert.equal(confirmOnly.readHausUpdateToken(withConfirm.confirmToken ?? ""), null);
});

test("the double opt-in flag is off, so no send is attempted", async () => {
  const previous = process.env.BOND_HAUS_UPDATES_DOUBLE_OPT_IN;
  delete process.env.BOND_HAUS_UPDATES_DOUBLE_OPT_IN;
    const store = withAck(new MemorySignupStore());
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
    const confirm = await confirmHausUpdate("11111111-1111-4111-8111-111111111111", {
      recordHausUpdate() {
        return { ok: true };
      },
      issueHausUpdateToken() {
        return { id: "11111111-1111-4111-8111-111111111111" };
      },
      readHausUpdateToken() {
        confirmWrites += 1;
        return { emailHmac: "ab".repeat(32), purpose: "confirm" };
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
  const unsubGet = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /List-Unsubscribe=One-Click/);
  assert.match(route, /applyUnsubscribe/);
  assert.equal(unsubGet.includes("applyUnsubscribe"), false);
  assert.match(unsubGet, /confirmPage\(token\)/);
  assert.match(route, /method="post"/);
  assert.equal(rfc8058OneClick("List-Unsubscribe=One-Click", null), true);
  assert.equal(rfc8058OneClick("", "List-Unsubscribe=One-Click"), true);
  assert.equal(rfc8058OneClick("token=1", null), false);
  const confirmRoute = read("src/app/haus/updates/confirm/route.ts");
  const confirmGet = confirmRoute.slice(
    confirmRoute.indexOf("export async function GET"),
    confirmRoute.indexOf("export async function POST"),
  );
  assert.match(confirmRoute, /This confirmation link has expired\./);
  assert.match(confirmRoute, /confirmHausUpdate/);
  assert.equal(confirmGet.includes("confirmHausUpdate("), false);
  assert.match(confirmGet, /confirmPage\(token\)/);
  assert.match(confirmRoute, /method="post"/);
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
  assert.equal(privacy.includes("Bond does not store a Haus correspondence preference"), false);
  assert.equal(privacy.includes("unsubscribe page"), false);
  assert.equal(privacy.includes("consented_at"), false);
  assert.equal(privacy.includes("consent_at"), false);
  assert.equal(privacy.includes("age gate flag is present"), false);
  assert.match(
    privacy,
    /If you opt in on the Haus door or on your Haus page, Bond keeps your email, the time you opted in, and the source, so Bond can send Bond Haus updates\. That opt in is separate from a product request and it starts unticked\. Bond accepts that opt in only when this server has your 21 or older attestation for that email\./,
  );
  assert.match(
    privacy,
    /You can unsubscribe from the email link or by unticking the box on your Haus page\. After you unsubscribe, Bond will not add that email again unless you opt back in yourself on your Haus page while signed in\./,
  );
  assert.match(
    privacy,
    /The audit log also records a member opting back in, and that record keeps only a keyed hash of the email\./,
  );
  assert.match(
    privacy,
    /While you are signed in, your session keeps your email on the server until you sign out or the session expires, and then it is deleted\./,
  );
  assert.match(
    privacy,
    /If you opt in on the Haus door or on your Haus page, Bond keeps that email, the time you opted in, and the source for 24 months after the time you opted in, or for 24 months after a later confirmation, whichever is later\. When you unsubscribe, Bond deletes the email sooner\. Bond then keeps only a keyed hash of the address, and Bond keeps that hash for as long as it needs to honor the unsubscribe\./,
  );
  assert.match(
    privacy,
    /Unsubscribe and confirmation links use a random id tied only to a keyed hash of the email\. A confirmation id expires after 7 days\. An unsubscribe id does not expire\. Those ids are deleted with the record or when you unsubscribe\. Unused confirmation and unsubscribe ids with no record are deleted after 30 days\./,
  );
  assert.match(privacy, /Bond sends no Bond Haus update emails yet\./);
  assert.match(privacy, /Any email service will be named on this page before the first send\./);
  assert.match(privacy, /The Home Haus form stores nothing and sends nothing\. Nothing else\./);
  for (const sentence of [
    "If you opt in on the Haus door or on your Haus page, Bond keeps your email, the time you opted in, and the source, so Bond can send Bond Haus updates. That opt in is separate from a product request and it starts unticked. Bond accepts that opt in only when this server has your 21 or older attestation for that email.",
    "You can unsubscribe from the email link or by unticking the box on your Haus page. After you unsubscribe, Bond will not add that email again unless you opt back in yourself on your Haus page while signed in.",
    "The audit log also records a member opting back in, and that record keeps only a keyed hash of the email.",
    "While you are signed in, your session keeps your email on the server until you sign out or the session expires, and then it is deleted.",
    "If you opt in on the Haus door or on your Haus page, Bond keeps that email, the time you opted in, and the source for 24 months after the time you opted in, or for 24 months after a later confirmation, whichever is later. When you unsubscribe, Bond deletes the email sooner. Bond then keeps only a keyed hash of the address, and Bond keeps that hash for as long as it needs to honor the unsubscribe. Unsubscribe and confirmation links use a random id tied only to a keyed hash of the email. A confirmation id expires after 7 days. An unsubscribe id does not expire. Those ids are deleted with the record or when you unsubscribe. Unused confirmation and unsubscribe ids with no record are deleted after 30 days. Bond sends no Bond Haus update emails yet. Any email service will be named on this page before the first send.",
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
  assert.match(migration, /haus_updates_suppression suppressed/);
  assert.equal(migration.includes("is_admin()"), false);
  const hold = read("supabase/migrations/20261009203000_haus_updates_hold.sql");
  assert.match(hold, /DROP POLICY IF EXISTS haus_updates_anon_insert/);
  assert.match(hold, /REVOKE ALL ON TABLE public\.haus_updates FROM anon/);
  assert.match(hold, /REVOKE ALL ON TABLE public\.haus_updates FROM service_role/);
  assert.match(hold, /REVOKE ALL ON TABLE public\.haus_updates_suppression FROM service_role/);
  assert.match(hold, /bond\.haus_update_via_function/);
  assert.match(hold, /bond_purge_haus_updates/);
  assert.match(hold, /GREATEST\(consent_at, COALESCE\(confirmed_at, consent_at\)\)/);
  assert.match(hold, /'45 4 \* \* \*'/);
  assert.match(hold, /CREATE TABLE public\.haus_update_tokens/);
  assert.match(hold, /email_hmac text NOT NULL/);
  assert.equal(/GRANT INSERT ON TABLE public\.haus_updates TO anon/.test(hold), false);
  assert.equal(hold.includes("is_admin()"), false);
  assert.equal(hold.includes("consented_at"), false);
});

test("a missing hash key in production does not store the update", async () => {
  const prevNode = process.env.NODE_ENV;
  const prevHash = process.env.BOND_HASH_KEY;
  process.env.NODE_ENV = "production";
  delete process.env.BOND_HASH_KEY;
  try {
    const store = withAck(new MemorySignupStore());
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

test("the salon box is ticked when a row exists and untick unsubscribes", async () => {
  const store = withAck(new MemorySignupStore());
  assert.equal(store.hasHausUpdate(door.email), false);
  const recorded = await recordHausUpdateOptIn({ ...door, store, env: {} });
  const unsubId = recorded.unsubscribeToken ?? "";
  const hmac = hashLockoutValue(door.email);
  const confirm = store.issueHausUpdateToken(hmac, "confirm");
  assert.equal(store.hasHausUpdate(door.email), true);
  assert.equal(store.listHausUpdates().length, 1);

  let unsubscribed = 0;
  const original = store.unsubscribeHausUpdate.bind(store);
  store.unsubscribeHausUpdate = (emailHmac: string) => {
    unsubscribed += 1;
    return original(emailHmac);
  };

  const off = await saveHausSalonOptIn({ email: door.email, optedIn: false, store, env: {} });
  assert.equal(unsubscribed, 1);
  assert.equal(off.ok, true);
  assert.equal(off.subscribed, false);
  assert.equal(off.message, "Bond Haus updates are off for this email.");
  assert.equal(store.hasHausUpdate(door.email), false);
  assert.equal(store.listHausUpdates().length, 0);
  assert.equal(store.readHausUpdateToken(unsubId), null);
  assert.equal(store.readHausUpdateToken(confirm.id), null);
  const again = await recordHausUpdateOptIn({ ...door, store, env: {} });
  assert.equal(again.ok, false);
  assert.equal(again.reason, "suppressed");
  assert.equal(store.listHausUpdates().length, 0);

  const page = read("src/app/haus/salon/page.tsx");
  const optIn = read("src/app/haus/updates-opt-in.tsx");
  assert.match(page, /hasHausUpdate\(member\.email\)/);
  assert.match(page, /subscribed=\{subscribed\}/);
  assert.match(optIn, /useState\(subscribed\)/);
  assert.match(optIn, /checked=\{on\}/);
});

test("a thrown Haus update read or unsubscribe shows the could not save message", async () => {
  const stored = withAck(new MemorySignupStore());
  await recordHausUpdateOptIn({ ...door, store: stored, env: {} });
  let unsubscribed = 0;
  stored.hasHausUpdate = () => {
    throw new Error("permission denied for table haus_updates");
  };
  stored.unsubscribeHausUpdate = () => {
    unsubscribed += 1;
    return { ok: true };
  };
  const unread = await saveHausSalonOptIn({ email: door.email, optedIn: false, store: stored, env: {} });
  assert.equal(unread.ok, false);
  assert.equal(unread.subscribed, true);
  assert.equal(unread.message, "Bond could not save that opt in.");
  assert.equal(unsubscribed, 0);
  assert.equal(stored.listHausUpdates().length, 1);

  const failing = withAck(new MemorySignupStore());
  await recordHausUpdateOptIn({ ...door, store: failing, env: {} });
  let called = 0;
  failing.unsubscribeHausUpdate = () => {
    called += 1;
    throw new Error("permission denied");
  };
  const unsub = await saveHausSalonOptIn({ email: door.email, optedIn: false, store: failing, env: {} });
  assert.equal(called, 1);
  assert.equal(unsub.ok, false);
  assert.equal(unsub.subscribed, true);
  assert.equal(unsub.message, "Bond could not save that opt in.");
  assert.equal(failing.listHausUpdates().length, 1);

  const ticking = withAck(new MemorySignupStore());
  ticking.recordHausUpdate = () => {
    throw new Error("permission denied");
  };
  const boom = await saveHausSalonOptIn({ email: door.email, optedIn: true, store: ticking, env: {} });
  assert.equal(boom.ok, false);
  assert.equal(boom.subscribed, false);
  assert.equal(boom.message, "Bond could not save that opt in.");
  assert.equal(ticking.listHausUpdates().length, 0);

  const remote = read("src/lib/signups/remote.ts");
  const reader = remote.slice(remote.indexOf("async hasHausUpdate"), remote.indexOf("async hasHausAge21Ack"));
  assert.match(reader, /bond_has_haus_update/);
  assert.match(reader, /throw new Error\("Haus update was not read\."\)/);
  assert.equal(reader.includes("return false"), false);
  assert.equal(reader.includes('.from("haus_updates")'), false);
  const opener = remote.slice(remote.indexOf("async openHausSession"), remote.indexOf("async readHausSession"));
  assert.match(opener, /hashLockoutValue\(mark\)/);
  assert.match(opener, /email_hmac: emailHmac/);
});

test("a token failure after opt in keeps the subscribed state", async () => {
  const errors: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  try {
    const first = withAck(new MemorySignupStore());
    first.openHausSession(door.email);
    first.issueHausUpdateToken = () => {
      throw new Error("token store down");
    };
    const on = await saveHausSalonOptIn({ email: door.email, optedIn: true, store: first, env: {} });
    assert.equal(on.ok, true);
    assert.equal(on.subscribed, true);
    assert.equal(on.message, "Bond Haus updates are on for this email.");
    assert.equal(first.hasHausUpdate(door.email), true);
    assert.equal(errors.some((row) => String(row[0]).includes(door.email)), false);
    assert.match(String(errors[0]?.[0]), /Haus update token was not issued/);

    const again = withAck(new MemorySignupStore());
    again.openHausSession(door.email);
    await recordHausUpdateOptIn({ ...door, store: again, env: {} });
    await again.unsubscribeHausUpdate(hashLockoutValue(door.email));
    again.issueHausUpdateToken = () => {
      throw new Error("token store down");
    };
    const back = await saveHausSalonOptIn({ email: door.email, optedIn: true, store: again, env: {} });
    assert.equal(back.ok, true);
    assert.equal(back.subscribed, true);
    assert.equal(back.message, "Bond Haus updates are on for this email.");
    assert.equal(again.hasHausUpdate(door.email), true);
    assert.equal(again.listHausUpdates()[0]?.source, "salon");
  } finally {
    console.error = original;
  }
});

test("a salon re-tick clears suppression and the door does not", async () => {
  const store = withAck(new MemorySignupStore());
  store.openHausSession(door.email);
  const first = await recordHausUpdateOptIn({ ...door, store, env: {} });
  assert.equal(first.recorded, true);
  const oldConsent = store.listHausUpdates()[0]?.consentAt;
  assert.equal(store.listHausUpdates()[0]?.source, "haus_door");

  const off = await saveHausSalonOptIn({ email: door.email, optedIn: false, store, env: {} });
  assert.equal(off.message, "Bond Haus updates are off for this email.");
  assert.equal(store.hasHausUpdate(door.email), false);

  const doorAgain = await recordHausUpdateOptIn({ ...door, store, env: {} });
  assert.equal(doorAgain.reason, "suppressed");
  assert.equal(store.hasHausUpdate(door.email), false);

  await new Promise((resolve) => setTimeout(resolve, 5));
  const back = await saveHausSalonOptIn({ email: door.email, optedIn: true, store, env: {} });
  assert.equal(back.ok, true);
  assert.equal(back.subscribed, true);
  assert.equal(back.message, "Bond Haus updates are on for this email.");
  assert.equal(store.hasHausUpdate(door.email), true);
  assert.equal(store.listHausUpdates()[0]?.source, "salon");
  assert.notEqual(store.listHausUpdates()[0]?.consentAt, oldConsent);

  await store.unsubscribeHausUpdate(hashLockoutValue(door.email));
  assert.equal(store.hasHausUpdate(door.email), false);
  const linked = await recordHausUpdateOptIn({ ...door, store, env: {} });
  assert.equal(linked.reason, "suppressed");

  const quiet = withAck(new MemorySignupStore());
  await recordHausUpdateOptIn({ ...door, store: quiet, env: {} });
  await quiet.unsubscribeHausUpdate(hashLockoutValue(door.email));
  assert.equal(quiet.reoptHausUpdate(door.email), false);
  assert.equal(quiet.hasHausUpdate(door.email), false);

  const bare = new MemorySignupStore();
  bare.openHausSession("bare@bond.test");
  assert.equal(bare.reoptHausUpdate("bare@bond.test"), false);

  const split = withAck(new MemorySignupStore());
  await recordHausUpdateOptIn({ ...door, store: split, env: {} });
  await split.unsubscribeHausUpdate(hashLockoutValue(door.email));
  split.openHausSession("other@bond.test");
  split.recordHausSignup("other@bond.test", "Other House");
  assert.equal(split.reoptHausUpdate(door.email), false);
  assert.equal(split.hasHausUpdate(door.email), false);
  assert.equal(split.reoptHausUpdate("other@bond.test"), true);
  assert.equal(split.hasHausUpdate(door.email), false);
  assert.equal(split.listHausUpdates()[0]?.email, "other@bond.test");
});
