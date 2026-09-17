import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GENERIC_DOOR } from "../access.ts";
import { VauxhallStore } from "../vauxhall/store.ts";
import { ORDER_COPY, PARTNER_SKU_LABELS } from "./copy.ts";
import {
  accountsToPersist,
  elevatePartnerAccount,
  findPartnerAccount,
  isPartnerElevated,
  mergePartnerAccounts,
  openPartnerDoor,
  registerPartnerDoor,
} from "./door.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import { parsePartnerDraftBundle, serializePartnerDraftBundle } from "./persist.ts";
import { clonePartnerAccounts, SEED_PARTNER_ACCOUNTS, SEED_PARTNER_PASSWORD } from "./seed.ts";
import { parsePartnerSession } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");

function read(rel: string) {
  return readFileSync(join(here, rel), "utf8");
}

function walkTs(rel: string, visit: (path: string, text: string) => void) {
  const full = join(root, rel);
  const stat = statSync(full);
  if (stat.isDirectory()) {
    for (const name of readdirSync(full)) walkTs(join(rel, name), visit);
    return;
  }
  if (!/\.(ts|tsx)$/.test(full) || full.endsWith(".test.ts")) return;
  visit(rel, readFileSync(full, "utf8"));
}

test("password hashes and never equals plaintext", () => {
  const record = hashPassword("Bond-Secret-21");
  assert.notEqual(record.passwordHash, "Bond-Secret-21");
  assert.notEqual(record.passwordSalt, "Bond-Secret-21");
  assert.equal(verifyPassword("Bond-Secret-21", record), true);
  assert.equal(verifyPassword("wrong-pass", record), false);
});

function newSignup(overrides: Partial<Parameters<typeof registerPartnerDoor>[0]> = {}) {
  return {
    dispensaryName: "Aurora Haus",
    address: "12 State Street, Albany, NY 12207",
    contactName: "Ada Buyer",
    phone: "518-555-0199",
    email: "new.buyer@example.test",
    license: "OCM-AUR-0999",
    password: "Bond-New-Door-21",
    confirm: "Bond-New-Door-21",
    age21: true,
    ...overrides,
  };
}

test("register creates a pending account only and retires invite binding", () => {
  const rows = clonePartnerAccounts();
  const created = registerPartnerDoor(newSignup(), rows);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.session.role, "partner");
  assert.equal(created.session.license, "OCM-AUR-0999");
  assert.equal(isPartnerElevated({ email: "new.buyer@example.test", license: "OCM-AUR-0999" }, rows), false);
  const stored = findPartnerAccount({ email: "new.buyer@example.test", license: "OCM-AUR-0999" }, rows);
  assert.ok(stored);
  assert.equal(stored.elevated, false);
  assert.equal(stored.dispensaryName, "Aurora Haus");
  assert.equal(stored.address, "12 State Street, Albany, NY 12207");
  assert.equal(stored.contactName, "Ada Buyer");
  assert.equal(stored.phone, "518-555-0199");
  assert.notEqual(stored.passwordHash, "Bond-New-Door-21");
  assert.equal(verifyPassword("Bond-New-Door-21", stored), true);
});

test("pending register cannot file a reservation until ops elevates", () => {
  const rows = clonePartnerAccounts();
  const created = registerPartnerDoor(
    newSignup({
      email: "hold.buyer@example.test",
      license: "OCM-AUR-0888",
      password: "Bond-Hold-Door-21",
      confirm: "Bond-Hold-Door-21",
    }),
    rows,
  );
  assert.equal(created.ok, true);
  const store = new VauxhallStore({ labDelayMs: 0, traceLatencyMs: 0 });
  assert.equal(isPartnerElevated({ email: "hold.buyer@example.test", license: "OCM-AUR-0888" }, rows), false);
  const blocked = store.createOrderRequest({
    accountId: created.ok ? created.session.accountId : "",
    lines: [{ skuId: "no-1", format: "1g", qty: 1 }],
    promisedOn: "2026-09-22",
  });
  assert.equal(blocked.ok, false);
  const lifted = elevatePartnerAccount("OCM-AUR-0888", rows);
  assert.equal(lifted.ok, true);
  assert.equal(isPartnerElevated({ email: "hold.buyer@example.test", license: "OCM-AUR-0888" }, rows), true);
});

