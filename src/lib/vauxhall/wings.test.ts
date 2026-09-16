import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLOAKED_STATIC_PATHS } from "../access.ts";
import { WING_CONSOLES, parseVauxhallRoute } from "./routes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const FILES = [
  "components/vauxhall/product-views.tsx",
  "components/vauxhall/security-views.tsx",
  "components/vauxhall/social-views.tsx",
  "components/vauxhall/wing-mosaics.tsx",
  "components/vauxhall/console-chrome.tsx",
  "components/vauxhall/haus-views.tsx",
  "components/portal-frame.tsx",
  "lib/tokens.ts",
];

test("critical navigation reaches a real console for every wing destination", () => {
  const expected = {
    product: [
      "sku-portfolio",
      "dashboard",
      "board-metrics",
      "unit-economics",
      "alerts-and-risks",
      "inventory",
      "production",
      "orders",
      "accounts",
      "trace",
    ],
    security: [
      "monitors",
      "findings",
      "incidents",
      "rules",
      "waivers",
      "audit-log",
      "dsar",
      "vendors",
      "dashboards",
      "scanner-bridge",
      "pre-check",
      "soc-2-exporter",
      "weekly-audit",
    ],
    social: [
      "overview",
      "content",
      "create",
      "auto-script",
      "research",
      "scriptwriter",
      "editor",
      "scheduler",
      "analyzer",
      "post-tracking",
    ],
    haus: [
      "dashboard",
      "content",
      "batches",
      "reserve",
      "events",
      "guide",
      "members",
      "settings",
    ],
  } as const;

  for (const [wing, ids] of Object.entries(expected)) {
    const consoles = WING_CONSOLES[wing as keyof typeof WING_CONSOLES];
    assert.deepEqual(
      consoles.map((item) => item.id),
      [...ids],
    );
    for (const id of ids) {
      const slug = id === consoles[0]?.id ? [wing] : [wing, id];
      const parsed = parseVauxhallRoute(slug);
      assert.equal(parsed?.view, id, `${wing}/${id}`);
    }
  }
});

test("new wing UI keeps Bond voice and never uses WingStub", () => {
  for (const rel of FILES) {
    const text = read(rel);
    assert.equal(text.includes("\u2013"), false, `${rel} has an en dash`);
    assert.equal(text.includes("\u2014"), false, `${rel} has an em dash`);
    assert.equal(text.includes("WingStub"), false, `${rel} still mentions WingStub`);
  }
  const frame = read("components/portal-frame.tsx");
  const app = read("components/vauxhall/command-app.tsx");
  const access = read("lib/access.ts");
  const actions = read("app/haus/actions.ts");
  const social = read("components/vauxhall/social-views.tsx");
  assert.match(social, /Prompt 2C stays parked/);
  assert.equal(social.includes("Attempt schedule"), false);
  assert.equal(social.includes("attemptSchedule"), false);
  assert.match(frame, /Sign out/);
  assert.match(app, /WingMosaic/);
  assert.match(actions, /redirect\("\/haus"\)/);
  assert.equal(access.includes("owner@bond.test"), false);
  assert.deepEqual(CLOAKED_STATIC_PATHS, [
    "/Admin.dc.html",
    "/Vauxhall.dc.html",
    "/Haus.dc.html",
    "/HausAdmin.dc.html",
    "/Product.dc.html",
    "/Security.dc.html",
    "/Social.dc.html",
  ]);
});
