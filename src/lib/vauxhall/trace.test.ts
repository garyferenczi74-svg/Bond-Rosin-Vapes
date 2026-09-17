import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MetrcMockAdapter } from "./metrc-mock.ts";
import { DISCREPANCY_THRESHOLD_PCT, metrcStamp, variancePercent } from "./trace.ts";

const here = dirname(fileURLToPath(import.meta.url));

function walk(rel: string, hits: string[]): void {
  const full = join(here, rel);
  const stat = statSync(full);
  if (stat.isDirectory()) {
    for (const name of readdirSync(full)) walk(join(rel, name), hits);
    return;
  }
  if (!/\.(ts|tsx)$/.test(full) || full.endsWith(".test.ts")) return;
  const text = readFileSync(full, "utf8");
  if (text.includes("MetrcConnectAdapter")) hits.push(rel);
  if (/api[.-]?metrc|metrc\.com|METRC_USER_KEY|METRC_VENDOR_KEY/i.test(text)) hits.push(rel);
}

test("MetrcMockAdapter hydrates mock packages, facilities, and tags", async () => {
  const adapter = new MetrcMockAdapter({ latencyMs: 0 });
  const snap = adapter.hydrate();
  assert.equal(snap.packages.length, 4);
  assert.ok(snap.packages.every((item) => item.uid.startsWith("MOCK-UID-")));
  assert.equal(snap.facilities.filter((item) => item.licenseNumber.startsWith("MOCK-LIC-PROTO-")).length, 6);
  assert.ok(snap.items.some((item) => item.name === "Dialed"));
  assert.ok(snap.tags.packageTags < snap.tags.packageTagThreshold);
  const packages = await adapter.getPackages();
  assert.equal(packages.length, snap.packages.length);
  const hold = await adapter.getPackage("MOCK-UID-D-HOLD");
  assert.equal(hold?.testStatus, "TestingRequired");
  const lab = await adapter.getLabResults("MOCK-UID-D1");
  assert.equal(lab?.status, "TestPassed");
  assert.equal(lab?.note.includes("http"), false);
});

test("facility gate refuses an inactive destination on transfer draft", async () => {
  const adapter = new MetrcMockAdapter({ latencyMs: 0 });
  const refused = await adapter.createTransferDraft({
    orderId: "ord-1001",
    fromFacilityId: "fac-bond",
    toFacilityId: "fac-metro",
  });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.match(refused.reason, /Facility gate/);
  const ok = await adapter.createTransferDraft({
    orderId: "ord-1001",
    fromFacilityId: "fac-bond",
    toFacilityId: "fac-north",
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.match(ok.transfer.manifestNumber, /^MOCK-MANIFEST-/);
});

test("demo discrepancy and stale sync stay on the mock adapter", async () => {
  const adapter = new MetrcMockAdapter({ latencyMs: 0 });
  adapter.seedDiscrepancy("MOCK-UID-U1", 60);
  const pack = await adapter.getPackage("MOCK-UID-U1");
  assert.equal(pack?.quantity, 60);
  assert.ok(variancePercent(90, 60) > DISCREPANCY_THRESHOLD_PCT);
  adapter.seedStaleSync();
  const sync = await adapter.getSyncStatus();
  assert.equal(sync.stale, true);
  assert.match(metrcStamp(sync), /stale/);
  assert.equal(sync.asOf.length > 0, true);
});

test("mock adapter source still has no live Metrc keys or fetch", () => {
  const hits: string[] = [];
  const mock = readFileSync(join(here, "metrc-mock.ts"), "utf8");
  assert.equal(mock.includes("fetch("), false);
  assert.equal(mock.includes("MetrcConnectAdapter"), false);
  walk(".", hits);
  const unexpected = hits.filter((rel) => !rel.includes("metrc-connect") && !rel.includes("metrc-env") && !rel.includes("trace.ts"));
  assert.deepEqual(unexpected, []);
});
