import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  adminPortalAllowed,
  CLOAKED_STATIC_PATHS,
  GENERIC_DOOR,
  isAdminRole,
  isCloakedStaticPath,
  isIdleExpired,
  IDLE_MS,
  PHASE1_MFA_WAIVED,
} from "./access.ts";

test("admin, owner, and operator open Vauxhall", () => {
  assert.equal(isAdminRole("admin"), true);
  assert.equal(isAdminRole("owner"), true);
  assert.equal(isAdminRole("operator"), true);
  assert.equal(isAdminRole("member"), false);
});

test("waiver W-2026-09-15-P1-OVERRIDE opens portal after password only", () => {
  const admin = { role: "owner" as const, status: "active" };
  assert.equal(PHASE1_MFA_WAIVED, true);
  assert.equal(
    adminPortalAllowed({ admin, aal: "aal1", verifiedFactorCount: 0 }),
    true,
  );
  assert.equal(
    adminPortalAllowed({ admin, aal: null, verifiedFactorCount: 0 }),
    true,
  );
  assert.equal(
    adminPortalAllowed({ admin: null, aal: "aal1", verifiedFactorCount: 0 }),
    false,
  );
  assert.equal(
    adminPortalAllowed({
      admin: { role: "owner", status: "disabled" },
      aal: "aal1",
      verifiedFactorCount: 0,
    }),
    false,
  );
});

test("idle expires after 24 hours", () => {
  const now = 1_000_000_000_000;
  assert.equal(isIdleExpired(0, now), false);
  assert.equal(isIdleExpired(now - IDLE_MS + 1, now), false);
  assert.equal(isIdleExpired(now - IDLE_MS - 1, now), true);
});

test("static admin html paths are cloaked", () => {
  assert.equal(isCloakedStaticPath("/Admin.dc.html"), true);
  assert.equal(isCloakedStaticPath("/Vauxhall.dc.html"), true);
  assert.equal(isCloakedStaticPath("/Haus.dc.html"), true);
  assert.equal(isCloakedStaticPath("/Product.dc.html"), true);
  assert.equal(isCloakedStaticPath("/Home.dc.html"), false);
});

test("middleware matcher covers every cloaked static path", () => {
  const middleware = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../middleware.ts"),
    "utf8",
  );
  for (const path of CLOAKED_STATIC_PATHS) {
    assert.ok(middleware.includes(`"${path}"`), path);
  }
});

test("Home public Admin links point at Next /haus", () => {
  const home = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../Home.dc.html"), "utf8");
  const adminHrefs = [...home.matchAll(/href="([^"]+)"[^>]*>Admin</g)].map((m) => m[1]);
  assert.ok(adminHrefs.length >= 2, "footer and menu must both expose Admin");
  assert.ok(adminHrefs.every((href) => href === "/haus"));
  assert.equal(home.includes('href="Admin.dc.html"'), false);
  assert.equal(home.includes("Haus.dc.html\">Admin"), false);
  const footer = home.slice(home.indexOf("<footer"));
  const caption = footer.match(/letter-spacing:0\.16em;text-transform:uppercase">([\s\S]*?)<\/div>/);
  assert.ok(caption, "footer caption row must exist");
  const footerCaptions = [...caption[1].matchAll(/<a href="([^"]+)"[^>]*>([^<]+)</g)].map((m) => [
    m[1],
    m[2].trim(),
  ]);
  assert.deepEqual(footerCaptions.at(-1), ["/haus", "Admin"]);
  assert.equal(footer.includes("/haus/admin"), false);
});

test("Home public Haus entry CTAs point at Next /haus", () => {
  const home = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../Home.dc.html"), "utf8");
  assert.equal(home.includes("Haus.dc.html"), false);
  assert.match(home, /href="\/haus" class="hero-btn hero-btn-secondary">ENTER THE BOND HAUS</);
  assert.match(home, /href="\/haus"[^>]*>Already in the Haus\? Enter here\.</);
  assert.match(home, /href="\/haus"[^>]*>Enter Bond Haus</);
  const footer = home.slice(home.indexOf("<footer"));
  assert.match(footer, /href="\/haus"[^>]*>Bond Haus</);
  const navHaus = [...home.matchAll(/href="([^"]+)"[^>]*>Bond Haus</g)].map((m) => m[1]);
  assert.ok(navHaus.includes("#haus"));
  assert.equal(home.includes("/haus/admin"), false);
});

