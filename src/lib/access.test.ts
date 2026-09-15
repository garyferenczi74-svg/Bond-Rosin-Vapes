import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  adminPortalAllowed,
  isAdminRole,
  isCloakedStaticPath,
  isIdleExpired,
  IDLE_MS,
  PHASE1_MFA_WAIVED,
} from "./access.ts";

test("owner and operator are the only admin roles", () => {
  assert.equal(isAdminRole("owner"), true);
  assert.equal(isAdminRole("operator"), true);
  assert.equal(isAdminRole("admin"), false);
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
  assert.equal(isCloakedStaticPath("/Home.dc.html"), false);
});

test("Home public Admin links point at Next /haus", () => {
  const home = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../Home.dc.html"), "utf8");
  const adminHrefs = [...home.matchAll(/href="([^"]+)"[^>]*>Admin</g)].map((m) => m[1]);
  assert.ok(adminHrefs.length >= 2, "footer and menu must both expose Admin");
  assert.ok(adminHrefs.every((href) => href === "/haus"));
  assert.equal(home.includes('href="Admin.dc.html"'), false);
  assert.equal(home.includes("Haus.dc.html\">Admin"), false);
});
