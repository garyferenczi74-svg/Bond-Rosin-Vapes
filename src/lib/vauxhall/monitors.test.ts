import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MONITOR_CATALOG, mockLintPageCopy } from "./monitors.ts";
import { VauxhallStore } from "./store.ts";
import { MONITOR_IDS } from "./types.ts";

test("MonitorEngine seeds fourteen monitors and stays frozen", () => {
  const store = new VauxhallStore();
  const monitors = store.listMonitors();
  assert.equal(monitors.length, 14);
  assert.deepEqual(
    monitors.map((item) => item.id),
    [...MONITOR_IDS],
  );
  assert.equal(store.demoLive, false);
  assert.equal(monitors.every((item) => item.state === "green"), true);
  assert.equal(store.verifyAuditChain().ok, true);
  assert.equal(store.p0Banner(), "");
  const card = store.scorecard();
  assert.equal(card.p0_30d, 0);
  assert.ok(card.p1_30d >= 1);
  assert.equal(card.open, 3);
  assert.equal(card.escapes_30d, 0);
});

test("Demo Live ticks open the lint catch then the lockout burst", () => {
  const store = new VauxhallStore();
  const before = store.scorecard();
  store.setDemoLive(true);
  store.tickMonitorEngine(2000);
  const lint = store.listFindings().find((item) => item.monitorId === "content-lint");
  assert.ok(lint);
  assert.equal(lint?.severity, "P2");
  assert.equal(lint?.state, "open");
  assert.match(lint?.cite ?? "", /mock page \/faq/);
  assert.equal(
    store.listEvents().some((event) => event.summary.includes("Content lint sweep")),
    true,
  );
  store.tickMonitorEngine(2000);
  const lock = store.listFindings().find((item) => item.monitorId === "auth-watch" && item.severity === "P0");
  assert.ok(lock);
  const incident = store.listIncidents().find((item) => item.findingId === lock?.id);
  assert.ok(incident);
  assert.equal((incident?.beats ?? []).length >= 5, true);
  assert.match(incident?.rollbackStub ?? "", /M rollback linkage stub/);
  assert.equal(
    store.listEvents().some((event) => event.type === "Alert" && event.summary.includes("ALERT. Auth watch")),
    true,
  );
  assert.match(store.p0Banner(), /P0/);
  assert.ok(store.scorecard().open > before.open);
  assert.ok(store.scorecard().p0_30d >= 1);
  store.setDemoLive(false);
  const events = store.listEvents().length;
  store.tickMonitorEngine(8000);
  assert.equal(store.listEvents().length, events);
});

test("expired waiver reopens its finding automatically", () => {
  const store = new VauxhallStore();
  const closed = store.listFindings().find((item) => item.id === "f-p3-closed");
  assert.equal(closed?.state, "closed");
  store.ensureStandingSecurityChecks();
  const reopened = store.listFindings().find((item) => item.id === "f-p3-closed");
  assert.equal(reopened?.state, "open");
  const vendor = store.listFindings().find((item) => item.source === "Vendor register");
  assert.ok(vendor);
});

test("closing a finding requires evidence and moves the scorecard", () => {
  const store = new VauxhallStore();
  const open = store.scorecard().open;
  const denied = store.closeFinding("f-p2-dash", "   ");
  assert.equal(denied.ok, false);
  assert.equal(store.scorecard().open, open);
  const ok = store.closeFinding("f-p2-dash", "Replaced dash characters in the prototype copy bank.");
  assert.equal(ok.ok, true);
  assert.equal(store.scorecard().open, open - 1);
  assert.equal(store.listFindings().find((item) => item.id === "f-p2-dash")?.state, "closed");
});

test("agent-conduct rules stay read-only in Phase A", () => {
  const store = new VauxhallStore();
  const locked = store.listRules().find((item) => item.id === "rule-agents");
  assert.equal(locked?.editable, false);
  const result = store.editRule("rule-agents", { citation: "should not write" });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Felix and counsel/);
  const allowed = store.editRule("rule-headers", { citation: "Updated mock citation." });
  assert.equal(allowed.ok, true);
  assert.equal(store.listRules().find((item) => item.id === "rule-headers")?.citation, "Updated mock citation.");
});

