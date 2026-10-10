import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const migrationDir = join(root, "supabase/migrations");
const scheduleFiles = [
  "20261008201000_felix_request_retention.sql",
  "20261008220000_keyed_hash_and_dispensary_retention.sql",
  "20261009203000_haus_updates_hold.sql",
  "20261010001000_purge_expired_sessions.sql",
];
const applyFiles = [
  "20261008193000_server_side_signups.sql",
  "20261008201000_felix_request_retention.sql",
  "20261008213000_owner_only_signup_reads.sql",
  "20261008220000_keyed_hash_and_dispensary_retention.sql",
  "20261009190000_haus_updates_optin.sql",
  "20261009203000_haus_updates_hold.sql",
  "20261009210000_revoke_anon_signup_inserts.sql",
  "20261009220000_haus_update_token_cleanup.sql",
  "20261009230000_haus_confirm_token_expiry.sql",
  "20261009233000_bond_has_haus_update.sql",
  "20261009234000_haus_update_reopt.sql",
  "20261009235000_session_grants_and_reopt_bind.sql",
  "20261010001000_purge_expired_sessions.sql",
];
const guardFile = "20261010002000_require_retention_cron_jobs.sql";
const specsFile = "20261008201000_felix_request_retention.sql";
const expectedJobs = [
  ["bond_purge_haus_requests", "20 4 * * *", "SELECT public.bond_purge_haus_requests()"],
  ["bond_purge_order_requests", "25 4 * * *", "SELECT public.bond_purge_order_requests()"],
  ["bond_purge_auth_attempts", "30 4 * * *", "SELECT public.bond_purge_auth_attempts()"],
  ["bond_purge_audit_log", "35 4 * * *", "SELECT public.bond_purge_audit_log()"],
  ["bond_purge_dispensary_accounts", "40 4 * * *", "SELECT public.bond_purge_dispensary_accounts()"],
  ["bond_purge_haus_updates", "45 4 * * *", "SELECT public.bond_purge_haus_updates()"],
  ["bond_purge_expired_sessions", "50 4 * * *", "SELECT public.bond_purge_expired_sessions()"],
] as const;
const systemPaths = [
  "/usr/share/postgresql",
  "/usr/share/postgresql/16",
  "/usr/share/postgresql/16/extension",
  "/usr/lib/postgresql",
  "/usr/lib/postgresql/16",
];
const psqlReady = spawnSync("psql", ["--version"], { encoding: "utf8" });
const sudoReady = spawnSync("sudo", ["-n", "-u", "postgres", "psql", "-c", "SELECT 1"], { encoding: "utf8" });
const ready = psqlReady.status === 0 && sudoReady.status === 0;

function readMigration(name: string) {
  return readFileSync(join(migrationDir, name), "utf8");
}

function snapshotSystem() {
  return systemPaths.map((path) => {
    if (!existsSync(path)) return `${path} absent`;
    const stat = statSync(path);
    const names = stat.isDirectory() ? readdirSync(path).sort().join(",") : "";
    return `${path} mtimeNs=${stat.mtimeNs} size=${stat.size} entries=${names}`;
  }).join("\n");
}

function psql(args: string[]) {
  return spawnSync("sudo", ["-n", "-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", ...args], {
    encoding: "utf8",
  });
}

function psqlSql(database: string, sql: string) {
  return psql(["-d", database, "-c", sql]);
}

function psqlFiles(database: string, names: string[], dir: string) {
  const file = join(dir, `apply-${randomBytes(4).toString("hex")}.sql`);
  writeFileSync(file, names.map((name) => `\\i ${join(migrationDir, name)}`).join("\n") + "\n");
  chmodSync(file, 0o644);
  return psql(["-d", database, "-f", file]);
}

const prelude = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$fn$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $fn$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$fn$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$$;
GRANT anon TO postgres;
GRANT authenticated TO postgres;
GRANT service_role TO postgres;

CREATE TABLE public.admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  mfa_enrolled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.admins a
    WHERE a.user_id = auth.uid()
      AND a.status = 'active'
      AND a.role IN ('owner', 'operator')
  )
