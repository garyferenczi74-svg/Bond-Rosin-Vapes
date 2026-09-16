import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { admitAtDoor, canAdmitAtDoor } from "./door.ts";
import { LONG_EM, lintCopy, lintFields, lintHasHardBlock } from "./lint.ts";
import { parseHausPersist } from "./persist.ts";
import { seedHausPersist } from "./seed.ts";
import { HausStore } from "./store.ts";
import { PRIVACY_WALL } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));

function readRel(rel: string): string {
  return readFileSync(join(here, rel), "utf8");
}

test("DESIGN PREVIEW seeds live KPIs and Phase A attention", () => {
  const store = new HausStore(seedHausPersist(new Date("2026-09-16T12:00:00Z")));
  const dash = store.dashboard();
  assert.equal(dash.activeMembers, 2);
  assert.equal(dash.invitationsOut, 2);
  assert.equal(dash.houseWritesLive, 2);
  assert.equal(dash.shelvesHolding, 2);
  assert.equal(dash.ritualsThisMonth, 11);
  assert.equal(dash.notesHeld, 14);
  const kinds = dash.attention.map((row) => row.kind);
  assert.equal(kinds.includes("Lint blocked draft"), true);
  assert.equal(kinds.includes("Invitation expiring"), true);
  assert.equal(kinds.includes("Event near capacity"), true);
  assert.equal(kinds.includes("Batch missing COA"), true);
  const board = dash.board.find((row) => row.id === "writes");
  assert.ok(board);
  assert.equal(board.live, true);
  assert.equal(board.lintBlocked > 0, true);
});

test("lint blocks long dash and hard-blocks claims", () => {
  const dashHits = lintCopy(`clean press${LONG_EM} bright`);
  assert.equal(dashHits.some((hit) => hit.kind === "Long dash"), true);
  assert.equal(lintHasHardBlock(dashHits), false);
  const claimHits = lintCopy("A calm that can cure a long day.");
  assert.equal(claimHits.some((hit) => hit.kind === "Claims language"), true);
  assert.equal(lintHasHardBlock(claimHits), true);
  const store = new HausStore();
  const blocked = store.publishHouseWrite("HW-4");
  assert.equal(blocked.ok, false);
  assert.equal(lintHasHardBlock(blocked.hits), true);
  const dashBlock = store.publishHouseWrite("HW-3");
  assert.equal(dashBlock.ok, false);
});

test("House Write publish and retire recompute dashboard without a new store", () => {
  const store = new HausStore();
  const before = store.dashboard().houseWritesLive;
  store.updateHouseWrite("HW-3", { title: "The cleanest press", body: "Bright and pure." });
  const published = store.publishHouseWrite("HW-3");
  assert.equal(published.ok, true);
  assert.equal(store.dashboard().houseWritesLive, before + 1);
  const leftover = store.attention().filter((row) => row.text === "The cleanest press");
  assert.equal(leftover.length, 0);
  store.retireHouseWrite("HW-1");
  assert.equal(store.publishedWrites().some((row) => row.id === "HW-1"), false);
  const audit = store.activity(5);
  assert.equal(audit[0]?.after, "retired");
  assert.equal(audit[0]?.before, "published");
});

test("issue invitation recomputes outstanding count and writes before after audit", () => {
  const store = new HausStore();
  const before = store.dashboard().invitationsOut;
  const result = store.issueInvitation("haus-5@example.com");
  assert.equal(result.ok, true);
  assert.equal(store.dashboard().invitationsOut, before + 1);
  assert.equal(store.listHausEmails().includes("haus-5@example.com"), false);
  const row = store.activity(1)[0];
  assert.equal(row?.action.includes("haus-5@example.com"), true);
  assert.equal(row?.after, "issued");
  assert.equal(row?.before, "");
});

test("invitation door admits issued mail and fails revoke with the same store", () => {
  const store = new HausStore();
  assert.equal(canAdmitAtDoor(store, "haus-1@example.com").ok, true);
  assert.equal(admitAtDoor(store, "haus-1@example.com").ok, true);
  assert.equal(store.listInvitations().find((row) => row.email === "haus-1@example.com")?.state, "accepted");
  assert.equal(store.dashboard().activeMembers >= 3, true);
  store.issueInvitation("haus-6@example.com");
  assert.equal(canAdmitAtDoor(store, "haus-6@example.com").ok, true);
  store.revokeInvitation("haus-6@example.com");
  assert.equal(canAdmitAtDoor(store, "haus-6@example.com").ok, false);
  assert.equal(admitAtDoor(store, "haus-6@example.com").ok, false);
});

test("privacy wall is structural and note methods stay absent", () => {
  const store = new HausStore();
  assert.equal(store.privacyWall(), PRIVACY_WALL);
  assert.equal(store.noteCount("BND-1-0518"), 9);
  const names = Object.getOwnPropertyNames(Object.getPrototypeOf(store));
  assert.equal(names.includes("getNote"), false);
  assert.equal(names.includes("listReflections"), false);
  assert.equal(names.includes("readSession"), false);
  const source = readRel("./store.ts");
  assert.equal(source.includes("getNote"), false);
  assert.equal(source.includes("listReflections"), false);
  assert.equal(source.includes("sessionContent"), false);
});

test("settings welcome text is lint gated and privacy wall cannot change", () => {
  const store = new HausStore();
  const blocked = store.setWelcomeText(`Join us${LONG_EM} now`);
  assert.equal(blocked.ok, false);
  const saved = store.setWelcomeText("The floor stays quiet.");
  assert.equal(saved.ok, true);
  store.data.settings.privacyWall = "override";
  assert.equal(store.privacyWall(), PRIVACY_WALL);
  const parsed = parseHausPersist(JSON.stringify(store.snapshot()));
  assert.equal(parsed.settings.privacyWall, PRIVACY_WALL);
});

test("Phase A files stay off house punctuation and parked desks", () => {
  const files = [
    "./types.ts",
    "./lint.ts",
    "./dates.ts",
    "./seed.ts",
    "./store.ts",
    "./door.ts",
    "./persist.ts",
    "../haus-ledger.ts",
    "../../app/vauxhall/haus-actions.ts",
    "../../components/vauxhall/haus-views.tsx",
    "../../components/vauxhall/use-haus-store.ts",
    "../../components/haus-writes-strip.tsx",
  ];
  for (const rel of files) {
    const text = readRel(rel);
    assert.equal(text.includes("\u2013"), false, `${rel} has an en dash`);
    assert.equal(text.includes("\u2014"), false, `${rel} has an em dash`);
    assert.equal(text.includes("/haus/admin"), false, `${rel} mentions /haus/admin`);
    assert.equal(text.includes("MetrcConnect"), false, `${rel} mentions MetrcConnect`);
  }
  const views = readRel("../../components/vauxhall/haus-views.tsx");
  assert.equal(views.includes("!"), false);
  assert.match(views, /This desk arrives with Phase B/);
  assert.match(views, /The house counts; it does not read/);
  assert.match(views, /Publish to the Haus/);
  assert.match(views, /Issue invitation/);
  const tokens = readRel("../tokens.ts");
  assert.match(tokens, /id: "haus"/);
  assert.match(tokens, /hairline: tokens.bone/);
  assert.match(tokens, /The house does not read the guest book/);
});
