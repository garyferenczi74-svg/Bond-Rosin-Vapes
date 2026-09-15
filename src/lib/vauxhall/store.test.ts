import assert from "node:assert/strict";
import test from "node:test";
import { csvFilename, eventsToCsv } from "./csv.ts";
import { SEED_CANON, SEED_DRAFTS, SEED_EVENTS, SEED_RCS, SEED_REVIEW } from "./seed.ts";
import { VauxhallStore } from "./store.ts";

function assertNoDashes(value: string, label: string) {
  assert.equal(value.includes("\u2013"), false, `${label} has an en dash`);
  assert.equal(value.includes("\u2014"), false, `${label} has an em dash`);
}

test("seed matches the approved Live Feed and side queues", () => {
  const store = new VauxhallStore({ persistSession: false });
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
  ];
  for (const blob of blobs) assertNoDashes(blob, blob.slice(0, 40));
});

test("agent and type filters compose", () => {
  const store = new VauxhallStore({ persistSession: false });
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
  const store = new VauxhallStore({ persistSession: false });
  for (const item of store.listReview()) {
    store.resolveReview(item.id, "approved");
  }
  assert.equal(store.openReviewCount(), 0);
  const decisions = store.listEvents().filter((event) => event.type === "Agent Decision");
  const owned = decisions.filter((event) => event.summary.startsWith("Owner approved:"));
  assert.equal(owned.length, 3);
});

test("export CSV is the current filtered set", () => {
  const store = new VauxhallStore({ persistSession: false });
  store.toggleAgent("Q");
  const list = store.listEvents();
  const csv = eventsToCsv(list);
  assert.equal(csv.startsWith('"time","agent","type","summary","subline"'), true);
  assert.equal(csv.includes("Felix"), false);
  assert.equal(csv.includes("Q"), true);
  assert.equal(csvFilename(new Date("2026-09-15T12:00:00")).endsWith("20260915.csv"), true);
  assert.equal(list.length, 2);
});

test("steering, tuning, and sign out talk only through the store", () => {
  const store = new VauxhallStore({ persistSession: false });
  store.submitDirective("Hold the No. 3 Peak note until Felix clears the claim.", "M", "High", "2026-09-16");
  assert.match(store.listEvents()[0]?.summary ?? "", /^Directive received: Hold the No. 3 Peak note/);
  store.applyTuning("t1");
  assert.equal(store.listTuning()[0]?.state, "applied");
  store.rollbackTuning("t1");
  assert.equal(store.listTuning()[0]?.state, "proposed");
  store.rejectTuning("t1", "Not this cycle");
  assert.equal(store.listTuning()[0]?.state, "rejected");
  assert.equal(store.acceptDemoCredentials("owner@bond.test", "any"), true);
  assert.equal(store.acceptDemoCredentials("other@bond.test", "any"), false);
  assert.equal(store.acceptDemoMfa("123456"), true);
  store.signOut();
  assert.equal(store.session, false);
  store.restoreSession();
  assert.equal(store.session, true);
});

test("Carver surfaces its blocker and refresh reseeds mock data", () => {
  const store = new VauxhallStore({ persistSession: false });
  store.addEvent(store.genEvent(new Date("2026-09-15T15:00:00")));
  assert.equal(store.listEvents().length, 11);
  assert.equal(store.agentSummary("Carver").blocker, "Awaiting Felix originality check");
  store.seed();
  assert.equal(store.listEvents().length, 10);
  assert.equal(store.openReviewCount(), 3);
});