test("failed sign-in copy stays one generic line", () => {
  assert.equal(GENERIC_DOOR, "That did not open the door.");
  const actions = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../app/haus/actions.ts"), "utf8");
  assert.match(actions, /function fail\(message = GENERIC_DOOR\)/);
  assert.equal(actions.includes("Invalid login"), false);
  assert.equal(actions.includes("Unknown email"), false);
  assert.equal(actions.includes("Wrong password"), false);
});

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{[\s]*\/\*[\s\S]*?\*\/[\s]*\}/g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("Next /haus shows a reciprocal Haus invite to the Home band", () => {
  const client = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../app/haus/haus-client.tsx"),
    "utf8",
  );
  assert.match(client, /The Haus is for members\./);
  assert.match(client, /Membership is by invitation from the Haus\./);
  assert.match(client, /Not yet a member\?/);
  assert.match(client, /Join the Bond Haus for first access\./);
  assert.match(client, /href="\/#haus"/);
  assert.match(client, /ComplianceBand/);
  const band = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../components/compliance-band.tsx"),
    "utf8",
  );
  assert.match(band, /Health and Safety/);
  assert.equal(client.includes("/haus/admin"), false);
  assert.equal(client.includes("Sign in to continue"), false);
  assert.equal(client.includes("\u2013"), false);
  assert.equal(client.includes("\u2014"), false);
  assert.equal(PHASE1_MFA_WAIVED, true);
  const visible = stripComments(client);
  assert.equal(/circle/i.test(visible), false);
});

test("SKU footer Bond Haus points at Next /haus", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  for (const name of ["No1.dc.html", "No2.dc.html", "No3.dc.html"]) {
    const html = readFileSync(join(root, name), "utf8");
    const footer = html.slice(html.indexOf("<footer"));
    assert.match(footer, /href="\/haus"[^>]*>Bond Haus</, name);
    assert.equal(html.includes("Haus.dc.html"), false, name);
  }
  const no1 = readFileSync(join(root, "No1.dc.html"), "utf8");
  const no2 = readFileSync(join(root, "No2.dc.html"), "utf8");
  const no3 = readFileSync(join(root, "No3.dc.html"), "utf8");
  assert.match(no1, /A focused expression from Bond's solventless live rosin collection\./);
  assert.match(no1, /Clarity\. Momentum\./);
  assert.match(no2, /A cooler, quieter number in Bond's 100% solventless live rosin collection\./);
  assert.match(no3, /A reserve expression from Bond's solventless live rosin collection\./);
});

test("public marketing never exposes the partner order door", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const marketing = [
    "Home.dc.html",
    "No1.dc.html",
    "No2.dc.html",
    "No3.dc.html",
    "FAQ.dc.html",
    "Terms.dc.html",
    "Privacy.dc.html",
    "Finder.dc.html",
  ];
  for (const name of marketing) {
    const html = readFileSync(join(root, name), "utf8");
    assert.equal(html.includes('href="/order"'), false, name);
    assert.equal(html.includes('href="/partner/order"'), false, name);
  }
  const haus = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../app/haus/haus-client.tsx"), "utf8");
  assert.equal(haus.includes("/order"), false);
  const sitemap = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../app/sitemap.ts"), "utf8");
  assert.equal(sitemap.includes("/order"), false);
  const robots = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../app/robots.ts"), "utf8");
  assert.match(robots, /\/order/);
  const middleware = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../middleware.ts"), "utf8");
  assert.equal(middleware.includes('"/order"'), false);
});

test("Home keeps id=circle hash alias and bond_circle waitlist key", () => {
  const home = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../Home.dc.html"), "utf8");
  assert.match(home, /id="circle"/);
  assert.match(home, /Hash alias/);
  assert.match(home, /localStorage\.getItem\('bond_circle'\)/);
  assert.match(home, /localStorage\.setItem\('bond_circle'/);
  assert.match(home, /Haus is the canonical membership name/);
  assert.match(home, /FROM PLANT TO BOND/);
  assert.match(
    home,
    /We start with exceptional cannabis, then use heat, pressure, and time to preserve what is real\. The result is 100% solventless live rosin, nothing added, nothing removed\./,
  );
});
