import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MetrcConnectAdapter } from "./metrc-connect.ts";
import { readMetrcSandboxConfig, resolveSandboxBaseUrl } from "./metrc-env.ts";
import { isMetrcConnectEnabled, readMetrcAdapterMode } from "./metrc-flags.ts";
import { payloadHasForbiddenNotes, regulatoryTransferFields } from "./metrc-payload.ts";
import { MetrcMockAdapter } from "./metrc-mock.ts";
import { VauxhallStore } from "./store.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");

function walk(rel: string, visit: (path: string, text: string) => void): void {
  const full = join(root, rel);
  const stat = statSync(full);
  if (stat.isDirectory()) {
    for (const name of readdirSync(full)) walk(join(rel, name), visit);
    return;
  }
  if (!/\.(ts|tsx)$/.test(full) || full.endsWith(".test.ts")) return;
  visit(rel, readFileSync(full, "utf8"));
}

const sandboxEnv = {
  METRC_ADAPTER: "connect",
  VERCEL_ENV: "preview",
  METRC_SANDBOX_INTEGRATOR_VENDOR_KEY: "sandbox-vendor-test",
  METRC_SANDBOX_LICENSEE_USER_KEY: "sandbox-user-test",
  METRC_SANDBOX_FACILITY_LICENSE: "SANDBOX-LIC-BOND",
  METRC_SANDBOX_BASE_URL: "https://sandbox-api-ny.metrc.com",
};

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(body == null ? "" : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}

test("METRC_ADAPTER flag stays mock on tip and production", () => {
  assert.equal(readMetrcAdapterMode({}), "mock");
  assert.equal(readMetrcAdapterMode({ METRC_ADAPTER: "connect", VERCEL_ENV: "production" }), "mock");
  assert.equal(readMetrcAdapterMode({ METRC_ADAPTER: "connect", METRC_LIVE: "on", VERCEL_ENV: "preview" }), "mock");
  assert.equal(readMetrcAdapterMode({ METRC_ADAPTER: "connect", METRC_ENV: "production", VERCEL_ENV: "preview" }), "mock");
  assert.equal(readMetrcAdapterMode({ METRC_ADAPTER: "connect", VERCEL_ENV: "preview" }), "connect");
  assert.equal(isMetrcConnectEnabled({}), false);
});

test("sandbox host allowlist blocks production Metrc", () => {
  assert.equal(resolveSandboxBaseUrl("https://api-ny.metrc.com").ok, false);
  assert.equal(resolveSandboxBaseUrl("http://sandbox-api-ny.metrc.com").ok, false);
  const ok = resolveSandboxBaseUrl("https://sandbox-api-ny.metrc.com");
  assert.equal(ok.ok, true);
});

test("Connect adapter requires operator confirm and never copies notes", async () => {
  const calls: Array<{ url: string; body: string }> = [];
  const adapter = new MetrcConnectAdapter({
    env: sandboxEnv,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), body: String(init?.body ?? "") });
      if (String(url).includes("/facilities/v2")) {
        return jsonResponse(200, [
          {
            Id: "fac-north",
            LicenseNumber: "OCM-RET-NORTH",
            DisplayName: "North",
            IsActive: true,
            IsLicensed: true,
            ExpirationDate: "2027-06-01",
          },
        ]);
      }
      if (String(url).includes("/templates/outgoing")) {
        return jsonResponse(200, [{ Id: 77, ManifestNumber: "SANDBOX-MANIFEST-77" }]);
      }
      return jsonResponse(200, []);
    },
  });
  await adapter.getFacilities();
  const refused = await adapter.createTransferDraft({
    orderId: "ord-1108",
    fromFacilityId: "fac-bond",
    toFacilityId: "fac-north",
    destinationLicense: "OCM-RET-NORTH",
    packages: [{ label: "PKG-1", quantity: 2 }],
  });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.match(refused.reason, /Confirm required/);
  const ok = await adapter.createTransferDraft({
    orderId: "ord-1108",
    fromFacilityId: "fac-bond",
    toFacilityId: "fac-north",
    destinationLicense: "OCM-RET-NORTH",
    operatorConfirmed: true,
    packages: [{ label: "PKG-1", quantity: 2 }],
  });
  assert.equal(ok.ok, true);
  const posted = calls.find((row) => row.url.includes("/templates/outgoing"));
  assert.ok(posted);
  assert.equal(posted.body.includes("Dock"), false);
  assert.equal(payloadHasForbiddenNotes(JSON.parse(posted.body)), false);
  if (ok.ok) {
    assert.equal(JSON.stringify(ok.transfer).includes("notes"), false);
    assert.match(ok.transfer.manifestNumber, /SANDBOX-MANIFEST-77/);
  }
});

test("Connect adapter fail-open reads stay stale and never invent a mock discrepancy", async () => {
  const adapter = new MetrcConnectAdapter({
    env: sandboxEnv,
    fetchImpl: async () => jsonResponse(503, { message: "down" }),
  });
  const packages = await adapter.getPackages();
  assert.equal(packages.length, 0);
  const sync = await adapter.getSyncStatus();
  assert.equal(sync.stale, true);
  adapter.seedDiscrepancy("MOCK-UID-U1", 1);
  assert.equal((await adapter.getPackage("MOCK-UID-U1")) == null, true);
});

