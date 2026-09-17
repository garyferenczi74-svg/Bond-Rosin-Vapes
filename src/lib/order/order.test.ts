import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GENERIC_DOOR } from "../access.ts";
import { VauxhallStore } from "../vauxhall/store.ts";
import { ORDER_COPY, PARTNER_SKU_LABELS } from "./copy.ts";
import { bindPartnerDoor, elevatePartnerInvite, findPartnerInvite } from "./door.ts";
import { parsePartnerDraftBundle, serializePartnerDraftBundle } from "./persist.ts";
import { SEED_PARTNER_INVITES } from "./seed.ts";
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

test("license-linked invite binds only after ops elevation", () => {
  const pending = [...SEED_PARTNER_INVITES.map((row) => ({ ...row }))];
  const closed = bindPartnerDoor(
    {
      email: "pending.buyer@example.test",
      inviteCode: "MOCK-INVITE-PENDING",
      license: "MOCK-LIC-PROTO-EAST",
      age21: true,
    },
    pending,
  );
  assert.equal(closed.ok, false);
  if (!closed.ok) assert.equal(closed.message, GENERIC_DOOR);
  const lifted = elevatePartnerInvite("MOCK-LIC-PROTO-EAST", pending);
  assert.equal(lifted.ok, true);
  const opened = bindPartnerDoor(
    {
      email: "pending.buyer@example.test",
      inviteCode: "MOCK-INVITE-PENDING",
      license: "MOCK-LIC-PROTO-EAST",
      age21: true,
    },
    pending,
  );
  assert.equal(opened.ok, true);
  if (opened.ok) assert.equal(opened.session.accountId, "acct-east");
});

test("door requires matching email, invite, license, and 21 plus", () => {
  const miss = bindPartnerDoor({
    email: "north.buyer@example.test",
    inviteCode: "WRONG",
    license: "MOCK-LIC-PROTO-NORTH",
    age21: true,
  });
  assert.equal(miss.ok, false);
  const young = bindPartnerDoor({
    email: "north.buyer@example.test",
    inviteCode: "MOCK-INVITE-NORTH",
    license: "MOCK-LIC-PROTO-NORTH",
    age21: false,
  });
  assert.equal(young.ok, false);
  if (!young.ok) assert.match(young.message, /21 and over/);
  const ok = bindPartnerDoor({
    email: "North.Buyer@example.test",
    inviteCode: "mock-invite-north",
    license: "mock-lic-proto-north",
    age21: true,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.session.role, "partner");
    assert.equal(ok.session.license, "MOCK-LIC-PROTO-NORTH");
  }
});

test("partner session parse stays license-linked", () => {
  assert.equal(parsePartnerSession(null), null);
  assert.equal(parsePartnerSession('{"email":"north.buyer@example.test","role":"member"}'), null);
  const session = parsePartnerSession(
    JSON.stringify({
      email: "North.Buyer@example.test",
      accountId: "acct-north",
      license: "MOCK-LIC-PROTO-NORTH",
      inviteCode: "MOCK-INVITE-NORTH",
      age21: true,
      role: "partner",
    }),
  );
  assert.ok(session);
  assert.equal(session.email, "north.buyer@example.test");
  assert.equal(findPartnerInvite(session)?.accountId, "acct-north");
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
    const strings = [...text.matchAll(/["'`]([^"'`\\]|\\.){0,200}["'`]/g)].map((m) => m[0]);
    for (const chunk of strings) {
      assert.equal(chunk.includes("!"), false, `${rel} string has a bang: ${chunk}`);
    }
  }
  assert.equal(ORDER_COPY.formLine.includes("No Metrc write"), true);
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

test("unauth order page renders a door and never 403", () => {
  const page = read("../../app/order/page.tsx");
  const client = read("../../app/order/order-client.tsx");
  assert.match(page, /readPartnerSession/);
  assert.match(page, /return <OrderClient \/>/);
  assert.equal(page.includes("notFound("), false);
  assert.equal(page.includes("403"), false);
  assert.equal(client.includes("403"), false);
  assert.match(client, /ORDER_COPY.doorTitle/);
  assert.match(client, /age21/);
});
