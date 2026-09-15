import assert from "node:assert/strict";
import test from "node:test";
import {
  adminPortalAllowed,
  isAdminRole,
  isCloakedStaticPath,
  isIdleExpired,
  IDLE_MS,
} from "./access.ts";

test("owner and operator are the only admin roles", () => {
  assert.equal(isAdminRole("owner"), true);
  assert.equal(isAdminRole("operator"), true);
  assert.equal(isAdminRole("admin"), false);
  assert.equal(isAdminRole("member"), false);
});

test("portal stays closed without MFA AAL2", () => {
  const admin = { role: "owner" as const, status: "active" };
  assert.equal(
    adminPortalAllowed({ admin, aal: "aal1", verifiedFactorCount: 1 }),
    false,
  );
  assert.equal(
    adminPortalAllowed({ admin, aal: "aal2", verifiedFactorCount: 0 }),
    false,
  );
  assert.equal(
    adminPortalAllowed({ admin: null, aal: "aal2", verifiedFactorCount: 1 }),
    false,
  );
  assert.equal(
    adminPortalAllowed({ admin, aal: "aal2", verifiedFactorCount: 1 }),
    true,
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