test("Connect adapter maps Dialed Unwind Peak items and retries rate limits", async () => {
  let packagesHits = 0;
  const adapter = new MetrcConnectAdapter({
    env: sandboxEnv,
    fetchImpl: async (url) => {
      const href = String(url);
      if (href.includes("/packages/v2/active")) {
        packagesHits += 1;
        if (packagesHits === 1) return jsonResponse(429, {}, { "Retry-After": "0" });
        return jsonResponse(200, {
          Data: [
            {
              Label: "NY-PKG-D1",
              Quantity: 12,
              LabTestingState: "TestPassed",
              Item: { Name: "Dialed" },
              PackagedDate: "2026-08-12",
              LocationName: "Vault A",
            },
          ],
        });
      }
      if (href.includes("/items/v2/active")) {
        return jsonResponse(200, [
          { Id: 1, Name: "Dialed" },
          { Id: 2, Name: "Unwind" },
          { Id: 3, Name: "Peak" },
        ]);
      }
      return jsonResponse(200, []);
    },
  });
  const packages = await adapter.getPackages();
  assert.equal(packages[0]?.itemName, "Dialed");
  assert.equal(packages[0]?.skuId, "no-1");
  assert.equal(packages[0]?.testStatus, "TestPassed");
  const items = await adapter.getItems();
  assert.deepEqual(
    items.map((item) => item.skuId),
    ["no-1", "no-2", "no-3"],
  );
  assert.ok(packagesHits >= 2);
});

test("missing sandbox keys fail closed on write and fail open on read", async () => {
  const adapter = new MetrcConnectAdapter({
    env: { METRC_ADAPTER: "connect", VERCEL_ENV: "preview" },
    fetchImpl: async () => {
      throw new Error("fetch should not run without keys.");
    },
  });
  const packages = await adapter.getPackages();
  assert.equal(packages.length, 0);
  const write = await adapter.createTransferDraft({
    orderId: "ord-1",
    fromFacilityId: "fac-bond",
    toFacilityId: "fac-north",
    operatorConfirmed: true,
  });
  assert.equal(write.ok, false);
  if (!write.ok) assert.match(write.reason, /not configured/);
  const cfg = readMetrcSandboxConfig({ METRC_ADAPTER: "connect", VERCEL_ENV: "preview" });
  assert.equal(cfg.ok, false);
});

test("flag off keeps mock adapter transfer and demo seed behavior", async () => {
  const mock = new MetrcMockAdapter({ latencyMs: 0 });
  const store = new VauxhallStore({ labDelayMs: 0, traceLatencyMs: 0, trace: mock, adapterMode: "mock" });
  const attached = await store.attachManifest("ord-1003");
  assert.equal(attached.ok, true);
  const seeded = store.demoSeedDiscrepancy();
  assert.equal(seeded.ok, true);
});

test("Connect mode drops demo discrepancy seeds and blocks local mock writes", async () => {
  const store = new VauxhallStore({ labDelayMs: 0, traceLatencyMs: 0, adapterMode: "connect" });
  const seeded = store.demoSeedDiscrepancy();
  assert.equal(seeded.ok, false);
  if (!seeded.ok) assert.match(seeded.reason, /Connect mode/);
  store.demoSeedStale();
  assert.equal(store.traceSnap.sync.stale, false);
  const local = await store.attachManifest("ord-1003", { operatorConfirmed: true });
  assert.equal(local.ok, false);
  if (!local.ok) assert.match(local.reason, /server after operator confirm/);
  const unconfirmed = await store.attachManifest("ord-1003");
  assert.equal(unconfirmed.ok, false);
  if (!unconfirmed.ok) assert.match(unconfirmed.reason, /Confirm required/);
  assert.equal(store.listDiscrepancies().length, 0);
  assert.match(store.stamp(), /stale/);
});

test("regulatory payload strips notes and forbids note keys", () => {
  const fields = regulatoryTransferFields({
    orderId: "ord-1",
    fromFacilityId: "fac-bond",
    toFacilityId: "fac-north",
    operatorConfirmed: true,
    destinationLicense: "OCM-RET-NORTH",
    packages: [{ label: "PKG-1", quantity: 4 }],
  });
  assert.equal("notes" in fields, false);
  assert.equal(payloadHasForbiddenNotes({ notes: "Dock 2" }), true);
  assert.equal(payloadHasForbiddenNotes(fields), false);
});

test("client and order surfaces never carry Metrc secrets", () => {
  const hits: string[] = [];
  const secret = /METRC_SANDBOX_INTEGRATOR_VENDOR_KEY|METRC_SANDBOX_LICENSEE_USER_KEY|METRC_USER_KEY|METRC_VENDOR_KEY|METRC_PRODUCTION_/;
  for (const dir of ["components", "lib/order", "app/order"]) {
    walk(dir, (path, text) => {
      if (secret.test(text)) hits.push(path);
      if (text.includes("NEXT_PUBLIC_METRC")) hits.push(path);
    });
  }
  walk("lib/vauxhall/store.ts", (path, text) => {
    if (text.includes("MetrcConnectAdapter")) hits.push(path);
    if (secret.test(text)) hits.push(path);
  });
  assert.deepEqual(hits, []);
});
