import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MONITOR_IDS } from "./types.ts";
import { VauxhallStore } from "./store.ts";
import {
  AUTO_ACTION_ALLOWLIST,
  DRY_RUN_BADGE,
  LIVE_OFF_BADGE,
  PHASE_B_ROLLBACK_DEPLOYMENT,
  PHASE_B_AUTO_ACTIONS_ENABLED,
  PHASE_B_EXECUTION_MODE,
  PHASE_B_LIVE_ENABLED,
  PHASE_B_PAGING_ENABLED,
  TWO_REGION_PROBE_CONTRACTS,
  VESPER_WEEKLY_AUDIT,
  appendAuditEvent,
  checkpointAuditOffsite,
  executeAutoAction,
  ingestScanArtifact,
  monitorJobStubs,
  runAllMonitorsDry,
  runMonitorDry,
  runPreCheckServerDry,
  scheduledVerifyJobStub,
  seedMonitorSchedules,
  verifyAuditEventChain,
} from "./plumbing/index.ts";

const here = dirname(fileURLToPath(import.meta.url));

test("monitor_schedules seed the fourteen-monitor catalog as data", () => {
  const rows = seedMonitorSchedules();
  assert.equal(rows.length, 14);
  assert.deepEqual(
    rows.map((item) => item.id),
    [...MONITOR_IDS],
  );
  assert.equal(
    rows.every((item) => item.executionMode === PHASE_B_EXECUTION_MODE && item.liveEnabled === false),
    true,
  );
  assert.equal(PHASE_B_LIVE_ENABLED, false);
  assert.equal(PHASE_B_PAGING_ENABLED, false);
});

test("dry-run MonitorRunner writes run and findings draft without side effects", () => {
  const record = runMonitorDry("site-liveness", "owner", "14:21:00", "2026-09-16");
  assert.equal(record.mode, "dry-run");
  assert.equal(record.liveEnabled, false);
  assert.equal(record.paged, false);
  assert.equal(record.autoAction, false);
  assert.equal(record.probeExecuted, false);
  assert.equal(record.run.state, "green");
  assert.match(record.run.note, /No production call/);
  assert.equal(record.draft.monitorId, "site-liveness");
  assert.match(record.draft.document, /Dry-run draft/);
  const all = runAllMonitorsDry(MONITOR_IDS, "14:22:00", "2026-09-16");
  assert.equal(all.length, 14);
  assert.equal(
    all.every((item) => item.probeExecuted === false && item.paged === false),
    true,
  );
  const jobs = monitorJobStubs(MONITOR_IDS);
  assert.equal(jobs.length, 14);
  assert.equal(jobs.every((item) => item.liveEnabled === false), true);
});

test("two-region probe contracts stay config only", () => {
  assert.ok(TWO_REGION_PROBE_CONTRACTS.length >= 2);
  assert.equal(
    TWO_REGION_PROBE_CONTRACTS.every((item) => item.liveEnabled === false && item.regions.length === 2),
    true,
  );
});

test("production audit chain verifies and never uses Tamper Test", () => {
  let chain = appendAuditEvent([], {
    id: "a1",
    time: "14:20:00",
    actor: "Felix",
    action: "boot",
    target: "audit_events",
    note: "genesis successor",
  });
  chain = appendAuditEvent(chain, {
    id: "a2",
    time: "14:21:00",
    actor: "Gary",
    action: "verify",
    target: "audit_events",
    note: "scheduled verify stub",
  });
  assert.equal(verifyAuditEventChain(chain).ok, true);
  const job = scheduledVerifyJobStub(chain);
  assert.equal(job.job, "verify_audit_chain");
  assert.equal(job.result.ok, true);
  const checkpoint = checkpointAuditOffsite();
  assert.equal(checkpoint.enabled, false);
  assert.equal(PHASE_B_ROLLBACK_DEPLOYMENT, "dpl_DnCSsFcNmXDYLwD1mQJcBWckvbg9");
});

