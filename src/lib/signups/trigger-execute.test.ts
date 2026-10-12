import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { acquirePgLock, postgresTestReady, runPsql } from "./pg-harness.ts";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const migrationDir = join(root, "supabase/migrations");
const revokeFile = "20261012190000_revoke_trigger_definer_execute.sql";
const searchPathFile = "20261012190100_pin_function_search_path.sql";
const chain = [
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
  revokeFile,
  searchPathFile,
];

const flaggedTriggers = [
  "public.haus_updates_before_insert()",
  "public.haus_updates_suppression_before_insert()",
];

const ready = postgresTestReady();

test("trigger definer revoke names the two flagged functions", () => {
  const sql = readFileSync(join(migrationDir, revokeFile), "utf8");
  for (const fn of flaggedTriggers) {
    assert.match(sql, new RegExp(`REVOKE EXECUTE ON FUNCTION ${fn.replace(/[().]/g, "\\$&")} FROM PUBLIC`));
    assert.match(sql, new RegExp(`REVOKE EXECUTE ON FUNCTION ${fn.replace(/[().]/g, "\\$&")} FROM anon`));
    assert.match(sql, new RegExp(`REVOKE EXECUTE ON FUNCTION ${fn.replace(/[().]/g, "\\$&")} FROM authenticated`));
  }
  assert.equal(sql.includes("bond_retention_delete_only"), true);
  assert.equal(/REVOKE EXECUTE ON FUNCTION public\.bond_retention_delete_only/.test(sql), false);
  assert.equal(/REVOKE EXECUTE ON FUNCTION public\.is_admin/.test(sql), false);
});

test("search_path pin names the five advisor functions", () => {
  const sql = readFileSync(join(migrationDir, searchPathFile), "utf8");
  for (const name of [
    "audit_log_deny_mutation",
    "bond_retention_delete_only",
    "dispensary_accounts_mark_closed",
    "haus_updates_before_delete",
    "nearest_bond_dispensaries",
  ]) {
    assert.match(sql, new RegExp(name));
  }
  assert.match(sql, /SET search_path = public, pg_temp/);
  assert.match(sql, /GRANT %I TO %I WITH SET TRUE, INHERIT TRUE/);
  assert.match(sql, /input_city text/);
});