test("Pre-Check blocks rc-118, passes after Fix Applied, and Queue reflects both", () => {
  const store = new VauxhallStore();
  assert.equal(store.precheckFor("rc-117")?.verdict, "green");
  const blocked = store.runPreCheck("rc-118");
  assert.equal(blocked.verdict, "blocked");
  assert.match(blocked.reasons[0] ?? "", /Claims-language lint/);
  assert.match(store.listQueue().rcs.find((item) => item.id === "rc-118")?.note ?? "", /Pre-Check blocked/);
  assert.equal(store.mGateAllows("rc-118"), false);
  store.applyPreCheckFix("rc-118");
  const passed = store.runPreCheck("rc-118");
  assert.equal(passed.verdict, "green");
  assert.match(store.listQueue().rcs.find((item) => item.id === "rc-118")?.note ?? "", /Pre-Check green/);
  assert.equal(store.mGateAllows("rc-118"), true);
  const clean = store.runPreCheck("rc-117");
  assert.equal(clean.verdict, "green");
});

test("Audit chain verifies, fails under Tamper Test with P0, then restores", () => {
  const store = new VauxhallStore();
  assert.equal(store.verifyAuditChain().ok, true);
  const tamper = store.tamperAudit();
  assert.equal(tamper.ok, false);
  assert.ok(store.listFindings().some((item) => item.monitorId === "audit-integrity" && item.severity === "P0"));
  assert.match(store.p0Banner(), /P0/);
  const reset = store.resetAuditChain();
  assert.equal(reset.ok, true);
  assert.equal(store.verifyAuditChain().ok, true);
});

test("Demo Trigger fires a monitor without external calls and Metrc reads Trace only", () => {
  const store = new VauxhallStore();
  store.triggerMonitorFailure("rls-probe");
  assert.equal(store.listMonitors().find((item) => item.id === "rls-probe")?.state, "failing");
  assert.ok(store.listFindings().some((item) => item.monitorId === "rls-probe" && item.severity === "P0"));
  store.demoSeedStale();
  store.setDemoLive(true);
  store.tickMonitorEngine(4000);
  const metrc = store.listMonitors().find((item) => item.id === "metrc-sync");
  assert.equal(metrc?.state, "failing");
  assert.ok(store.listFindings().some((item) => item.monitorId === "metrc-sync"));
});

test("SOC 2 evidence pack is client-side JSON and lint page is constructed", () => {
  const store = new VauxhallStore();
  const pack = store.soc2EvidencePack(new Date("2026-09-16T12:00:00"));
  assert.equal(pack.filename, "soc2-evidence-20260916.json");
  const body = JSON.parse(pack.json) as { mock: boolean; families: { coverage: number }[] };
  assert.equal(body.mock, true);
  assert.ok(body.families.length >= 2);
  const page = mockLintPageCopy();
  assert.equal(page.includes(String.fromCharCode(0x2014)), true);
  assert.equal(MONITOR_CATALOG.length, 14);
});

test("new monitor strings stay dash-clean and live paging stays off", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const files = ["monitors.ts", "store.ts", "../../components/vauxhall/security-views.tsx"].map((rel) =>
    readFileSync(join(here, rel), "utf8"),
  );
  for (const text of files) {
    assert.equal(text.includes("\u2013"), false);
    assert.equal(text.includes("\u2014"), false);
    assert.equal(text.includes("MetrcConnectAdapter"), false);
    assert.equal(text.includes("pageGary"), false);
    assert.equal(text.includes("twilio"), false);
    assert.equal(text.includes("revokeCredential"), false);
  }
  const social = readFileSync(join(here, "../../components/vauxhall/social-views.tsx"), "utf8");
  assert.match(social, /Prompt 2C stays parked/);
  const access = readFileSync(join(here, "../access.ts"), "utf8");
  assert.match(access, /\/Admin\.dc\.html/);
  assert.equal(access.includes("/Haus.dc.html"), false);
});
