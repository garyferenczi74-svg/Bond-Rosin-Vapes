import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GENERIC_DOOR, PHASE1_MFA_WAIVED, isAdminRole } from "./access.ts";
import {
  DEMO_MEMBER_EMAIL,
  demoMemberNeverOpensVauxhall,
  isDemoMemberEmail,
  isMemberFloorPath,
  isMemberRoom,
  memberDestination,
  memberNeedsWelcome,
  parseMemberAck,
  parseMemberSession,
  seedMemberSession,
} from "./member.ts";

const here = dirname(fileURLToPath(import.meta.url));

function read(rel: string) {
  return readFileSync(join(here, rel), "utf8");
}

test("demo member email is member only", () => {
  assert.equal(isDemoMemberEmail("member@bond.test"), true);
  assert.equal(isDemoMemberEmail("Member@Bond.TEST"), true);
  assert.equal(isDemoMemberEmail("owner@bond.test"), false);
  assert.equal(demoMemberNeverOpensVauxhall(DEMO_MEMBER_EMAIL), true);
  assert.equal(isAdminRole("member"), false);
  const session = seedMemberSession();
  assert.equal(session.role, "member");
  assert.deepEqual(session.shelf, []);
});

test("member session cookie accepts demo and invited member emails", () => {
  assert.equal(parseMemberSession(null), null);
  assert.equal(parseMemberSession('{"email":"owner@bond.test","role":"admin"}'), null);
  assert.equal(parseMemberSession('{"email":"member@bond.test","role":"admin"}'), null);
  const ok = parseMemberSession('{"email":"Member@bond.test","role":"member","shelf":[]}');
  assert.ok(ok);
  assert.equal(ok.email, DEMO_MEMBER_EMAIL);
  assert.equal(ok.role, "member");
  assert.deepEqual(ok.shelf, []);
  const invited = parseMemberSession('{"email":"haus-1@example.com","role":"member","shelf":[]}');
  assert.ok(invited);
  assert.equal(invited.email, "haus-1@example.com");
});

test("welcome interstitial is once per member until age is affirmed", () => {
  const first = parseMemberAck(null);
  assert.equal(memberNeedsWelcome(first, DEMO_MEMBER_EMAIL), true);
  assert.equal(memberDestination(first, DEMO_MEMBER_EMAIL), "/haus/welcome");
  const seen = parseMemberAck(
    JSON.stringify({ email: DEMO_MEMBER_EMAIL, welcomeSeen: true, age21: true }),
  );
  assert.equal(memberNeedsWelcome(seen, DEMO_MEMBER_EMAIL), false);
  assert.equal(memberDestination(seen, DEMO_MEMBER_EMAIL), "/haus/salon");
});

test("member rooms are the Prompt 3 floor and never /haus/admin", () => {
  assert.equal(isMemberRoom("salon"), true);
  assert.equal(isMemberRoom("library"), true);
  assert.equal(isMemberRoom("admin"), false);
  assert.equal(isMemberFloorPath("/haus/salon"), true);
  assert.equal(isMemberFloorPath("/haus/welcome"), true);
  assert.equal(isMemberFloorPath("/haus/admin"), false);
  assert.equal(isMemberFloorPath("/vauxhall"), false);
});

test("shared door routes admin roles to Vauxhall and members to Salon", () => {
  const actions = read("../app/haus/actions.ts");
  assert.match(actions, /isDemoMemberEmail/);
  assert.match(actions, /tryInviteDoor/);
  assert.match(actions, /redirect\(memberDestination/);
  assert.match(actions, /redirect\("\/vauxhall"\)/);
  assert.match(actions, /redirect\("\/haus\/salon"\)/);
  assert.equal(actions.includes("/haus/admin"), false);
  assert.equal(actions.includes("owner@bond.test"), false);
  assert.match(actions, /function fail\(message = GENERIC_DOOR\)/);
  assert.equal(GENERIC_DOOR, "That did not open the door.");
  assert.equal(PHASE1_MFA_WAIVED, true);
  assert.match(actions, /PHASE1_MFA_WAIVED/);
});

test("Phase A Haus copy stays off commerce and house punctuation", () => {
  const files = [
    "../app/haus/haus-client.tsx",
    "../app/haus/welcome-client.tsx",
    "../app/haus/actions.ts",
    "../app/haus/page.tsx",
    "../app/haus/salon/page.tsx",
    "../app/haus/welcome/page.tsx",
    "../app/haus/[room]/page.tsx",
    "../components/haus-frame.tsx",
    "../components/compliance-band.tsx",
    "./member.ts",
  ];
  for (const rel of files) {
    const text = read(rel);
    assert.equal(text.includes("\u2013"), false, `${rel} has an en dash`);
    assert.equal(text.includes("\u2014"), false, `${rel} has an em dash`);
    assert.equal(/price|cart|purchase|checkout/i.test(text), false, `${rel} has commerce copy`);
    const strings = [...text.matchAll(/["'`]([^"'`\\]|\\.){0,160}["'`]/g)].map((m) => m[0]);
    for (const chunk of strings) {
      assert.equal(chunk.includes("!"), false, `${rel} string has a bang: ${chunk}`);
    }
  }
});