$fn$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE TABLE public.auth_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_hash text NOT NULL,
  ip text,
  outcome text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor uuid,
  action text NOT NULL,
  target text,
  before jsonb,
  after jsonb,
  at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  path text
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
`;

const cronStub = `
CREATE SCHEMA IF NOT EXISTS cron;
CREATE TABLE IF NOT EXISTS cron.job (
  jobid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  schedule text NOT NULL,
  command text NOT NULL,
  jobname text UNIQUE,
  active boolean NOT NULL DEFAULT true
);
CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text)
RETURNS bigint
LANGUAGE plpgsql
SET search_path TO cron, pg_temp
AS $fn$
DECLARE
  new_id bigint;
BEGIN
  INSERT INTO cron.job (schedule, command, jobname)
  VALUES (schedule, command, job_name)
  RETURNING jobid INTO new_id;
  RETURN new_id;
END;
$fn$;
INSERT INTO pg_extension (oid, extname, extowner, extnamespace, extrelocatable, extversion)
SELECT
  ((SELECT max(oid) FROM pg_extension)::bigint + 1)::oid,
  'pg_cron',
  (SELECT oid FROM pg_roles WHERE rolname = current_user),
  (SELECT oid FROM pg_namespace WHERE nspname = 'cron'),
  false,
  '1.0'
