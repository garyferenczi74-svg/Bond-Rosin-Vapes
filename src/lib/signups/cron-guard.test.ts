import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const jobs = [
  "bond_purge_haus_requests",
  "bond_purge_order_requests",
  "bond_purge_auth_attempts",
  "bond_purge_audit_log",
  "bond_purge_dispensary_accounts",
  "bond_purge_haus_updates",
  "bond_purge_expired_sessions",
];
const extensionDir = "/usr/share/postgresql/16/extension";
const psqlReady = spawnSync("psql", ["--version"], { encoding: "utf8" });
const sudoReady = spawnSync("sudo", ["-n", "-u", "postgres", "psql", "-c", "SELECT 1"], { encoding: "utf8" });
const ready = psqlReady.status === 0 && sudoReady.status === 0;

function readMigration(name: string) {
  return readFileSync(join(migrationDir, name), "utf8");
}

function psql(args: string[]) {
  return spawnSync("sudo", ["-n", "-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", ...args], {
    encoding: "utf8",
  });
}

function psqlSql(database: string, sql: string) {
  return psql(["-d", database, "-c", sql]);
}

function psqlFiles(database: string, names: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "bond-cron-"));
  chmodSync(dir, 0o755);
  const file = join(dir, "apply.sql");
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

function createDatabase(name: string) {
  const created = psql(["-c", `DROP DATABASE IF EXISTS ${name}`, "-c", `CREATE DATABASE ${name}`]);
  assert.equal(created.status, 0, created.stderr);
  const stub = psqlSql(name, prelude);
  assert.equal(stub.status, 0, stub.stderr);
}

function installCronStub() {
  const dir = mkdtempSync(join(tmpdir(), "bond-pg-cron-"));
  const control = join(dir, "pg_cron.control");
  const sql = join(dir, "pg_cron--1.0.sql");
  writeFileSync(
    control,
    [
      "comment = 'Bond local stub for retention job tests. Not the pg_cron worker.'",
      "default_version = '1.0'",
      "relocatable = false",
      "schema = cron",
      "",
    ].join("\n"),
  );
  writeFileSync(
    sql,
    `
CREATE TABLE job (
  jobid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  schedule text NOT NULL,
  command text NOT NULL,
  jobname text
);

CREATE FUNCTION schedule(job_name text, schedule text, command text)
RETURNS bigint
LANGUAGE plpgsql
SET search_path TO cron
AS $fn$
DECLARE
  new_id bigint;
BEGIN
  INSERT INTO job (schedule, command, jobname)
  VALUES (schedule, command, job_name)
  RETURNING jobid INTO new_id;
  RETURN new_id;
END;
$fn$;
`,
  );
  const copied = spawnSync("sudo", ["-n", "cp", control, sql, extensionDir], { encoding: "utf8" });
  assert.equal(copied.status, 0, copied.stderr);
}

function removeCronStub() {
  spawnSync("sudo", ["-n", "rm", "-f", join(extensionDir, "pg_cron.control"), join(extensionDir, "pg_cron--1.0.sql")], {
    encoding: "utf8",
  });
}

test("cron migrations tolerate only a missing pg_cron install", () => {
  for (const name of scheduleFiles) {
    const sql = readMigration(name);
    assert.equal(sql.includes("WHEN OTHERS"), false, name);
    assert.equal(sql.includes("CREATE EXTENSION"), false, name);
    assert.match(sql, /pg_extension WHERE extname = 'pg_cron'/);
    assert.match(sql, /pg_namespace WHERE nspname = 'cron'/);
    assert.match(sql, /RAISE NOTICE 'pg_cron schedule skipped \(%\)\. Enabling pg_cron is a ship-time step for M\.'/);
  }
  const guard = readMigration(guardFile);
  assert.match(guard, /Enable pg_cron on this database before applying migrations/);
  for (const job of jobs) assert.match(guard, new RegExp(job));
  assert.match(guard, /missing from cron\.job/);
});

test("retention cron guard fails closed and passes when all 7 jobs exist", { skip: ready ? false : "local Postgres is not available" }, () => {
  const stamp = `${process.pid}_${Date.now()}`;
  const bare = `bond_cron_bare_${stamp}`;
  const full = `bond_cron_full_${stamp}`;
  const broken = `bond_cron_break_${stamp}`;
  const databases = [bare, full, broken];
  installCronStub();
  try {
    createDatabase(bare);
    const bareApply = psqlFiles(bare, applyFiles);
    console.log("CRON_BARE_APPLY", bareApply.status);
    if (bareApply.status !== 0) console.log("CRON_BARE_APPLY_ERR", bareApply.stderr.trim());
    assert.equal(bareApply.status, 0, bareApply.stderr);
    const bareGuard = psqlFiles(bare, [guardFile]);
    console.log("CRON_BARE_GUARD", bareGuard.status, bareGuard.stderr.trim());
    assert.notEqual(bareGuard.status, 0);
    assert.match(bareGuard.stderr, /pg_cron is not installed\. Enable pg_cron on this database before applying migrations\. Privacy retention depends on the daily purge jobs\./);

    createDatabase(full);
    const extended = psqlSql(full, "CREATE EXTENSION pg_cron;");
    assert.equal(extended.status, 0, extended.stderr);
    const fullApply = psqlFiles(full, [...applyFiles, guardFile]);
    console.log("CRON_FULL_APPLY", fullApply.status);
    if (fullApply.status !== 0) console.log("CRON_FULL_APPLY_ERR", fullApply.stderr.trim());
    assert.equal(fullApply.status, 0, `${fullApply.stdout}\n${fullApply.stderr}`);
    const listed = psqlSql(full, "SELECT jobname FROM cron.job ORDER BY jobname;");
    console.log("CRON_JOBS", listed.stdout.trim());
    assert.equal(listed.status, 0, listed.stderr);
    for (const job of jobs) assert.match(listed.stdout, new RegExp(`^\\s*${job}\\s*$`, "m"), job);

    const removed = psqlSql(full, "DELETE FROM cron.job WHERE jobname = 'bond_purge_audit_log';");
    assert.equal(removed.status, 0, removed.stderr);
    const missingGuard = psqlFiles(full, [guardFile]);
    console.log("CRON_MISSING_JOB", missingGuard.status, missingGuard.stderr.trim());
    assert.notEqual(missingGuard.status, 0);
    assert.match(missingGuard.stderr, /these retention jobs are missing from cron\.job: bond_purge_audit_log/);

    createDatabase(broken);
    const brokenExt = psqlSql(broken, "CREATE EXTENSION pg_cron;");
    assert.equal(brokenExt.status, 0, brokenExt.stderr);
    const failSchedule = psqlSql(
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
    assert.equal(failSchedule.status, 0, failSchedule.stderr);
    const beforeSchedule = psqlFiles(broken, [applyFiles[0]]);
    assert.equal(beforeSchedule.status, 0, beforeSchedule.stderr);
    const scheduleFail = psqlFiles(broken, [scheduleFiles[0]]);
    console.log("CRON_SCHEDULE_FAIL", scheduleFail.status, scheduleFail.stderr.trim());
    assert.notEqual(scheduleFail.status, 0);
    assert.match(scheduleFail.stderr, /simulated cron\.schedule failure/);
    assert.equal(scheduleFail.stderr.includes("pg_cron schedule skipped"), false);
  } finally {
    for (const name of databases) {
      psql(["-c", `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`]);
    }
    psql(["-c", "DROP DATABASE IF EXISTS bond_cron_stub WITH (FORCE)"]);
    removeCronStub();
  }
});