test("revoked security definer triggers still fire", { skip: ready ? false : "local Postgres is not available" }, () => {
  const database = `bond_trig_${process.pid}_${Date.now()}`;
  const release = acquirePgLock();
  const dir = mkdtempSync(join(tmpdir(), "bond-trig-"));
  chmodSync(dir, 0o755);
  const applyPath = join(dir, "apply.sql");
  const includes = chain.map((name) => `\\i ${join(migrationDir, name)}`).join("\n");
  writeFileSync(
    applyPath,
    `
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
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END
$$;
GRANT anon TO CURRENT_USER WITH SET TRUE, INHERIT TRUE;
GRANT authenticated TO CURRENT_USER WITH SET TRUE, INHERIT TRUE;
GRANT service_role TO CURRENT_USER WITH SET TRUE, INHERIT TRUE;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

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
    SELECT 1 FROM public.admins a
    WHERE a.user_id = auth.uid() AND a.status = 'active' AND a.role IN ('owner', 'operator')
  )
$fn$;

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

${includes}
`,
  );
  chmodSync(applyPath, 0o644);

  try {
    const created = runPsql(["-c", `CREATE DATABASE ${database}`]);
    assert.equal(created.status, 0, created.stderr);
    const applied = runPsql(["-d", database, "-f", applyPath]);
    assert.equal(applied.status, 0, `${applied.stdout}\n${applied.stderr}`);

    const again = runPsql(["-d", database, "-f", join(migrationDir, revokeFile)]);
    assert.equal(again.status, 0, again.stderr);

    const privs = runPsql([
      "-d",
      database,
      "-tAc",
      `
SELECT
  has_function_privilege('anon', 'public.haus_updates_before_insert()', 'EXECUTE')
  OR has_function_privilege('authenticated', 'public.haus_updates_before_insert()', 'EXECUTE')
  OR has_function_privilege('anon', 'public.haus_updates_suppression_before_insert()', 'EXECUTE')
  OR has_function_privilege('authenticated', 'public.haus_updates_suppression_before_insert()', 'EXECUTE');
`,
    ]);
    assert.equal(privs.status, 0, privs.stderr);
    assert.equal(privs.stdout.trim(), "f");

    const direct = runPsql([
      "-d",
      database,
      "-c",
      "SET ROLE anon; SELECT public.haus_updates_before_insert();",
    ]);
    assert.notEqual(direct.status, 0);
    assert.match(direct.stderr, /permission denied/i);
    assert.equal(/can only be called as triggers/i.test(direct.stderr), false);

    const directSuppression = runPsql([
      "-d",
      database,
      "-c",
      "SET ROLE anon; SELECT public.haus_updates_suppression_before_insert();",
    ]);
    assert.notEqual(directSuppression.status, 0);
    assert.match(directSuppression.stderr, /permission denied/i);

    const proof = runPsql([
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gate_writer') THEN
    CREATE ROLE gate_writer NOLOGIN;
  END IF;
END
$$;
GRANT gate_writer TO CURRENT_USER WITH SET TRUE, INHERIT TRUE;
GRANT INSERT, SELECT ON TABLE public.haus_updates TO gate_writer;
GRANT INSERT, SELECT ON TABLE public.haus_updates_suppression TO gate_writer;
DROP POLICY IF EXISTS gate_writer_updates_insert ON public.haus_updates;
CREATE POLICY gate_writer_updates_insert ON public.haus_updates FOR INSERT TO gate_writer WITH CHECK (true);
DROP POLICY IF EXISTS gate_writer_updates_select ON public.haus_updates;
CREATE POLICY gate_writer_updates_select ON public.haus_updates FOR SELECT TO gate_writer USING (true);
DROP POLICY IF EXISTS gate_writer_suppression_insert ON public.haus_updates_suppression;
CREATE POLICY gate_writer_suppression_insert ON public.haus_updates_suppression FOR INSERT TO gate_writer WITH CHECK (true);
DROP POLICY IF EXISTS gate_writer_suppression_select ON public.haus_updates_suppression;
CREATE POLICY gate_writer_suppression_select ON public.haus_updates_suppression FOR SELECT TO gate_writer USING (true);

SELECT has_function_privilege('gate_writer', 'public.haus_updates_before_insert()', 'EXECUTE') AS writer_exec_insert;
SELECT has_function_privilege('gate_writer', 'public.haus_updates_suppression_before_insert()', 'EXECUTE') AS writer_exec_suppression;
`,
    ]);
    assert.equal(proof.status, 0, `${proof.stdout}\n${proof.stderr}`);
    assert.match(proof.stdout, /writer_exec_insert[\s\S]{0,40}\n-+\n\s*f/);
    assert.match(proof.stdout, /writer_exec_suppression[\s\S]{0,40}\n-+\n\s*f/);

    const blocked = runPsql([
      "-d",
      database,
      "-c",
      `
SET ROLE gate_writer;
SELECT set_config('bond.haus_update_via_function', '', true);
INSERT INTO public.haus_updates (email, source, email_hmac)
VALUES ('MiXeD@Example.com', 'salon', repeat('ab', 32));
`,
    ]);
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr, /haus_updates writes go through bond_record_haus_update/);

    const inserted = runPsql([
      "-d",
      database,
      "-tAc",
      `
SET ROLE gate_writer;
SELECT set_config('bond.haus_update_via_function', '1', true);
INSERT INTO public.haus_updates (email, source, email_hmac)
VALUES ('MiXeD@Example.com', 'salon', repeat('ab', 32));
RESET ROLE;
SELECT email FROM public.haus_updates WHERE email_hmac = repeat('ab', 32);
`,
    ]);
    assert.equal(inserted.status, 0, `${inserted.stdout}\n${inserted.stderr}`);
    assert.match(inserted.stdout, /mixed@example.com/);
    assert.equal(inserted.stdout.includes("MiXeD@Example.com"), false);

    const blockedSuppression = runPsql([
      "-d",
      database,
      "-c",
      `
SET ROLE gate_writer;
SELECT set_config('bond.haus_update_via_function', '', true);
INSERT INTO public.haus_updates_suppression (email_hmac) VALUES (repeat('cd', 32));
`,
    ]);
    assert.notEqual(blockedSuppression.status, 0);
    assert.match(
      blockedSuppression.stderr,
      /haus_updates_suppression writes go through bond_unsubscribe_haus_update/,
    );

    const suppressed = runPsql([
      "-d",
      database,
      "-tAc",
      `
SET ROLE gate_writer;
SELECT set_config('bond.haus_update_via_function', '1', true);
INSERT INTO public.haus_updates_suppression (email_hmac) VALUES (repeat('cd', 32));
RESET ROLE;
SELECT count(*) FROM public.haus_updates_suppression WHERE email_hmac = repeat('cd', 32);
`,
    ]);
    assert.equal(suppressed.status, 0, `${suppressed.stdout}\n${suppressed.stderr}`);
    assert.match(suppressed.stdout, /^1$/m);

    const scrambled = runPsql([
      "-d",
      database,
      "-c",
      `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'path_owner') THEN
    CREATE ROLE path_owner NOLOGIN;
  END IF;
END
$$;
GRANT path_owner TO CURRENT_USER WITH SET TRUE, INHERIT TRUE;
GRANT CREATE ON SCHEMA public TO path_owner;
SET ROLE path_owner;
CREATE FUNCTION public.nearest_bond_dispensaries(input_city text)
RETURNS text
LANGUAGE sql
AS $fn$ SELECT input_city $fn$;
RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM path_owner;
GRANT CREATE ON SCHEMA public TO bond_retention;
ALTER FUNCTION public.haus_updates_before_delete() OWNER TO bond_retention;
REVOKE CREATE ON SCHEMA public FROM bond_retention;
SET ROLE bond_retention;
ALTER FUNCTION public.haus_updates_before_delete() RESET search_path;
RESET ROLE;
`,
    ]);
    assert.equal(scrambled.status, 0, `${scrambled.stdout}\n${scrambled.stderr}`);

    const repaired = runPsql(["-d", database, "-f", join(migrationDir, searchPathFile)]);
    assert.equal(repaired.status, 0, `${repaired.stdout}\n${repaired.stderr}`);
    const repairedAgain = runPsql(["-d", database, "-f", join(migrationDir, searchPathFile)]);
    assert.equal(repairedAgain.status, 0, repairedAgain.stderr);

    const pinned = runPsql([
      "-d",
      database,
      "-tAc",
      `
SELECT current_user = session_user;
SELECT string_agg(p.proname || ':' || coalesce(array_to_string(p.proconfig, ','), ''), ',' ORDER BY p.proname)
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'audit_log_deny_mutation',
    'bond_retention_delete_only',
    'dispensary_accounts_mark_closed',
    'haus_updates_before_delete',
    'nearest_bond_dispensaries'
  );
`,
    ]);
    assert.equal(pinned.status, 0, `${pinned.stdout}\n${pinned.stderr}`);
    const pinnedLines = pinned.stdout.trim().split("\n").filter((line) => line.length > 0);
    assert.equal(pinnedLines[0], "t");
    assert.equal(
      pinnedLines[1],
      [
        "audit_log_deny_mutation:search_path=public, pg_temp",
        "bond_retention_delete_only:search_path=public, pg_temp",
        "dispensary_accounts_mark_closed:search_path=public, pg_temp",
        "haus_updates_before_delete:search_path=public, pg_temp",
        "nearest_bond_dispensaries:search_path=public, pg_temp",
      ].join(","),
    );
  } finally {
    try {
      runPsql(["-c", `DROP DATABASE IF EXISTS ${database} WITH (FORCE)`]);
      rmSync(dir, { recursive: true, force: true });
    } finally {
      release();
    }
  }
});