WHERE NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');
`;

function createDatabase(name: string, created: string[]) {
  if (!/^bond_cf_[a-z0-9_]+$/.test(name)) {
    throw new Error(`refusing to create unexpected database name ${name}`);
  }
  const createdResult = psql(["-c", `CREATE DATABASE ${name}`]);
  assert.equal(createdResult.status, 0, createdResult.stderr);
  created.push(name);
  const stub = psqlSql(name, prelude);
  assert.equal(stub.status, 0, stub.stderr);
}

function installCronStub(database: string) {
  const installed = psqlSql(database, cronStub);
  assert.equal(installed.status, 0, installed.stderr);
}

function assertJobs(database: string, label: string) {
  const listed = psql([
    "-d", database,
    "-At",
    "-c",
    "SELECT jobname || '|' || schedule || '|' || command || '|' || active::text FROM cron.job ORDER BY jobname;",
  ]);
  console.log(label, listed.stdout.trim());
  assert.equal(listed.status, 0, listed.stderr);
  const rows = listed.stdout.trim().split("\n").filter((line) => line.length > 0);
  const want = expectedJobs
    .map(([jobname, schedule, command]) => `${jobname}|${schedule}|${command}|true`)
    .sort();
  assert.deepEqual(rows, want);
}

test("cron migrations tolerate only a missing pg_cron install", () => {
  const specs = readMigration(specsFile);
  for (const [jobname, schedule, command] of expectedJobs) {
    assert.match(specs, new RegExp(`'${jobname}', '${schedule.replace(/\*/g, "\\*")}', '${command.replace(/[()]/g, "\\$&")}'`));
  }
  for (const name of scheduleFiles) {
    const sql = readMigration(name);
    assert.equal(sql.includes("WHEN OTHERS"), false, name);
    assert.equal(sql.includes("CREATE EXTENSION"), false, name);
    assert.match(sql, /pg_extension WHERE extname = 'pg_cron'/);
    assert.match(sql, /pg_namespace WHERE nspname = 'cron'/);
    assert.match(sql, /bond_retention_cron_specs\(\)/);
    assert.match(sql, /RAISE NOTICE 'pg_cron schedule skipped \(%\)\. Enabling pg_cron is a ship-time step for M\.'/);
    if (name !== specsFile) {
      for (const [, schedule] of expectedJobs) {
        assert.equal(sql.includes(`'${schedule}'`), false, `${name} repeats ${schedule}`);
      }
    }
  }
  const guard = readMigration(guardFile);
  assert.equal(guard.includes("WHEN OTHERS"), false);
  assert.match(guard, /Enable pg_cron on this database before applying migrations/);
  assert.match(guard, /bond_retention_cron_specs\(\)/);
  assert.match(guard, /PERFORM cron\.schedule\(spec\.jobname, spec\.schedule, spec\.command\)/);
  assert.match(guard, /failed check: active/);
  assert.match(guard, /failed check: schedule/);
  assert.match(guard, /failed check: command/);
  assert.match(guard, /failed check: missing/);
  assert.match(guard, /SELECT public\.bond_require_retention_cron_jobs\(\)/);
  for (const [, schedule] of expectedJobs) {
    assert.equal(guard.includes(`'${schedule}'`), false);
  }
});

test("retention cron guard fails closed and passes when all 7 jobs exist", { skip: ready ? false : "local Postgres is not available" }, () => {
  const suffix = `${process.pid}_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const bare = `bond_cf_${suffix}_bare`;
  const full = `bond_cf_${suffix}_full`;
  const broken = `bond_cf_${suffix}_break`;
  const created: string[] = [];
  const beforeSystem = snapshotSystem();
  const dir = mkdtempSync(join(tmpdir(), "bond-cron-"));
  chmodSync(dir, 0o755);
  console.log("CRON_SCRATCH_DBS", bare, full, broken);
  console.log("CRON_SCRATCH_DIR", dir);
  try {
    createDatabase(bare, created);
    const bareApply = psqlFiles(bare, applyFiles, dir);
    console.log("CRON_BARE_APPLY", bareApply.status);
    if (bareApply.status !== 0) console.log("CRON_BARE_APPLY_ERR", bareApply.stderr.trim());
    assert.equal(bareApply.status, 0, bareApply.stderr);
    const bareGuard = psqlFiles(bare, [guardFile], dir);
    console.log("CRON_BARE_GUARD", bareGuard.status, bareGuard.stderr.trim());
    assert.notEqual(bareGuard.status, 0);
    assert.match(bareGuard.stderr, /pg_cron is not installed\. Enable pg_cron on this database before applying migrations\. Privacy retention depends on the daily purge jobs\./);

    installCronStub(bare);
    const healed = psqlFiles(bare, [guardFile], dir);
    console.log("CRON_HEAL_MISSING", healed.status);
    if (healed.status !== 0) console.log("CRON_HEAL_MISSING_ERR", healed.stderr.trim());
    assert.equal(healed.status, 0, `${healed.stdout}\n${healed.stderr}`);
    assertJobs(bare, "CRON_HEALED_JOBS");

    createDatabase(full, created);
    installCronStub(full);
    const fullApply = psqlFiles(full, [...applyFiles, guardFile], dir);
    console.log("CRON_FULL_APPLY", fullApply.status);
    if (fullApply.status !== 0) console.log("CRON_FULL_APPLY_ERR", fullApply.stderr.trim());
    assert.equal(fullApply.status, 0, `${fullApply.stdout}\n${fullApply.stderr}`);
    assertJobs(full, "CRON_JOBS");

    const disabled = psqlSql(full, "UPDATE cron.job SET active = false WHERE jobname = 'bond_purge_haus_updates';");
    assert.equal(disabled.status, 0, disabled.stderr);
    const disabledGuard = psqlFiles(full, [guardFile], dir);
    console.log("CRON_DISABLED_JOB", disabledGuard.status, disabledGuard.stderr.trim());
    assert.notEqual(disabledGuard.status, 0);
    assert.match(disabledGuard.stderr, /retention job bond_purge_haus_updates failed check: active/);
    const reenabled = psqlSql(full, "UPDATE cron.job SET active = true WHERE jobname = 'bond_purge_haus_updates';");
    assert.equal(reenabled.status, 0, reenabled.stderr);

    const wrongSchedule = psqlSql(full, "UPDATE cron.job SET schedule = '0 0 * * *' WHERE jobname = 'bond_purge_order_requests';");
    assert.equal(wrongSchedule.status, 0, wrongSchedule.stderr);
    const wrongScheduleGuard = psqlFiles(full, [guardFile], dir);
    console.log("CRON_WRONG_SCHEDULE", wrongScheduleGuard.status, wrongScheduleGuard.stderr.trim());
    assert.notEqual(wrongScheduleGuard.status, 0);
    assert.match(wrongScheduleGuard.stderr, /retention job bond_purge_order_requests failed check: schedule/);
    const restoredSchedule = psqlSql(full, "UPDATE cron.job SET schedule = '25 4 * * *' WHERE jobname = 'bond_purge_order_requests';");
    assert.equal(restoredSchedule.status, 0, restoredSchedule.stderr);

    const wrongCommand = psqlSql(full, "UPDATE cron.job SET command = 'SELECT 1' WHERE jobname = 'bond_purge_audit_log';");
    assert.equal(wrongCommand.status, 0, wrongCommand.stderr);
    const wrongCommandGuard = psqlFiles(full, [guardFile], dir);
    console.log("CRON_WRONG_COMMAND", wrongCommandGuard.status, wrongCommandGuard.stderr.trim());
    assert.notEqual(wrongCommandGuard.status, 0);
    assert.match(wrongCommandGuard.stderr, /retention job bond_purge_audit_log failed check: command/);
    const restoredCommand = psqlSql(
      full,
      "UPDATE cron.job SET command = 'SELECT public.bond_purge_audit_log()' WHERE jobname = 'bond_purge_audit_log';",
    );
    assert.equal(restoredCommand.status, 0, restoredCommand.stderr);

    const removed = psqlSql(full, "DELETE FROM cron.job WHERE jobname = 'bond_purge_expired_sessions';");
    assert.equal(removed.status, 0, removed.stderr);
    const rescheduled = psqlFiles(full, [guardFile], dir);
    console.log("CRON_RESCHEDULE_MISSING", rescheduled.status);
    if (rescheduled.status !== 0) console.log("CRON_RESCHEDULE_MISSING_ERR", rescheduled.stderr.trim());
    assert.equal(rescheduled.status, 0, `${rescheduled.stdout}\n${rescheduled.stderr}`);
    assertJobs(full, "CRON_RESCHEDULED_JOBS");

    const removedAgain = psqlSql(full, "DELETE FROM cron.job WHERE jobname = 'bond_purge_haus_requests';");
    assert.equal(removedAgain.status, 0, removedAgain.stderr);
    const failSchedule = psqlSql(
      full,
      `
CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text)
RETURNS bigint
LANGUAGE plpgsql
AS $fn$
BEGIN
  RAISE EXCEPTION 'simulated cron.schedule failure';
END;
$fn$;
`,
    );
    assert.equal(failSchedule.status, 0, failSchedule.stderr);
    const deletedGuard = psqlFiles(full, [guardFile], dir);
    console.log("CRON_DELETED_JOB", deletedGuard.status, deletedGuard.stderr.trim());
    assert.notEqual(deletedGuard.status, 0);
    assert.match(deletedGuard.stderr, /simulated cron\.schedule failure/);
    assert.equal(deletedGuard.stderr.includes("pg_cron schedule skipped"), false);

    createDatabase(broken, created);
    installCronStub(broken);
    const brokenSchedule = psqlSql(
      broken,
      `
CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text)
RETURNS bigint
LANGUAGE plpgsql
AS $fn$
BEGIN
  RAISE EXCEPTION 'simulated cron.schedule failure';
END;
$fn$;
`,
    );
    assert.equal(brokenSchedule.status, 0, brokenSchedule.stderr);
    const beforeSchedule = psqlFiles(broken, [applyFiles[0]], dir);
    assert.equal(beforeSchedule.status, 0, beforeSchedule.stderr);
    const scheduleFail = psqlFiles(broken, [scheduleFiles[0]], dir);
    console.log("CRON_SCHEDULE_FAIL", scheduleFail.status, scheduleFail.stderr.trim());
    assert.notEqual(scheduleFail.status, 0);
    assert.match(scheduleFail.stderr, /simulated cron\.schedule failure/);
    assert.equal(scheduleFail.stderr.includes("pg_cron schedule skipped"), false);

    assert.equal(snapshotSystem(), beforeSystem);
  } finally {
    for (const name of created) {
      if (!name.startsWith(`bond_cf_${suffix}_`)) continue;
      const dropped = psql(["-c", `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`]);
      console.log("CRON_DROPPED", name, dropped.status);
    }
    rmSync(dir, { recursive: true, force: true });
    const afterSystem = snapshotSystem();
    const leftover = psql(["-At", "-c", `SELECT datname FROM pg_database WHERE datname LIKE 'bond_cf_${suffix}%' ORDER BY 1;`]);
    console.log("CRON_SYSTEM_PATHS", beforeSystem === afterSystem ? "untouched" : "CHANGED");
    console.log("CRON_SCRATCH_LEFT", leftover.stdout.trim() || "(none)");
    if (beforeSystem !== afterSystem) {
      console.log("CRON_SYSTEM_BEFORE", beforeSystem);
      console.log("CRON_SYSTEM_AFTER", afterSystem);
    }
    assert.equal(beforeSystem, afterSystem);
    assert.equal(leftover.status, 0, leftover.stderr);
    assert.equal(leftover.stdout.trim(), "");
  }
});