test("seed pending account stays closed for reservation until ops elevates", () => {
  const rows = clonePartnerAccounts();
  const closed = openPartnerDoor(
    {
      email: "pending.buyer@example.test",
      password: SEED_PARTNER_PASSWORD,
    },
    rows,
  );
  assert.equal(closed.ok, true);
  if (closed.ok) assert.equal(isPartnerElevated(closed.session, rows), false);
  const lifted = elevatePartnerAccount("MOCK-LIC-PROTO-EAST", rows);
  assert.equal(lifted.ok, true);
  const opened = openPartnerDoor(
    {
      email: "pending.buyer@example.test",
      password: SEED_PARTNER_PASSWORD,
    },
    rows,
  );
  assert.equal(opened.ok, true);
  if (opened.ok) assert.equal(isPartnerElevated(opened.session, rows), true);
});

test("sign in is email and password only", () => {
  const miss = openPartnerDoor({
    email: "north.buyer@example.test",
    password: "wrong-password",
  });
  assert.equal(miss.ok, false);
  if (!miss.ok) assert.equal(miss.message, GENERIC_DOOR);
  const ok = openPartnerDoor({
    email: "North.Buyer@example.test",
    password: SEED_PARTNER_PASSWORD,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.session.role, "partner");
    assert.equal(ok.session.license, "MOCK-LIC-PROTO-NORTH");
  }
});

test("register rejects thin profile, invite-shaped shortcuts, and mismatched passwords", () => {
  const rows = clonePartnerAccounts();
  const nameless = registerPartnerDoor(newSignup({ dispensaryName: "A" }), rows);
  assert.equal(nameless.ok, false);
  if (!nameless.ok) assert.equal(nameless.message, ORDER_COPY.nameFail);
  const noStreet = registerPartnerDoor(newSignup({ address: "NY" }), rows);
  assert.equal(noStreet.ok, false);
  if (!noStreet.ok) assert.equal(noStreet.message, ORDER_COPY.addressFail);
  const noContact = registerPartnerDoor(newSignup({ contactName: "" }), rows);
  assert.equal(noContact.ok, false);
  if (!noContact.ok) assert.equal(noContact.message, ORDER_COPY.contactFail);
  const noPhone = registerPartnerDoor(newSignup({ phone: "555" }), rows);
  assert.equal(noPhone.ok, false);
  if (!noPhone.ok) assert.equal(noPhone.message, ORDER_COPY.phoneFail);
  const young = registerPartnerDoor(newSignup({ age21: false }), rows);
  assert.equal(young.ok, false);
  if (!young.ok) assert.match(young.message, /21 and over/);
  const mismatch = registerPartnerDoor(
    newSignup({
      email: "pair.buyer@example.test",
      license: "OCM-AUR-0777",
      password: "Bond-Pair-Door-21",
      confirm: "Bond-Pair-Other-21",
    }),
    rows,
  );
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.message, ORDER_COPY.matchFail);
  const taken = registerPartnerDoor(
    newSignup({
      email: "north.buyer@example.test",
      license: "OCM-AUR-0666",
      password: "Bond-Taken-Door-21",
      confirm: "Bond-Taken-Door-21",
    }),
    rows,
  );
  assert.equal(taken.ok, false);
});

test("partner session parse stays license-linked and drops invite codes", () => {
  assert.equal(parsePartnerSession(null), null);
  assert.equal(parsePartnerSession('{"email":"north.buyer@example.test","role":"member"}'), null);
  const session = parsePartnerSession(
    JSON.stringify({
      email: "North.Buyer@example.test",
      accountId: "acct-north",
      license: "MOCK-LIC-PROTO-NORTH",
      age21: true,
      role: "partner",
    }),
  );
  assert.ok(session);
  assert.equal(session.email, "north.buyer@example.test");
  assert.equal(findPartnerAccount(session)?.accountId, "acct-north");
  assert.equal("inviteCode" in session, false);
});

