import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const CSS = read("app/globals.css");
const FRAME = read("components/portal-frame.tsx");
const APP = read("components/vauxhall/command-app.tsx");
const VIEWS = read("components/vauxhall/command-views.tsx");
const MOSAIC = read("components/vauxhall/wing-mosaics.tsx");

test("control room CSS stays on Bond tokens", () => {
  assert.match(CSS, /--matte-black: #1B1D1C/);
  assert.match(CSS, /--deep-charcoal: #2A2A2A/);
  assert.match(CSS, /--bone: #E1DAD0/);
  assert.match(CSS, /--product: #79C84A/);
  assert.match(CSS, /--security: #A53A28/);
  assert.match(CSS, /--social: #86ACE3/);
  assert.equal(CSS.includes("#FF"), false);
  assert.equal(CSS.includes("orange"), false);
  assert.equal(CSS.includes("999px"), false);
  assert.equal(CSS.includes("#E3C270"), false);
});

test("shell uses sidebar plus a distinct top tab strip", () => {
  assert.match(FRAME, /vx-rail/);
  assert.match(FRAME, /vx-wing-strip/);
  assert.match(FRAME, /vx-module-strip/);
  assert.match(FRAME, /aria-label="Wing tabs"/);
  assert.match(FRAME, /aria-label="Module tabs"/);
  assert.match(FRAME, /Sign out/);
  assert.match(APP, /COMMAND_SECTIONS/);
  assert.match(APP, /WING_CONSOLES/);
  assert.match(APP, /WingMosaic/);
  assert.equal(APP.includes("owner@bond.test"), false);
  assert.match(CSS, /\.vx-module-strip/);
  assert.match(CSS, /border-radius: 2px/);
});

test("command views keep Prompt 2B store methods", () => {
  assert.match(VIEWS, /store\.listEvents/);
  assert.match(VIEWS, /store\.resolveReview/);
  assert.match(VIEWS, /store\.listQueue/);
  assert.match(VIEWS, /store\.openReviewCount/);
  assert.match(VIEWS, /Export/);
  assert.equal(VIEWS.includes("#E3C270"), false);
});

test("social mosaic stays framed placeholder copy", () => {
  assert.match(MOSAIC, /Prompt 2C parked/);
  assert.match(MOSAIC, /No scrape yet/);
  assert.match(MOSAIC, /No invented SKU prices/);
});
