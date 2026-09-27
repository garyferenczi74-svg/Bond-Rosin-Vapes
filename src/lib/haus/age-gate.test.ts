import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BOND_AGE_KEY,
  HAUS_AGE_BOOT,
  HAUS_AGE_HOST,
  hausRouteShowsAgeGate,
  hausShowsAgeGate,
} from "./age-gate.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function bootMark(stored: string | null, blocked = false): string | null {
  const attrs = new Map<string, string>();
  const document = {
    documentElement: {
      setAttribute(name: string, value: string) {
        attrs.set(name, value);
      },
      removeAttribute(name: string) {
        attrs.delete(name);
      },
    },
  };
  const sessionStorage = {
    getItem(key: string) {
      if (blocked) throw new Error("blocked");
      assert.equal(key, BOND_AGE_KEY);
      return stored;
    },
  };
  const run = new Function("document", "sessionStorage", HAUS_AGE_BOOT);
  run(document, sessionStorage);
  return attrs.get("data-bond-age") ?? null;
}

test("AgeGate shows on an unverified Haus door or floor and skips when the session is already verified", () => {
  assert.equal(hausShowsAgeGate(null), true);
  assert.equal(hausShowsAgeGate(""), true);
  assert.equal(hausShowsAgeGate("1710000000000"), false);

  assert.equal(hausRouteShowsAgeGate("/haus", null), true);
  assert.equal(hausRouteShowsAgeGate("/haus", "1710000000000"), false);
  assert.equal(hausRouteShowsAgeGate("/haus/welcome", null), true);
  assert.equal(hausRouteShowsAgeGate("/haus/welcome", "1710000000000"), false);
  assert.equal(hausRouteShowsAgeGate("/haus/salon", null), true);
  assert.equal(hausRouteShowsAgeGate("/haus/salon", "1710000000000"), false);
  assert.equal(hausRouteShowsAgeGate("/vauxhall/haus", null), false);

  assert.equal(bootMark(null), null);
  assert.equal(bootMark(""), null);
  assert.equal(bootMark("1710000000000"), "ok");
  assert.equal(bootMark(null, true), null);
});

test("Haus door and floor include AgeGate.dc.html instead of a copied gate", () => {
  const layout = read("src/app/haus/layout.tsx");
  const client = read("src/app/haus/age-gate-client.tsx");
  const door = read("src/app/haus/page.tsx");
  const host = read("haus-age-host.dc.html");
  const gate = read("AgeGate.dc.html");
  const no1 = read("No1.dc.html");
  const reduced =
    "@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-delay: 0ms !important; transition-duration: 0.01ms !important; } }";
  const bodyRule = "body { margin: 0; background: #1B1D1C; }";

  assert.match(door, /HausClient/);
  assert.match(layout, /HausAgeGate/);
  assert.match(layout, /HAUS_AGE_BOOT/);
  assert.match(client, /hausShowsAgeGate/);
  assert.match(client, /bond-entered/);
  assert.ok(client.includes(`src={HAUS_AGE_HOST}`));
  assert.equal(HAUS_AGE_HOST, "/haus-age-host.dc.html");
  assert.match(host, /<dc-import name="AgeGate" hint-size="0px,0px"><\/dc-import>/);
  assert.equal(host.includes("Birth month"), false);
  assert.equal(host.includes("By entering, you verify"), false);
  assert.equal(host.includes("sessionStorage.setItem"), false);
  assert.match(host, /parent\.postMessage\(\{ type: "bond-entered" \}, location\.origin\)/);
  assert.ok(gate.includes(bodyRule));
  assert.ok(host.includes(bodyRule));
  assert.ok(no1.includes(reduced));
  assert.ok(host.includes(reduced));
  assert.match(gate, /sessionStorage\.getItem\('bond_age_ok'\)/);
  assert.match(gate, /sessionStorage\.setItem\('bond_age_ok'/);
  assert.match(read("scripts/sync-public.mjs"), /haus-age-host\.dc\.html/);
  assert.equal(read("src/app/haus/haus-client.tsx").includes("AgeGate"), false);
  assert.equal(read("src/components/haus-frame.tsx").includes("AgeGate"), false);
});
