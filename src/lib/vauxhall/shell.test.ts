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
const PORTFOLIO = read("components/vauxhall/product-portfolio.tsx");

test("control room CSS stays on Bond tokens", () => {
  assert.match(CSS, /--matte-black: #1B1D1C/);
  assert.match(CSS, /--deep-charcoal: #2A2A2A/);
  assert.match(CSS, /--bone: #E1DAD0/);
  assert.match(CSS, /--product: #79C84A/);
  assert.match(CSS, /--security: #A53A28/);
  assert.match(CSS, /--social: #86ACE3/);
  assert.match(CSS, /\.vx-sku-card/);
  assert.match(CSS, /box-shadow: inset 0 1px 0 var\(--sku-ink/);
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

const PRODUCT = read("components/vauxhall/product-views.tsx");
const SECURITY = read("components/vauxhall/security-views.tsx");
const SOCIAL = read("components/vauxhall/social-views.tsx");

test("wing mosaics dispatch store-driven consoles", () => {
  assert.match(MOSAIC, /ProductWing/);
  assert.match(MOSAIC, /SecurityWing/);
  assert.match(MOSAIC, /SocialWing/);
  assert.equal(MOSAIC.includes("WingStub"), false);
  assert.equal(MOSAIC.includes("This wing is framed"), false);
  assert.equal(MOSAIC.includes("Framed. Portal build."), false);
});

test("social stays non-publishing and parked", () => {
  assert.match(SOCIAL, /Prompt 2C stays parked/);
  assert.match(SOCIAL, /No scrape yet/);
  assert.match(SOCIAL, /Scheduler/);
  assert.match(SOCIAL, /listSocialPipeline/);
  assert.equal(SOCIAL.includes("attemptSchedule"), false);
  assert.equal(SOCIAL.includes("Attempt schedule"), false);
  assert.equal(SOCIAL.includes("\u2013"), false);
  assert.equal(SOCIAL.includes("\u2014"), false);
  assert.equal(SOCIAL.includes("!"), false);
});

test("product economics stay mock labeled", () => {
  assert.match(PRODUCT, /Not investor figures/);
  assert.match(PRODUCT, /Mock seed/);
  assert.match(PRODUCT, /listSkus/);
  assert.match(PRODUCT, /Trace/);
  assert.match(PRODUCT, /Production/);
  assert.match(PRODUCT, /Metrc as of|StalenessStamp/);
  assert.equal(PRODUCT.includes("MetrcConnectAdapter"), false);
  assert.match(SECURITY, /Cite. Remediate. Document./);
  assert.match(SECURITY, /mGateAllows/);
  assert.match(SECURITY, /Demo Live/);
  assert.match(SECURITY, /Monitors/);
  assert.equal(PRODUCT.includes("\u2013"), false);
  assert.equal(PRODUCT.includes("\u2014"), false);
  assert.equal(PRODUCT.includes("!"), false);
  assert.equal(SECURITY.includes("!"), false);
});

test("product portfolio is store-driven and keeps hexes out of the UI", () => {
  assert.match(PRODUCT, /ProductPortfolio/);
  assert.match(PORTFOLIO, /listSkus/);
  assert.match(PORTFOLIO, /skuMetrics/);
  assert.match(PORTFOLIO, /sku\.hex/);
  assert.equal(PORTFOLIO.includes("#79C84A"), false);
  assert.equal(PORTFOLIO.includes("#86ACE3"), false);
  assert.equal(PORTFOLIO.includes("#A53A28"), false);
  assert.equal(PORTFOLIO.includes("GFS Didot"), false);
  assert.equal(PORTFOLIO.includes("didot"), false);
  assert.equal(PORTFOLIO.includes("\u2013"), false);
  assert.equal(PORTFOLIO.includes("\u2014"), false);
  assert.equal(PORTFOLIO.includes("!"), false);
});