test("scanner ingest maps CI JSON into findings drafts and keeps merge block off", () => {
  const result = ingestScanArtifact(
    {
      source: "github-actions",
      findings: [{ kind: "secret", severity: "critical", title: "Mock token pattern", file: "src/lib/demo.ts" }],
    },
    "2026-09-16",
  );
  assert.equal(result.mergeBlock, false);
  assert.equal(result.drafts[0]?.severity, "P0");
  assert.equal(result.drafts[0]?.monitorId, "dependency-secret");
  assert.match(result.drafts[0]?.document ?? "", /Dry-run scanner ingest/);
});

test("Pre-Check server dry-run reads Trace mock freshness only", () => {
  const blocked = runPreCheckServerDry({ candidate: "rc-118", metrcStale: true, claimsLintCleared: false });
  assert.equal(blocked.verdict, "blocked");
  assert.equal(blocked.metrcSource, "trace-mock");
  assert.equal(blocked.mode, "dry-run");
  assert.match(blocked.reasons.join(" "), /Trace mock only/);
  const green = runPreCheckServerDry({ candidate: "rc-117", metrcStale: false, claimsLintCleared: true });
  assert.equal(green.verdict, "green");
});

test("store plumbing stays off the live scorecard and Demo Live path", () => {
  const store = new VauxhallStore();
  const open = store.scorecard().open;
  store.refreshMonitorSchedules();
  const run = store.runPlumbingDry("rls-probe");
  assert.equal(run.state, "green");
  assert.ok(store.listPlumbingRuns().length >= 1);
  assert.ok(store.listPlumbingFindings().length >= 1);
  assert.equal(store.scorecard().open, open);
  assert.equal(store.listMonitors().find((item) => item.id === "rls-probe")?.state, "green");
  const server = store.runPreCheckServerDry("rc-118");
  assert.equal(server.verdict, "blocked");
  store.ingestScanPayload({
    findings: [{ kind: "dependency", severity: "P2", title: "Mock advisory", package: "mock-lib" }],
  });
  assert.ok(store.listScanner().some((item) => item.source === "CI scan" || item.note.includes("Mock")));
  assert.equal(store.verifyProductionAudit().ok, true);
  assert.equal(store.listAutoActions().every((item) => item.enabled === false), true);
  assert.equal(store.attemptAutoAction("revoke_credentials").executed, false);
  assert.equal(store.weeklyAudit().scheduleStub, true);
  assert.equal(store.shipPrecondition("rc-118").advisory, true);
  assert.equal(store.shipPrecondition("rc-118").hardGate, false);
  assert.match(store.shipPreconditionText(), /Advisory until M enablement/);
  assert.equal(PHASE_B_AUTO_ACTIONS_ENABLED, false);
  assert.equal(AUTO_ACTION_ALLOWLIST.length, 3);
  assert.equal(executeAutoAction("throttle_forms").ok, false);
  assert.equal(VESPER_WEEKLY_AUDIT.owner, "Vesper");
  assert.equal(DRY_RUN_BADGE, "Dry-run");
  assert.equal(LIVE_OFF_BADGE, "Live OFF");
});

test("plumbing strings stay dash-clean and banned paths stay out", () => {
  const root = join(here, "plumbing");
  const files: string[] = [];
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.push(full);
    }
  }
  walk(root);
  files.push(
    join(here, "../..", "components/vauxhall/security-views.tsx"),
    join(here, "../..", "components/vauxhall/command-views.tsx"),
    join(here, "../..", "app/vauxhall/actions.ts"),
    join(here, "../../../supabase/migrations/20260916010000_phase_b_monitor_plumbing.sql"),
  );
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.equal(text.includes("\u2013"), false, file);
    assert.equal(text.includes("\u2014"), false, file);
    assert.equal(text.includes("MetrcConnectAdapter"), false, file);
    assert.equal(text.includes("pageGary"), false, file);
    assert.equal(text.includes("twilio"), false, file);
    assert.equal(text.includes("revokeCredential"), false, file);
    assert.equal(/publishSocial|unparkScheduler/.test(text), false, file);
  }
  const social = readFileSync(join(here, "../../components/vauxhall/social-views.tsx"), "utf8");
  assert.match(social, /Prompt 2C stays parked/);
});
