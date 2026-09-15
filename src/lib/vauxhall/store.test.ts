import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { csvFilename, eventsToCsv } from "./csv.ts";
import { SKU_ACCENTS } from "../tokens.ts";
import { SEED_CANON, SEED_DRAFTS, SEED_EVENTS, SEED_RCS, SEED_REVIEW, SEED_SKUS } from "./seed.ts";
import { VauxhallStore } from "./store.ts";

function assertNoDashes(value: string, label: string) {
  assert.equal(value.includes("\u2013"), false, `${label} has an en dash`);
  assert.equal(value.includes("\u2014"), false, `${label} has an em dash`);
}

test("seed matches the approved Live Feed and side queues", () => {
  const store = new VauxhallStore();
  assert.equal(store.listEvents().length, 10);
  assert.equal(store.listEvents()[0]?.audit, "A-40912");
  assert.equal(store.listEvents()[9]?.summary.includes("Daily audit"), true);
  assert.equal(store.listReview().length, 3);
  assert.equal(store.openReviewCount(), 3);
  assert.equal(store.listQueue().rcs.length, 2);
  assert.equal(store.listQueue().rcs[0]?.id, "rc-117");
  assert.equal(store.listQueue().rcs[1]?.stage, 3);
  assert.equal(store.listQueue().drafts.length, 4);
  assert.equal(store.listCanon().length, 6);
  assert.ok(store.listCanon().every((doc) => doc.name.startsWith("prototype/")));
  assert.equal(store.listTuning()[0]?.agent, "M");
  assert.deepEqual(
    store.listEvents().map((event) => event.id),
    SEED_EVENTS.map((event) => event.id),
  );
});

test("seed strings have zero em dashes or en dashes", () => {
  const blobs = [
    ...SEED_EVENTS.flatMap((event) => [event.summary, event.sub, event.audit]),
    ...SEED_REVIEW.flatMap((item) => [item.title, item.evidence, item.endorse]),
    ...SEED_RCS.flatMap((item) => [item.title, item.note]),
    ...SEED_DRAFTS.flatMap((item) => [item.title, item.blocker]),
    ...SEED_CANON.flatMap((item) => [item.body, item.prior]),
    ...SEED_SKUS.flatMap((sku) => [
      sku.number,
      sku.editionName,
      sku.moment,
      sku.triad,
      sku.bondLine,
      sku.productTruth,
      sku.batchNote,
      ...sku.formats,
    ]),
  ];
  for (const blob of blobs) assertNoDashes(blob, blob.slice(0, 40));
});

test("SKU seed is the Prompt 1 standing catalog", () => {
  const store = new VauxhallStore();
  const skus = store.listSkus();
  assert.equal(skus.length, 3);
  assert.deepEqual(
    skus.map((sku) => sku.editionName),
    ["Dialed", "Unwind", "Peak"],
  );
  assert.equal(skus[0]?.triad, "Focus. Clarity. Momentum.");
  assert.equal(skus[1]?.triad, "Release. Stillness. Restoration.");
  assert.equal(skus[2]?.triad, "Edge. Elevation. Expansion.");
  assert.equal(skus[0]?.hex, SKU_ACCENTS["no-1"]);
  assert.equal(skus[1]?.hex, SKU_ACCENTS["no-2"]);
  assert.equal(skus[2]?.hex, SKU_ACCENTS["no-3"]);
  assert.ok(skus.every((sku) => sku.lifecycle === "active"));
  assert.ok(skus.every((sku) => sku.batchNote.includes("No COA")));
  assert.ok(skus.every((sku) => !sku.batchNote.includes("http")));
  const metrics = store.skuMetrics();
  assert.equal(metrics.active, 3);
  assert.equal(metrics.formats, 2);
  assert.equal(metrics.lifecycle.active, 3);
  assert.equal(store.collectionFrame().name, "The Numbered Collection");
});

test("agent and type filters compose", () => {
  const store = new VauxhallStore();
  store.toggleAgent("Felix");
  store.setType("Alert");
  const list = store.listEvents();
  assert.equal(list.length, 1);
  assert.equal(list[0]?.agent, "Felix");
  assert.equal(list[0]?.type, "Alert");
  store.toggleAgent("Felix");
  assert.equal(store.listEvents().every((event) => event.type === "Alert"), true);
  store.setType(null);
  assert.equal(store.listEvents().length, 10);
});

test("approving all three Review items drops the badge and writes AGENT DECISION events", () => {
  const store = new VauxhallStore();
  for (const item of store.listReview()) {
    store.resolveReview(item.id, "approved");
  }
  assert.equal(store.openReviewCount(), 0);
  const decisions = store.listEvents().filter((event) => event.type === "Agent Decision");
  const owned = decisions.filter((event) => event.summary.startsWith("Owner approved:"));
  assert.equal(owned.length, 3);
});

test("export CSV is the current filtered set", () => {
  const store = new VauxhallStore();
  store.toggleAgent("Q");
  const list = store.listEvents();
  const csv = eventsToCsv(list);
  assert.equal(csv.startsWith('"time","agent","type","summary","subline"'), true);
  assert.equal(csv.includes("Felix"), false);
  assert.equal(csv.includes("Q"), true);
  assert.equal(csvFilename(new Date("2026-09-15T12:00:00")).endsWith("20260915.csv"), true);
  assert.equal(list.length, 2);
});

test("steering and tuning talk only through the store", () => {
  const store = new VauxhallStore();
  store.submitDirective("Hold the prototype batch note until Felix clears the claim.", "M", "High", "2026-09-16");
  assert.match(store.listEvents()[0]?.summary ?? "", /^Directive received: Hold the prototype batch note/);
  store.applyTuning("t1");
  assert.equal(store.listTuning()[0]?.state, "applied");
  store.rollbackTuning("t1");
  assert.equal(store.listTuning()[0]?.state, "proposed");
  store.rejectTuning("t1", "Not this cycle");
  assert.equal(store.listTuning()[0]?.state, "rejected");
  store.setLive(true);
  store.signOut();
  assert.equal(store.live, false);
});

test("src does not ship the Prompt 2B mock sign-in demo", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const store = readFileSync(join(here, "store.ts"), "utf8");
  const app = readFileSync(join(here, "../../components/vauxhall/command-app.tsx"), "utf8");
  assert.equal(store.includes("owner@bond.test"), false);
  assert.equal(app.includes("SignInMock"), false);
  assert.equal(app.includes("signOutSlot"), false);
});

test("Carver surfaces its blocker and refresh reseeds mock data", () => {
  const store = new VauxhallStore();
  store.addEvent(store.genEvent(new Date("2026-09-15T15:00:00")));
  assert.equal(store.listEvents().length, 11);
  assert.equal(store.agentSummary("Carver").blocker, "Awaiting Felix originality check");
  store.seed();
  assert.equal(store.listEvents().length, 10);
  assert.equal(store.openReviewCount(), 3);
});