test("persisted book keeps seed passwords and can mark elevation", () => {
  const rows = clonePartnerAccounts();
  elevatePartnerAccount("MOCK-LIC-PROTO-EAST", rows);
  const persisted = accountsToPersist(rows);
  const merged = mergePartnerAccounts(clonePartnerAccounts(), persisted);
  const pending = findPartnerAccount({ email: "pending.buyer@example.test", license: "MOCK-LIC-PROTO-EAST" }, merged);
  assert.ok(pending);
  assert.equal(pending.elevated, true);
  assert.equal(pending.dispensaryName, "Prototype Dispensary East");
  assert.equal(verifyPassword(SEED_PARTNER_PASSWORD, pending), true);
});

test("elevated MOCK license can file a draft without allocating lots or writing Metrc", async () => {
  const store = new VauxhallStore({ labDelayMs: 0, traceLatencyMs: 0 });
  const beforeAvail = store.availableForSku("no-1");
  const beforeTransfers = store.traceSnap.transfers.length;
  const result = store.createOrderRequest({
    accountId: "acct-north",
    lines: [
      { skuId: "no-1", format: "1g", qty: 12 },
      { skuId: "no-2", format: "1g", qty: 4 },
    ],
    promisedOn: "2026-09-22",
    notes: "Dock 2. No ID images.",
    actor: "north.buyer@example.test",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const order = store.listOrders().find((row) => row.id === result.id);
  assert.ok(order);
  assert.equal(order.stage, "draft");
  assert.equal(order.source, "partner");
  assert.equal(order.notes, "Dock 2. No ID images.");
  assert.match(order.documents, /No Metrc write/);
  assert.ok(order.lines.every((line) => line.batchLabel === "Unallocated request"));
  assert.ok(order.lines.every((line) => !line.metrcUid));
  assert.equal(store.availableForSku("no-1"), beforeAvail);
  assert.equal(store.traceSnap.transfers.length, beforeTransfers);
  assert.ok(store.listEvents().some((event) => event.type === "ORDER_REQUEST" && event.summary === "ORDER_REQUEST"));
  const attached = await store.attachManifest(result.id);
  assert.equal(attached.ok, true);
  const transfer = store.traceSnap.transfers[0];
  assert.ok(transfer);
  assert.equal(JSON.stringify(transfer).includes("Dock 2"), false);
  assert.equal(JSON.stringify(transfer).includes(order.notes ?? "Dock 2"), false);
});

test("expired and inactive mock licenses are named refusing gates", () => {
  const store = new VauxhallStore({ labDelayMs: 0, traceLatencyMs: 0 });
  const expired = store.createOrderRequest({
    accountId: "acct-lapsed",
    lines: [{ skuId: "no-1", format: "1g", qty: 1 }],
    promisedOn: "2026-09-22",
  });
  assert.equal(expired.ok, false);
  if (!expired.ok) assert.equal(expired.reason, "License gate: Expired mock license. Order blocked.");
  const inactive = store.createOrderRequest({
    accountId: "acct-metro",
    lines: [{ skuId: "no-1", format: "1g", qty: 1 }],
    promisedOn: "2026-09-22",
  });
  assert.equal(inactive.ok, false);
  if (!inactive.ok) assert.equal(inactive.reason, "Facility gate: Metrc facility is inactive. Order blocked.");
});

test("partner draft persist hydrates the Vauxhall order book", () => {
  const writer = new VauxhallStore({ labDelayMs: 0, traceLatencyMs: 0 });
  const filed = writer.createOrderRequest({
    accountId: "acct-north",
    lines: [{ skuId: "no-3", format: "1g", qty: 2 }],
    promisedOn: "2026-09-22",
  });
  assert.equal(filed.ok, true);
  if (!filed.ok) return;
  const order = writer.listOrders().find((row) => row.id === filed.id);
  const event = writer.listEvents().find((row) => row.type === "ORDER_REQUEST");
  assert.ok(order);
  assert.ok(event);
  const raw = serializePartnerDraftBundle({
    orders: [
      {
        id: order.id,
        accountId: order.accountId,
        stage: "draft",
        promisedOn: order.promisedOn,
        late: order.late,
        manifestNumber: order.manifestNumber,
        lines: order.lines,
        documents: order.documents,
        notes: order.notes,
        source: "partner",
      },
    ],
    events: [
      {
        id: event.id,
        time: event.time,
        agent: "Q",
        type: "ORDER_REQUEST",
        summary: event.summary,
        sub: event.sub,
        audit: event.audit,
      },
    ],
  });
  const reader = new VauxhallStore({ labDelayMs: 0, traceLatencyMs: 0 });
  assert.equal(reader.listOrders().some((row) => row.id === filed.id), false);
  reader.ingestPartnerRequests(parsePartnerDraftBundle(raw));
  const visible = reader.listOrders().find((row) => row.id === filed.id);
  assert.ok(visible);
  assert.equal(visible.stage, "draft");
  assert.equal(visible.source, "partner");
  assert.ok(reader.listEvents().some((row) => row.type === "ORDER_REQUEST"));
});

test("order surface copy stays neutral and off Metrc claims", () => {
  const files = [
    "./copy.ts",
    "./door.ts",
    "./seed.ts",
    "./types.ts",
    "./persist.ts",
    "./session.ts",
    "./password.ts",
    "../../app/order/page.tsx",
    "../../app/order/order-client.tsx",
    "../../app/order/actions.ts",
  ];
  for (const rel of files) {
    const text = read(rel);
    assert.equal(text.includes("\u2013"), false, `${rel} has an en dash`);
    assert.equal(text.includes("\u2014"), false, `${rel} has an em dash`);
    assert.equal(text.includes("Metrc-verified"), false, `${rel} claims Metrc-verified`);
    assert.equal(text.includes("MetrcConnectAdapter"), false, rel);
    assert.equal(text.includes("METRC_USER_KEY"), false, rel);
    assert.equal(text.includes("createTransferDraft"), false, rel);
    assert.equal(text.includes("inviteCode"), false, `${rel} still has inviteCode`);
    assert.equal(text.includes("Invite code"), false, `${rel} still has Invite code`);
    const strings = [...text.matchAll(/["'`]([^"'`\\]|\\.){0,200}["'`]/g)].map((m) => m[0]);
    for (const chunk of strings) {
      assert.equal(chunk.includes("!"), false, `${rel} string has a bang: ${chunk}`);
    }
  }
  assert.equal(ORDER_COPY.formLine.includes("No Metrc write"), true);
  assert.equal(ORDER_COPY.doorTitle, "Dispensary Login");
  assert.equal(ORDER_COPY.formTitle, "Order reservation");
  assert.equal(ORDER_COPY.signUpTab, "Sign up");
  assert.equal(ORDER_COPY.signInTab, "Sign in");
  assert.equal(ORDER_COPY.signUp, "Continue");
  assert.equal(ORDER_COPY.signIn, "Sign in");
  assert.equal(ORDER_COPY.dispensaryName, "Dispensary name");
  assert.equal(ORDER_COPY.address, "Address");
  assert.equal(ORDER_COPY.contactName, "Contact name");
  assert.equal(ORDER_COPY.phone, "Phone");
  assert.equal(ORDER_COPY.license, "OCM license number");
  assert.equal(ORDER_COPY.email, "Email");
  assert.equal(ORDER_COPY.password, "Create password");
  assert.equal(ORDER_COPY.confirm, "Confirm password");
  assert.equal(PARTNER_SKU_LABELS["no-1"], "No. 1 Dialed");
});

test("Phase A order source has no MetrcConnectAdapter, no client keys, no Metrc-verified", () => {
  const hits: string[] = [];
  walkTs("src/lib/order", (path, text) => {
    if (text.includes("MetrcConnectAdapter")) hits.push(path);
    if (text.includes("Metrc-verified")) hits.push(path);
    if (/METRC_USER_KEY|METRC_VENDOR_KEY|metrc\.com/i.test(text)) hits.push(path);
  });
  walkTs("src/app/order", (path, text) => {
    if (text.includes("MetrcConnectAdapter")) hits.push(path);
    if (text.includes("Metrc-verified")) hits.push(path);
    if (/METRC_USER_KEY|METRC_VENDOR_KEY|metrc\.com/i.test(text)) hits.push(path);
  });
  assert.deepEqual(hits, []);
});

test("password never logs and never travels toward Metrc", () => {
  const actions = read("../../app/order/actions.ts");
  const door = read("./door.ts");
  const password = read("./password.ts");
  assert.equal(actions.includes("console.log"), false);
  assert.equal(door.includes("console.log"), false);
  assert.equal(password.includes("console.log"), false);
  assert.equal(actions.includes("writeAudit"), false);
  assert.equal(actions.includes("createTransferDraft"), false);
  assert.equal(actions.includes("Metrc"), false);
  assert.match(actions, /registerPartnerAction/);
  assert.match(actions, /isPartnerElevated/);
});

test("unauth order page renders Dispensary Login and never 403", () => {
  const page = read("../../app/order/page.tsx");
  const client = read("../../app/order/order-client.tsx");
  assert.match(page, /if \(!elevated\)/);
  assert.match(page, /return <OrderClient session=\{sessionView\} \/>/);
  assert.match(page, /readPartnerSession/);
  assert.match(page, /return <OrderClient \/>/);
  assert.equal(page.includes("notFound("), false);
  assert.equal(page.includes("403"), false);
  assert.equal(client.includes("403"), false);
  assert.match(client, /ORDER_COPY.doorTitle/);
  assert.match(client, /registerPartnerAction/);
  assert.match(client, /ORDER_COPY.signUpTab/);
  assert.match(client, /ORDER_COPY.signInTab/);
  assert.match(client, /ORDER_COPY\.signUp\}/);
  assert.match(client, /ORDER_COPY\.signIn\}/);
  assert.match(client, /ORDER_COPY.dispensaryName/);
  assert.match(client, /ORDER_COPY.address/);
  assert.match(client, /ORDER_COPY.contactName/);
  assert.match(client, /ORDER_COPY.phone/);
  assert.match(client, /ORDER_COPY.email/);
  assert.match(client, /ORDER_COPY.license/);
  assert.match(client, /ORDER_COPY.password/);
  assert.match(client, /ORDER_COPY.confirm/);
  assert.equal(client.includes("Already registered"), false);
  assert.match(client, /age21/);
  assert.match(client, /ORDER_COPY.formTitle/);
  assert.match(client, /ORDER_COPY.pendingWait/);
  assert.match(client, /session.elevated/);
  assert.equal(client.includes("inviteCode"), false);
  assert.equal(client.includes("returnDoor"), false);
  const signupForm = client.slice(client.indexOf("action={onCreate}"), client.indexOf("action={onOpen}"));
  assert.ok(signupForm.indexOf("ORDER_COPY.dispensaryName") < signupForm.indexOf("ORDER_COPY.address"));
  assert.ok(signupForm.indexOf("ORDER_COPY.address") < signupForm.indexOf("ORDER_COPY.contactName"));
  assert.ok(signupForm.indexOf("ORDER_COPY.contactName") < signupForm.indexOf("ORDER_COPY.phone"));
  assert.ok(signupForm.indexOf("ORDER_COPY.phone") < signupForm.indexOf("ORDER_COPY.license"));
  assert.ok(signupForm.indexOf("ORDER_COPY.license") < signupForm.indexOf("ORDER_COPY.email"));
  assert.ok(signupForm.indexOf("ORDER_COPY.email") < signupForm.indexOf("ORDER_COPY.password"));
  assert.ok(signupForm.indexOf("ORDER_COPY.password") < signupForm.indexOf("ORDER_COPY.confirm"));
  const signInForm = client.slice(client.indexOf("action={onOpen}"));
  const signInOnly = signInForm.slice(0, signInForm.indexOf("ORDER_COPY.privacy"));
  assert.equal(signInOnly.includes('name="license"'), false);
  assert.equal(signInOnly.includes("age21"), false);
  assert.match(signInOnly, /name="email"/);
  assert.match(signInOnly, /name="password"/);
});
