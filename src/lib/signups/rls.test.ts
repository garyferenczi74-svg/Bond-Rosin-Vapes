import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migration = fileURLToPath(new URL("../../../supabase/migrations/20261008193000_server_side_signups.sql", import.meta.url));
const felix = fileURLToPath(new URL("../../../supabase/migrations/20261008201000_felix_request_retention.sql", import.meta.url));
const ownerOnly = fileURLToPath(new URL("../../../supabase/migrations/20261008213000_owner_only_signup_reads.sql", import.meta.url));
const keyed = fileURLToPath(new URL("../../../supabase/migrations/20261008220000_keyed_hash_and_dispensary_retention.sql", import.meta.url));
const updates = fileURLToPath(new URL("../../../supabase/migrations/20261009190000_haus_updates_optin.sql", import.meta.url));
const hold = fileURLToPath(new URL("../../../supabase/migrations/20261009203000_haus_updates_hold.sql", import.meta.url));
const revokeInserts = fileURLToPath(new URL("../../../supabase/migrations/20261009210000_revoke_anon_signup_inserts.sql", import.meta.url));
const tokenCleanup = fileURLToPath(new URL("../../../supabase/migrations/20261009220000_haus_update_token_cleanup.sql", import.meta.url));
const tokenExpiry = fileURLToPath(new URL("../../../supabase/migrations/20261009230000_haus_confirm_token_expiry.sql", import.meta.url));
const hasUpdate = fileURLToPath(new URL("../../../supabase/migrations/20261009233000_bond_has_haus_update.sql", import.meta.url));
const reopt = fileURLToPath(new URL("../../../supabase/migrations/20261009234000_haus_update_reopt.sql", import.meta.url));
const sessionBind = fileURLToPath(new URL("../../../supabase/migrations/20261009235000_session_grants_and_reopt_bind.sql", import.meta.url));
const sessionPurge = fileURLToPath(new URL("../../../supabase/migrations/20261010001000_purge_expired_sessions.sql", import.meta.url));
const psql = spawnSync("psql", ["--version"], { encoding: "utf8" });
const sudo = spawnSync("sudo", ["-n", "-u", "postgres", "psql", "-c", "SELECT 1"], { encoding: "utf8" });
const ready = psql.status === 0 && sudo.status === 0;

function psqlFile(database: string, file: string) {
  return spawnSync(
    "sudo",
    ["-n", "-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", database, "-f", file],
    { encoding: "utf8" },
  );
}

function psqlSql(database: string, sql: string) {
  return spawnSync(
    "sudo",
    ["-n", "-u", "postgres", "psql", "-d", database, "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8" },
  );
}

test("signup migrations apply and RLS holds on local Postgres", { skip: ready ? false : "local Postgres is not available" }, () => {
  const felixSql = readFileSync(felix, "utf8");
  assert.match(felixSql, /cron\.schedule\(\s*'bond_purge_haus_requests'/);
  assert.match(felixSql, /cron\.schedule\(\s*'bond_purge_order_requests'/);
  assert.match(felixSql, /cron\.schedule\(\s*'bond_purge_auth_attempts'/);
  assert.match(felixSql, /cron\.schedule\(\s*'bond_purge_audit_log'/);
  assert.equal(felixSql.includes("CREATE OR REPLACE FUNCTION public.is_admin"), false);
  const ownerSql = readFileSync(ownerOnly, "utf8");
  assert.match(ownerSql, /CREATE OR REPLACE FUNCTION public\.is_owner\(\)/);
  assert.equal(ownerSql.includes("CREATE OR REPLACE FUNCTION public.is_admin"), false);
  assert.equal(ownerSql.includes("is_admin()"), false);
  const keyedSql = readFileSync(keyed, "utf8");
  assert.match(keyedSql, /DELETE FROM public\.auth_attempts/);
  assert.equal(keyedSql.includes("extensions.digest"), false);
  assert.match(keyedSql, /CREATE OR REPLACE FUNCTION public\.bond_purge_dispensary_accounts/);
  assert.match(keyedSql, /cron\.schedule\(\s*'bond_purge_dispensary_accounts'/);
  assert.match(keyedSql, /RAISE NOTICE 'pg_cron schedule skipped \(%\)\. Enabling pg_cron is a ship-time step for M\.'/);
  assert.match(keyedSql, /GRANT UPDATE \(/);
  const holdSql = readFileSync(hold, "utf8");
  assert.match(holdSql, /DROP POLICY IF EXISTS haus_updates_anon_insert/);
  assert.match(holdSql, /cron\.schedule\(\s*'bond_purge_haus_updates'/);
  assert.match(holdSql, /'45 4 \* \* \*'/);
  assert.match(holdSql, /RAISE NOTICE 'pg_cron schedule skipped \(%\)\. Enabling pg_cron is a ship-time step for M\.'/);
  assert.equal(holdSql.includes("is_admin()"), false);
  const revokeSql = readFileSync(revokeInserts, "utf8");
  assert.match(revokeSql, /REVOKE INSERT ON TABLE public\.dispensary_accounts FROM anon/);
  assert.match(revokeSql, /REVOKE INSERT ON TABLE public\.order_requests FROM anon/);
  assert.match(revokeSql, /REVOKE INSERT ON TABLE public\.haus_requests FROM anon/);
  assert.match(revokeSql, /REVOKE INSERT ON TABLE public\.dispensary_accounts FROM authenticated/);
  assert.match(revokeSql, /DROP POLICY IF EXISTS dispensary_accounts_anon_insert/);
  assert.match(revokeSql, /DROP POLICY IF EXISTS order_requests_anon_insert/);
  assert.match(revokeSql, /DROP POLICY IF EXISTS haus_requests_anon_insert/);
  assert.match(revokeSql, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.dispensary_accounts TO service_role/);
  assert.equal(revokeSql.includes("is_admin()"), false);
  const tokenSql = readFileSync(tokenCleanup, "utf8");
  assert.match(tokenSql, /DELETE FROM public\.haus_update_tokens WHERE email_hmac = p_email_hmac/);
  assert.match(tokenSql, /interval '30 days'/);
  assert.match(tokenSql, /GRANT SELECT, DELETE ON TABLE public\.haus_update_tokens TO bond_retention/);
  assert.equal(/GRANT INSERT ON TABLE public\.haus_update_tokens TO anon/.test(tokenSql), false);
  assert.equal(/GRANT INSERT ON TABLE public\.haus_update_tokens TO authenticated/.test(tokenSql), false);
  assert.equal(tokenSql.includes("is_admin()"), false);
  const expirySql = readFileSync(tokenExpiry, "utf8");
  assert.match(expirySql, /interval '7 days'/);
  assert.match(expirySql, /purpose = 'unsub' AND expires_at IS NULL/);
  assert.match(expirySql, /purpose = 'confirm' AND expires_at IS NOT NULL/);
  assert.equal(/GRANT INSERT ON TABLE public\.haus_update_tokens TO anon/.test(expirySql), false);
  assert.equal(/GRANT INSERT ON TABLE public\.haus_update_tokens TO authenticated/.test(expirySql), false);
  assert.equal(/GRANT INSERT ON TABLE public\.haus_updates TO anon/.test(expirySql), false);
  assert.equal(/GRANT INSERT ON TABLE public\.haus_updates TO authenticated/.test(expirySql), false);
  assert.equal(expirySql.includes("is_admin()"), false);
  const hasSql = readFileSync(hasUpdate, "utf8");
  assert.match(hasSql, /CREATE OR REPLACE FUNCTION public\.bond_has_haus_update\(p_email_hmac text\)/);
  assert.match(hasSql, /SECURITY DEFINER/);
  assert.match(hasSql, /SET search_path TO public, pg_temp/);
  assert.match(hasSql, /REVOKE ALL ON FUNCTION public\.bond_has_haus_update\(text\) FROM PUBLIC/);
  assert.match(hasSql, /REVOKE ALL ON FUNCTION public\.bond_has_haus_update\(text\) FROM anon/);
  assert.match(hasSql, /REVOKE ALL ON FUNCTION public\.bond_has_haus_update\(text\) FROM authenticated/);
  assert.match(hasSql, /GRANT EXECUTE ON FUNCTION public\.bond_has_haus_update\(text\) TO service_role/);
  assert.match(hasSql, /GRANT EXECUTE ON FUNCTION public\.bond_has_haus_update\(text\) TO postgres/);
  assert.equal(/GRANT .* ON TABLE public\.haus_updates/.test(hasSql), false);
  assert.equal(hasSql.includes("is_admin()"), false);
  const reoptSql = readFileSync(reopt, "utf8");
  assert.match(reoptSql, /CREATE OR REPLACE FUNCTION public\.bond_reopt_haus_update\(/);
  assert.match(reoptSql, /SECURITY DEFINER/);
  assert.match(reoptSql, /SET search_path TO public, pg_temp/);
  assert.match(reoptSql, /DELETE FROM public\.haus_updates_suppression WHERE email_hmac = p_email_hmac/);
  assert.match(reoptSql, /'salon'/);
  assert.match(reoptSql, /INSERT INTO public\.audit_log \(action, target, before, after\)/);
  assert.match(reoptSql, /REVOKE ALL ON FUNCTION public\.bond_reopt_haus_update\(text, text\) FROM anon/);
  assert.match(reoptSql, /REVOKE ALL ON FUNCTION public\.bond_reopt_haus_update\(text, text\) FROM authenticated/);
  assert.match(reoptSql, /GRANT EXECUTE ON FUNCTION public\.bond_reopt_haus_update\(text, text\) TO service_role/);
  assert.match(reoptSql, /GRANT EXECUTE ON FUNCTION public\.bond_reopt_haus_update\(text, text\) TO postgres/);
  assert.equal(/GRANT .* ON TABLE public\.haus_updates/.test(reoptSql), false);
  assert.equal(reoptSql.includes("is_admin()"), false);
  const auditLift = reoptSql.match(
    /INSERT INTO public\.audit_log \(action, target, before, after\)[\s\S]*?\);/,
  );
  assert.ok(auditLift);
  assert.equal(auditLift[0].replaceAll("p_email_hmac", "").includes("p_email"), false);
  assert.match(auditLift[0], /p_email_hmac/);
  const bindSql = readFileSync(sessionBind, "utf8");
  assert.match(bindSql, /ADD COLUMN email_hmac text/);
  assert.match(bindSql, /sess\.email_hmac = p_email_hmac/);
  assert.match(bindSql, /REVOKE ALL ON TABLE public\.haus_sessions FROM PUBLIC/);
  assert.match(bindSql, /REVOKE ALL ON TABLE public\.haus_sessions FROM anon/);
  assert.match(bindSql, /REVOKE ALL ON TABLE public\.haus_sessions FROM authenticated/);
  assert.match(bindSql, /REVOKE ALL ON TABLE public\.haus_sessions FROM service_role/);
  assert.match(bindSql, /REVOKE ALL ON TABLE public\.dispensary_sessions FROM PUBLIC/);
  assert.match(bindSql, /REVOKE ALL ON TABLE public\.dispensary_sessions FROM anon/);
  assert.match(bindSql, /REVOKE ALL ON TABLE public\.dispensary_sessions FROM authenticated/);
  assert.match(bindSql, /REVOKE ALL ON TABLE public\.dispensary_sessions FROM service_role/);
  assert.match(bindSql, /GRANT SELECT, INSERT, DELETE ON TABLE public\.haus_sessions TO service_role/);
  assert.match(bindSql, /GRANT SELECT, INSERT, DELETE ON TABLE public\.dispensary_sessions TO service_role/);
  assert.equal(/GRANT UPDATE ON TABLE public\.haus_sessions/.test(bindSql), false);
  assert.equal(/GRANT UPDATE ON TABLE public\.dispensary_sessions/.test(bindSql), false);
  assert.equal(/GRANT .* ON TABLE public\.haus_sessions TO anon/.test(bindSql), false);
  assert.equal(/GRANT .* ON TABLE public\.haus_sessions TO authenticated/.test(bindSql), false);
  assert.equal(/GRANT .* ON TABLE public\.dispensary_sessions TO anon/.test(bindSql), false);
  assert.equal(/GRANT .* ON TABLE public\.dispensary_sessions TO authenticated/.test(bindSql), false);
  const purgeSql = readFileSync(sessionPurge, "utf8");
  assert.match(purgeSql, /ALTER FUNCTION public\.bond_purge_expired_sessions\(\) OWNER TO bond_retention/);
  assert.equal(purgeSql.split("SET search_path TO public, pg_temp").length - 1, 2);
  assert.match(purgeSql, /REVOKE ALL ON FUNCTION public\.bond_delete_expired_sessions\(\) FROM PUBLIC/);
  assert.match(purgeSql, /REVOKE ALL ON FUNCTION public\.bond_delete_expired_sessions\(\) FROM anon/);
  assert.match(purgeSql, /REVOKE ALL ON FUNCTION public\.bond_delete_expired_sessions\(\) FROM authenticated/);
  assert.match(purgeSql, /REVOKE ALL ON FUNCTION public\.bond_delete_expired_sessions\(\) FROM service_role/);
  assert.match(purgeSql, /GRANT EXECUTE ON FUNCTION public\.bond_delete_expired_sessions\(\) TO bond_retention/);
  assert.match(purgeSql, /REVOKE ALL ON FUNCTION public\.bond_purge_expired_sessions\(\) FROM PUBLIC/);
  assert.match(purgeSql, /REVOKE ALL ON FUNCTION public\.bond_purge_expired_sessions\(\) FROM anon/);
  assert.match(purgeSql, /REVOKE ALL ON FUNCTION public\.bond_purge_expired_sessions\(\) FROM authenticated/);
  assert.match(purgeSql, /REVOKE ALL ON FUNCTION public\.bond_purge_expired_sessions\(\) FROM service_role/);
  assert.match(purgeSql, /GRANT EXECUTE ON FUNCTION public\.bond_purge_expired_sessions\(\) TO postgres/);
  assert.match(purgeSql, /REVOKE ALL ON TABLE public\.haus_sessions FROM bond_retention/);
  assert.match(purgeSql, /REVOKE ALL ON TABLE public\.dispensary_sessions FROM bond_retention/);
  assert.match(purgeSql, /'50 4 \* \* \*'/);
  assert.match(purgeSql, /expires_at <= now\(\)/);
  assert.equal(purgeSql.includes("GRANT SELECT"), false);
  assert.equal(purgeSql.includes("GRANT INSERT"), false);
  assert.equal(purgeSql.includes("GRANT UPDATE"), false);
  assert.equal(purgeSql.includes("GRANT DELETE"), false);

  const database = `bond_signup_rls_${process.pid}_${Date.now()}`;
  try {
  const dir = mkdtempSync(join(tmpdir(), "bond-signup-rls-"));
  chmodSync(dir, 0o755);
  const setup = join(dir, "setup.sql");
  const probe = join(dir, "probe.sql");
  writeFileSync(
    setup,
    `
DROP DATABASE IF EXISTS ${database};
CREATE DATABASE ${database};
`,
  );
  chmodSync(setup, 0o644);
  const created = spawnSync("sudo", ["-n", "-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-f", setup], {
    encoding: "utf8",
  });
  assert.equal(created.status, 0, created.stderr);

  writeFileSync(
    probe,
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

\\i ${migration}

INSERT INTO public.auth_attempts (email_hash, ip, outcome)
VALUES ('plain-ip-row', '203.0.113.9', 'fail');

\\i ${felix}

SELECT (ip_hash = encode(extensions.digest('203.0.113.9', 'sha256'), 'hex')) AS ip_was_hashed
FROM public.auth_attempts WHERE email_hash = 'plain-ip-row';

\\i ${ownerOnly}

\\i ${keyed}

\\i ${updates}

\\i ${hold}

\\i ${revokeInserts}

\\i ${tokenCleanup}

\\i ${tokenExpiry}

\\i ${hasUpdate}

\\i ${reopt}

\\i ${sessionBind}

\\i ${sessionPurge}

SELECT COUNT(*) AS legacy_attempts_left FROM public.auth_attempts WHERE email_hash = 'plain-ip-row';
SELECT COUNT(*) AS legacy_raw_ip_left FROM public.auth_attempts WHERE ip_hash = '203.0.113.9';

GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated;

INSERT INTO public.dispensary_accounts (
  dispensary_name, address, contact_name, phone, ocm_license, email,
  password_hash, password_salt, age21_ack_at, status
) VALUES (
  'Harbor House', '18 Harbor Street, Albany, NY 12207', 'Harbor Buyer', '518-555-0199',
  'OCM-HARBOR-19', 'harbor.buyer@example.test', 'scrypt-hash', 'scrypt-salt', now(), 'pending'
);

INSERT INTO public.dispensary_accounts (
  dispensary_name, address, contact_name, phone, ocm_license, email,
  password_hash, password_salt, age21_ack_at, status, created_at, last_active_at
) VALUES (
  'North House', '1 North Street, Albany, NY 12207', 'North Buyer', '518-555-0101',
  'OCM-NORTH-19', 'north.buyer@example.test', 'scrypt-hash', 'scrypt-salt', now(), 'pending',
  now() - interval '30 months', now() - interval '30 months'
);
UPDATE public.dispensary_accounts
SET status = 'approved'
WHERE email = 'north.buyer@example.test';

INSERT INTO public.dispensary_accounts (
  dispensary_name, address, contact_name, phone, ocm_license, email,
  password_hash, password_salt, age21_ack_at, status, created_at, last_active_at, closed_at
) VALUES (
  'Closed House', '2 Closed Street, Albany, NY 12207', 'Closed Buyer', '518-555-0102',
  'OCM-CLOSED-19', 'closed.buyer@example.test', 'scrypt-hash', 'scrypt-salt', now(), 'pending',
  now() - interval '30 months', now() - interval '30 months', now() - interval '30 months'
);
UPDATE public.dispensary_accounts
SET status = 'rejected'
WHERE email = 'closed.buyer@example.test';

SET ROLE service_role;
INSERT INTO public.haus_requests (email, age21_ack, age21_ack_at, requested_dispensary)
VALUES ('member@bond.test', true, now(), 'Harbor House');
RESET ROLE;

INSERT INTO public.haus_requests (email, age21_ack, age21_ack_at, requested_dispensary, created_at)
VALUES
  ('old@bond.test', true, now() - interval '25 months', 'Old House', now() - interval '25 months'),
  ('new@bond.test', true, now(), 'New House', now()),
  ('other@bond.test', true, now(), 'Other House', now());

INSERT INTO public.order_requests (dispensary_account_id, lines, promised_on, notes, created_at)
SELECT id, '[{"skuId":"no-1","format":"1g","qty":1}]'::jsonb, '2026-11-02', 'Dock note', now() - interval '25 months'
FROM public.dispensary_accounts WHERE email = 'north.buyer@example.test';
INSERT INTO public.order_requests (dispensary_account_id, lines, promised_on, notes, created_at)
SELECT id, '[{"skuId":"no-2","format":"1g","qty":1}]'::jsonb, '2026-12-02', 'Dock note', now()
FROM public.dispensary_accounts WHERE email = 'north.buyer@example.test';

INSERT INTO public.auth_attempts (email_hash, ip_hash, outcome, attempted_at)
VALUES ('old-attempt', repeat('ab', 32), 'fail', now() - interval '91 days');

INSERT INTO public.audit_log (action, at) VALUES
  ('old.action', now() - interval '25 months'),
  ('kept.action', now());

SELECT status AS still_pending FROM public.dispensary_accounts WHERE email = 'harbor.buyer@example.test';
SELECT COUNT(*) AS haus_kept FROM public.haus_requests WHERE email = 'member@bond.test';

INSERT INTO public.auth_attempts (email_hash, ip_hash, outcome, attempted_at)
VALUES ('plain-ip-row', repeat('cd', 32), 'fail', now());

SELECT ((public.record_auth_attempt('ops@bond.test', '203.0.113.9', 'fail') ->> 'locked') = 'true') AS raw_locked;
SELECT COUNT(*) AS raw_stored
FROM public.auth_attempts
WHERE email_hash = 'ops@bond.test' OR ip_hash = '203.0.113.9' OR email_hash LIKE '%@%';

SELECT COUNT(*) AS hmac_lock_hits
FROM (
  SELECT public.record_auth_attempt(repeat('ef', 32), repeat('11', 32), 'fail') AS result
  FROM generate_series(1, 5)
) calls
WHERE calls.result ->> 'locked' = 'true';

SELECT COUNT(*) AS banned_columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('haus_requests', 'order_requests', 'dispensary_accounts')
  AND column_name ~* '(payment|hold|allocation|reservation|dob|birth|age_gate)';

SELECT COUNT(*) AS haus_table FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'haus_requests';
SELECT COUNT(*) AS old_haus_table FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'haus_signups';

INSERT INTO public.admins (user_id, role, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'operator', 'active');

SELECT set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
SELECT set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","email":"stranger@example.test"}', false);
SET ROLE authenticated;
SELECT COUNT(*) AS stranger_seen FROM public.dispensary_accounts;
SELECT COUNT(*) AS stranger_haus FROM public.haus_requests;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"ops@bond.test"}', false);
SET ROLE authenticated;
SELECT COUNT(*) AS operator_seen FROM public.dispensary_accounts;
SELECT COUNT(*) AS operator_haus FROM public.haus_requests;
SELECT COUNT(*) AS operator_requests FROM public.order_requests;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
SELECT set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","email":"member@bond.test"}', false);
SET ROLE authenticated;
SELECT COUNT(*) AS member_own FROM public.haus_requests WHERE email = 'member@bond.test';
SELECT COUNT(*) AS member_other FROM public.haus_requests WHERE email <> 'member@bond.test';
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"owner@bond.test"}', false);
SET ROLE authenticated;
SELECT COUNT(*) AS owner_seen FROM public.dispensary_accounts;
SELECT COUNT(*) AS owner_haus FROM public.haus_requests;
RESET ROLE;

SELECT (position('is_owner' in pg_get_expr(p.polqual, p.polrelid)) > 0) AS haus_policy_owner
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname = 'haus_requests' AND p.polname = 'haus_requests_member_or_owner_select';

SELECT COUNT(*) AS haus_policy_admin
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname = 'haus_requests'
  AND pg_get_expr(p.polqual, p.polrelid) LIKE '%is_admin%';

SELECT public.bond_purge_haus_requests() AS haus_purged;
SELECT public.bond_purge_order_requests() AS orders_purged;
SELECT public.bond_purge_auth_attempts() AS attempts_purged;
SELECT public.bond_purge_audit_log() AS audit_purged;
SELECT public.bond_purge_dispensary_accounts() AS accounts_purged;

SELECT COUNT(*) AS haus_old_left FROM public.haus_requests WHERE email = 'old@bond.test';
SELECT COUNT(*) AS haus_new_left FROM public.haus_requests WHERE email = 'new@bond.test';
SELECT COUNT(*) AS orders_old_left FROM public.order_requests WHERE promised_on = '2026-11-02';
SELECT COUNT(*) AS orders_new_left FROM public.order_requests WHERE promised_on = '2026-12-02';
SELECT COUNT(*) AS attempts_old_left FROM public.auth_attempts WHERE email_hash = 'old-attempt';
SELECT COUNT(*) AS attempts_plain_left FROM public.auth_attempts WHERE email_hash = 'plain-ip-row';
SELECT COUNT(*) AS audit_old_left FROM public.audit_log WHERE action = 'old.action';
SELECT COUNT(*) AS audit_new_left FROM public.audit_log WHERE action = 'kept.action';
SELECT dispensary_name AS north_name FROM public.dispensary_accounts WHERE ocm_license = 'OCM-NORTH-19';
SELECT ocm_license AS north_license FROM public.dispensary_accounts WHERE dispensary_name = 'North House';
SELECT (
  contact_name = '' AND phone = '' AND address = '' AND password_hash = '' AND password_salt = ''
  AND email LIKE '%@redacted.invalid' AND position('north.buyer' in email) = 0
) AS north_cleared
FROM public.dispensary_accounts WHERE ocm_license = 'OCM-NORTH-19';
SELECT (
  dispensary_name = 'Closed House' AND ocm_license = 'OCM-CLOSED-19'
  AND contact_name = '' AND email LIKE '%@redacted.invalid' AND position('closed.buyer' in email) = 0
) AS closed_cleared
FROM public.dispensary_accounts WHERE ocm_license = 'OCM-CLOSED-19';
SELECT (
  email = 'harbor.buyer@example.test' AND contact_name = 'Harbor Buyer'
  AND address = '18 Harbor Street, Albany, NY 12207' AND password_hash = 'scrypt-hash'
) AS harbor_kept
FROM public.dispensary_accounts WHERE ocm_license = 'OCM-HARBOR-19';

SELECT public.bond_record_haus_update('Reader@bond.test', 'haus_door', repeat('ef', 32)) AS reader_recorded;
SELECT public.bond_record_haus_update('reader@bond.test', 'haus_door', repeat('ef', 32)) AS reader_again;
SELECT COUNT(*) AS reader_once FROM public.haus_updates WHERE email = 'reader@bond.test';
SELECT (confirmed_at IS NULL) AS reader_open FROM public.haus_updates WHERE email = 'reader@bond.test';
SELECT (email_hmac = repeat('ef', 32)) AS reader_hmac FROM public.haus_updates WHERE email = 'reader@bond.test';

SELECT public.bond_record_haus_update('stamp@bond.test', 'haus_door', repeat('11', 32)) AS stamp_recorded;
SELECT (confirmed_at IS NULL) AS stamp_open FROM public.haus_updates WHERE email = 'stamp@bond.test';

SELECT public.bond_record_haus_update('fresh@bond.test', 'haus_door', repeat('cd', 32)) AS fresh_recorded;
SELECT public.bond_record_haus_update('fresh@bond.test', 'haus_door', repeat('cd', 32)) AS fresh_again;
SELECT COUNT(*) AS fresh_once FROM public.haus_updates WHERE email = 'fresh@bond.test';
SELECT (confirmed_at IS NULL) AS fresh_unconfirmed FROM public.haus_updates WHERE email = 'fresh@bond.test';

SELECT public.bond_record_haus_update('gone@bond.test', 'haus_door', repeat('ab', 32)) AS gone_recorded;
SELECT public.bond_issue_haus_update_token(repeat('ab', 32), 'unsub') IS NOT NULL AS gone_unsub_token;
SELECT public.bond_issue_haus_update_token(repeat('ab', 32), 'confirm') IS NOT NULL AS gone_confirm_token;
SELECT public.bond_unsubscribe_haus_update(repeat('ab', 32)) AS gone_unsubscribed;
SELECT COUNT(*) AS gone_left FROM public.haus_updates WHERE email = 'gone@bond.test';
SELECT COUNT(*) AS gone_tokens_left FROM public.haus_update_tokens WHERE email_hmac = repeat('ab', 32);
SELECT public.bond_record_haus_update('gone@bond.test', 'haus_door', repeat('ab', 32)) AS suppressed_rejected;
SELECT COUNT(*) AS suppressed_absent FROM public.haus_updates WHERE email = 'gone@bond.test';

SELECT public.bond_unsubscribe_haus_update(repeat('ef', 32)) AS reader_unsubscribed;
SELECT COUNT(*) AS reader_left FROM public.haus_updates WHERE email = 'reader@bond.test';
SELECT COUNT(*) AS reader_suppressed FROM public.haus_updates_suppression WHERE email_hmac = repeat('ef', 32);
SELECT public.bond_record_haus_update('reader@bond.test', 'haus_door', repeat('ef', 32)) AS reader_readd;

SELECT public.bond_record_haus_update('aged@bond.test', 'haus_door', repeat('aa', 32)) AS aged_recorded;
UPDATE public.haus_updates
SET consent_at = now() - interval '25 months'
WHERE email = 'aged@bond.test';
SELECT public.bond_issue_haus_update_token(repeat('aa', 32), 'unsub') IS NOT NULL AS aged_token_issued;
SELECT public.bond_issue_haus_update_token(repeat('cd', 32), 'unsub') IS NOT NULL AS fresh_token_issued;
SELECT public.bond_issue_haus_update_token(repeat('ee', 32), 'unsub') IS NOT NULL AS old_orphan_issued;
UPDATE public.haus_update_tokens
SET created_at = now() - interval '31 days'
WHERE email_hmac = repeat('ee', 32);
SELECT public.bond_issue_haus_update_token(repeat('ff', 32), 'confirm') IS NOT NULL AS young_orphan_issued;
SELECT public.bond_record_haus_update('keptconfirm@bond.test', 'haus_door', repeat('bb', 32)) AS kept_recorded;
UPDATE public.haus_updates
SET consent_at = now() - interval '25 months', confirmed_at = now()
WHERE email = 'keptconfirm@bond.test';
SELECT public.bond_purge_haus_updates() AS updates_purged;
SELECT COUNT(*) AS aged_left FROM public.haus_updates WHERE email = 'aged@bond.test';
SELECT COUNT(*) AS aged_tokens_left FROM public.haus_update_tokens WHERE email_hmac = repeat('aa', 32);
SELECT COUNT(*) AS fresh_tokens_left FROM public.haus_update_tokens WHERE email_hmac = repeat('cd', 32);
SELECT COUNT(*) AS old_orphan_left FROM public.haus_update_tokens WHERE email_hmac = repeat('ee', 32);
SELECT COUNT(*) AS young_orphan_left FROM public.haus_update_tokens WHERE email_hmac = repeat('ff', 32);
SELECT COUNT(*) AS keptconfirm_left FROM public.haus_updates WHERE email = 'keptconfirm@bond.test';
SELECT COUNT(*) AS fresh_after_purge FROM public.haus_updates WHERE email = 'fresh@bond.test';
SELECT COUNT(*) AS suppression_after_purge
FROM public.haus_updates_suppression
WHERE email_hmac IN (repeat('ab', 32), repeat('ef', 32));

SELECT (
  id::text ~ '^[0-9a-f-]{36}$' AND position('@' in id::text) = 0
) AS token_opaque
FROM (
  SELECT public.bond_issue_haus_update_token(repeat('cd', 32), 'unsub') AS id
) issued;
SELECT COUNT(*) AS token_email_cols
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'haus_update_tokens' AND column_name = 'email';
SELECT COUNT(*) AS token_cols
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'haus_update_tokens'
  AND column_name IN ('id', 'email_hmac', 'purpose', 'created_at', 'expires_at');
SELECT COUNT(*) AS token_extra
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'haus_update_tokens'
  AND column_name NOT IN ('id', 'email_hmac', 'purpose', 'created_at', 'expires_at');
SELECT public.bond_issue_haus_update_token(repeat('12', 32), 'confirm') IS NOT NULL AS confirm_issued;
SELECT (
  expires_at > now() + interval '6 days'
  AND expires_at < now() + interval '8 days'
) AS confirm_expires_7
FROM public.haus_update_tokens
WHERE email_hmac = repeat('12', 32) AND purpose = 'confirm';
SELECT (expires_at IS NULL) AS unsub_no_expiry
FROM public.haus_update_tokens
WHERE purpose = 'unsub'
LIMIT 1;

SELECT COUNT(*) AS updates_columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'haus_updates'
  AND column_name IN ('email', 'consent_at', 'source', 'confirmed_at', 'email_hmac');
SELECT COUNT(*) AS updates_extra
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'haus_updates'
  AND column_name NOT IN ('email', 'consent_at', 'source', 'confirmed_at', 'email_hmac');
SELECT COUNT(*) AS suppression_columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'haus_updates_suppression'
  AND column_name IN ('email_hmac', 'created_at');
SELECT COUNT(*) AS suppression_extra
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'haus_updates_suppression'
  AND column_name NOT IN ('email_hmac', 'created_at');

SELECT COUNT(*) AS updates_insert_policy
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname = 'haus_updates' AND p.polcmd = 'a';
SELECT COUNT(*) AS updates_owner_policy
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname = 'haus_updates' AND p.polcmd = 'r'
  AND position('is_owner' in pg_get_expr(p.polqual, p.polrelid)) > 0;
SELECT COUNT(*) AS updates_mutate_policies
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname = 'haus_updates' AND p.polcmd IN ('w', 'd', '*')
  AND NOT EXISTS (
    SELECT 1 FROM pg_roles r
    WHERE r.oid = ANY (p.polroles) AND r.rolname = 'bond_retention'
  );
SELECT COUNT(*) AS updates_retention_delete
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_roles r ON r.oid = ANY (p.polroles)
WHERE c.relname = 'haus_updates' AND p.polcmd = 'd' AND r.rolname = 'bond_retention';
SELECT COUNT(*) AS updates_mutate_grants
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('haus_updates', 'haus_updates_suppression', 'haus_update_tokens')
  AND grantee IN ('anon', 'authenticated', 'service_role')
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"ops@bond.test"}', false);
SET ROLE authenticated;
SELECT COUNT(*) AS operator_updates FROM public.haus_updates;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"owner@bond.test"}', false);
SET ROLE authenticated;
SELECT COUNT(*) AS owner_updates FROM public.haus_updates;
RESET ROLE;
`,
  );

  chmodSync(probe, 0o644);
  const probed = psqlFile(database, probe);
  assert.equal(probed.status, 0, `${probed.stdout}\n${probed.stderr}`);
  const text = probed.stdout;
  const saw = (label: string, value: string) => {
    assert.match(text, new RegExp(`${label}[\\s\\S]{0,80}\\n-+\\n\\s*${value}`), label);
  };
  saw("still_pending", "pending");
  saw("haus_kept", "1");
  saw("ip_was_hashed", "t");
  saw("banned_columns", "0");
  saw("haus_table", "1");
  saw("old_haus_table", "0");
  saw("stranger_seen", "0");
  saw("stranger_haus", "0");
  saw("operator_seen", "0");
  saw("operator_haus", "0");
  saw("operator_requests", "0");
  saw("member_own", "1");
  saw("member_other", "0");
  saw("owner_seen", "3");
  saw("legacy_attempts_left", "0");
  saw("legacy_raw_ip_left", "0");
  saw("raw_locked", "t");
  saw("raw_stored", "0");
  saw("hmac_lock_hits", "1");
  saw("owner_haus", "4");
  saw("haus_policy_owner", "t");
  saw("haus_policy_admin", "0");
  saw("haus_old_left", "0");
  saw("haus_new_left", "1");
  saw("orders_old_left", "0");
  saw("orders_new_left", "1");
  saw("attempts_old_left", "0");
  saw("attempts_plain_left", "1");
  saw("audit_old_left", "0");
  saw("audit_new_left", "1");
  saw("accounts_purged", "2");
  saw("north_name", "North House");
  saw("north_license", "OCM-NORTH-19");
  saw("north_cleared", "t");
  saw("closed_cleared", "t");
  saw("harbor_kept", "t");
  saw("reader_recorded", "t");
  saw("reader_again", "t");
  saw("reader_once", "1");
  saw("reader_open", "t");
  saw("reader_hmac", "t");
  saw("stamp_open", "t");
  saw("fresh_recorded", "t");
  saw("fresh_again", "t");
  saw("fresh_once", "1");
  saw("fresh_unconfirmed", "t");
  saw("gone_recorded", "t");
  saw("gone_unsub_token", "t");
  saw("gone_confirm_token", "t");
  saw("gone_unsubscribed", "t");
  saw("gone_left", "0");
  saw("gone_tokens_left", "0");
  saw("suppressed_rejected", "f");
  saw("suppressed_absent", "0");
  saw("reader_unsubscribed", "t");
  saw("reader_left", "0");
  saw("reader_suppressed", "1");
  saw("reader_readd", "f");
  saw("updates_purged", "1");
  saw("aged_left", "0");
  saw("aged_token_issued", "t");
  saw("fresh_token_issued", "t");
  saw("old_orphan_issued", "t");
  saw("young_orphan_issued", "t");
  saw("aged_tokens_left", "0");
  saw("fresh_tokens_left", "1");
  saw("old_orphan_left", "0");
  saw("young_orphan_left", "1");
  saw("keptconfirm_left", "1");
  saw("fresh_after_purge", "1");
  saw("suppression_after_purge", "2");
  saw("token_opaque", "t");
  saw("token_email_cols", "0");
  saw("token_cols", "5");
  saw("token_extra", "0");
  saw("confirm_issued", "t");
  saw("confirm_expires_7", "t");
  saw("unsub_no_expiry", "t");
  saw("updates_columns", "5");
  saw("updates_extra", "0");
  saw("suppression_columns", "2");
  saw("suppression_extra", "0");
  saw("updates_insert_policy", "0");
  saw("updates_owner_policy", "1");
  saw("updates_mutate_policies", "0");
  saw("updates_retention_delete", "1");
  saw("updates_mutate_grants", "0");
  saw("operator_updates", "0");
  saw("owner_updates", "3");
  console.log("FELIX_REPRO_FUNCTION_READD reader_readd f");

  const denied = psqlSql(
    database,
    `
SET ROLE anon;
INSERT INTO public.dispensary_accounts (
  dispensary_name, address, contact_name, phone, ocm_license, email,
  password_hash, password_salt, age21_ack_at, status
) VALUES (
  'Approved House', '18 Harbor Street, Albany, NY 12207', 'Harbor Buyer', '518-555-0199',
  'OCM-APPROVED-1', 'approved.buyer@example.test', 'scrypt-hash', 'scrypt-salt', now(), 'approved'
);
`,
  );
  assert.notEqual(denied.status, 0, denied.stdout);
  assert.match(`${denied.stderr}\n${denied.stdout}`, /permission denied/i);
  console.log("ANON_DISPENSARY_INSERT", denied.stderr.trim());

  const badHaus = psqlSql(
    database,
    `
SET ROLE anon;
INSERT INTO public.haus_requests (email, age21_ack, age21_ack_at, requested_dispensary)
VALUES ('young@bond.test', false, now(), 'Harbor House');
`,
  );
  assert.notEqual(badHaus.status, 0, badHaus.stdout);
  assert.match(`${badHaus.stderr}\n${badHaus.stdout}`, /permission denied/i);
  console.log("ANON_HAUS_INSERT", badHaus.stderr.trim());

  for (const sql of [
    "SELECT COUNT(*) FROM public.dispensary_accounts",
    "UPDATE public.dispensary_accounts SET status = 'approved'",
    "DELETE FROM public.dispensary_accounts",
    "SELECT COUNT(*) FROM public.haus_requests",
    "UPDATE public.haus_requests SET email = 'nope@bond.test'",
    "DELETE FROM public.haus_requests",
    "SELECT COUNT(*) FROM public.order_requests",
    "SELECT COUNT(*) FROM public.haus_updates",
    "UPDATE public.haus_updates SET source = 'nope'",
    "DELETE FROM public.haus_updates",
    "SELECT COUNT(*) FROM public.haus_updates_suppression",
    "INSERT INTO public.haus_updates_suppression (email_hmac) VALUES (repeat('11', 32))",
    "INSERT INTO public.haus_updates (email, source, email_hmac) VALUES ('reader@bond.test', 'haus_door', repeat('ef', 32))",
    "INSERT INTO public.haus_updates (email, source) VALUES ('third.party@example.test', 'haus_door')",
    "SELECT public.bond_record_haus_update('blocked@bond.test', 'haus_door', repeat('22', 32))",
    "SELECT public.bond_unsubscribe_haus_update(repeat('22', 32))",
    "SELECT public.bond_confirm_haus_update(repeat('22', 32))",
    "SELECT public.bond_issue_haus_update_token(repeat('22', 32), 'unsub')",
    "SELECT public.bond_purge_haus_updates()",
  ]) {
    const blocked = psqlSql(database, `SET ROLE anon; ${sql};`);
    assert.notEqual(blocked.status, 0, sql);
    assert.match(`${blocked.stderr}\n${blocked.stdout}`, /permission denied/i, sql);
  }

  for (const sql of [
    "DELETE FROM public.audit_log WHERE action = 'kept.action'",
    "UPDATE public.audit_log SET action = 'changed' WHERE action = 'kept.action'",
    "DELETE FROM public.haus_requests WHERE email = 'new@bond.test'",
    "DELETE FROM public.auth_attempts WHERE email_hash = 'plain-ip-row'",
    "DELETE FROM public.haus_updates WHERE email = 'stamp@bond.test'",
  ]) {
    const blocked = psqlSql(database, sql);
    assert.notEqual(blocked.status, 0, sql);
    assert.match(`${blocked.stderr}\n${blocked.stdout}`, /append only|retention deletes are limited/i, sql);
  }

  const operatorUpdate = psqlSql(
    database,
    `
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"ops@bond.test"}', false);
SET ROLE authenticated;
UPDATE public.haus_updates SET source = 'nope';
`,
  );
  assert.notEqual(operatorUpdate.status, 0, operatorUpdate.stdout);
  assert.match(`${operatorUpdate.stderr}\n${operatorUpdate.stdout}`, /permission denied/i);

  const operatorDelete = psqlSql(
    database,
    `
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"ops@bond.test"}', false);
SET ROLE authenticated;
DELETE FROM public.haus_updates;
`,
  );
  assert.notEqual(operatorDelete.status, 0, operatorDelete.stdout);
  assert.match(`${operatorDelete.stderr}\n${operatorDelete.stdout}`, /permission denied/i);

  const felixAnonSuppressed = psqlSql(
    database,
    "SET ROLE anon; INSERT INTO public.haus_updates (email, source, email_hmac) VALUES ('reader@bond.test', 'haus_door', repeat('ef', 32));",
  );
  console.log("FELIX_REPRO_ANON_SUPPRESSED", felixAnonSuppressed.stderr.trim());
  assert.notEqual(felixAnonSuppressed.status, 0);
  assert.match(felixAnonSuppressed.stderr, /permission denied/i);

  const felixAnonThird = psqlSql(
    database,
    "SET ROLE anon; INSERT INTO public.haus_updates (email, source) VALUES ('third.party@example.test', 'haus_door');",
  );
  console.log("FELIX_REPRO_ANON_THIRD", felixAnonThird.stderr.trim());
  assert.notEqual(felixAnonThird.status, 0);
  assert.match(felixAnonThird.stderr, /permission denied/i);

  const felixAnonSuppression = psqlSql(
    database,
    "SET ROLE anon; INSERT INTO public.haus_updates_suppression (email_hmac) VALUES (repeat('11', 32));",
  );
  console.log("FELIX_REPRO_ANON_SUPPRESSION", felixAnonSuppression.stderr.trim());
  assert.notEqual(felixAnonSuppression.status, 0);
  assert.match(felixAnonSuppression.stderr, /permission denied/i);

  const felixService = psqlSql(
    database,
    `
BEGIN;
GRANT INSERT ON TABLE public.haus_updates TO service_role;
SET ROLE service_role;
INSERT INTO public.haus_updates (email, source, email_hmac)
VALUES ('third.party@example.test', 'haus_door', repeat('99', 32));
COMMIT;
`,
  );
  console.log("FELIX_REPRO_SERVICE_ROLE_INSERT", felixService.stderr.trim());
  assert.notEqual(felixService.status, 0);
  assert.match(`${felixService.stderr}\n${felixService.stdout}`, /haus_updates writes go through bond_record_haus_update/);

  const felixServiceSuppressed = psqlSql(
    database,
    `
BEGIN;
GRANT INSERT ON TABLE public.haus_updates TO service_role;
SET ROLE service_role;
SELECT set_config('bond.haus_update_via_function', '1', true);
INSERT INTO public.haus_updates (email, source, email_hmac)
VALUES ('reader@bond.test', 'haus_door', repeat('ef', 32));
COMMIT;
`,
  );
  console.log("FELIX_REPRO_SERVICE_ROLE_SUPPRESSED", felixServiceSuppressed.stderr.trim());
  assert.notEqual(felixServiceSuppressed.status, 0);
  assert.match(`${felixServiceSuppressed.stderr}\n${felixServiceSuppressed.stdout}`, /haus_updates address is suppressed/);

  const anonOrder = psqlSql(
    database,
    `
SET ROLE anon;
INSERT INTO public.order_requests (dispensary_account_id, lines, promised_on, notes)
VALUES ('11111111-1111-1111-1111-111111111111', '[{"skuId":"no-1","format":"1g","qty":1}]'::jsonb, '2026-12-20', 'Dock note');
`,
  );
  console.log("ANON_ORDER_INSERT", anonOrder.stderr.trim());
  assert.notEqual(anonOrder.status, 0);
  assert.match(anonOrder.stderr, /permission denied/i);

  const authInserts = psqlSql(
    database,
    `
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"ops@bond.test"}', false);
SET ROLE authenticated;
INSERT INTO public.dispensary_accounts (
  dispensary_name, address, contact_name, phone, ocm_license, email,
  password_hash, password_salt, age21_ack_at, status
) VALUES (
  'Operator House', '18 Harbor Street, Albany, NY 12207', 'Ops Buyer', '518-555-0199',
  'OCM-OPS-19', 'ops.buyer@example.test', 'scrypt-hash', 'scrypt-salt', now(), 'pending'
);
`,
  );
  console.log("AUTH_NON_OWNER_DISPENSARY_INSERT", authInserts.stderr.trim());
  assert.notEqual(authInserts.status, 0);
  assert.match(authInserts.stderr, /permission denied/i);

  const authOrder = psqlSql(
    database,
    `
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"ops@bond.test"}', false);
SET ROLE authenticated;
INSERT INTO public.order_requests (dispensary_account_id, lines, promised_on, notes)
VALUES ('11111111-1111-1111-1111-111111111111', '[{"skuId":"no-1","format":"1g","qty":1}]'::jsonb, '2026-12-20', 'Dock note');
`,
  );
  console.log("AUTH_NON_OWNER_ORDER_INSERT", authOrder.stderr.trim());
  assert.notEqual(authOrder.status, 0);
  assert.match(authOrder.stderr, /permission denied/i);

  const authHaus = psqlSql(
    database,
    `
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"ops@bond.test"}', false);
SET ROLE authenticated;
INSERT INTO public.haus_requests (email, age21_ack, age21_ack_at, requested_dispensary)
VALUES ('ops@bond.test', true, now(), 'Harbor House');
`,
  );
  console.log("AUTH_NON_OWNER_HAUS_INSERT", authHaus.stderr.trim());
  assert.notEqual(authHaus.status, 0);
  assert.match(authHaus.stderr, /permission denied/i);

  const serviceWrites = psqlSql(
    database,
    `
SET ROLE service_role;
INSERT INTO public.dispensary_accounts (
  dispensary_name, address, contact_name, phone, ocm_license, email,
  password_hash, password_salt, age21_ack_at, status
) VALUES (
  'Service House', '18 Harbor Street, Albany, NY 12207', 'Service Buyer', '518-555-0198',
  'OCM-SERVICE-19', 'service.buyer@example.test', 'scrypt-hash', 'scrypt-salt', now(), 'pending'
);
INSERT INTO public.order_requests (dispensary_account_id, lines, promised_on, notes)
SELECT id, '[{"skuId":"no-1","format":"1g","qty":1}]'::jsonb, '2026-12-20', 'Dock note'
FROM public.dispensary_accounts WHERE ocm_license = 'OCM-SERVICE-19';
INSERT INTO public.haus_requests (email, age21_ack, age21_ack_at, requested_dispensary)
VALUES ('service.member@bond.test', true, now(), 'Service House');
RESET ROLE;
SELECT status AS service_dispensary FROM public.dispensary_accounts WHERE email = 'service.buyer@example.test';
SELECT COUNT(*) AS service_order FROM public.order_requests r
JOIN public.dispensary_accounts a ON a.id = r.dispensary_account_id
WHERE a.ocm_license = 'OCM-SERVICE-19';
SELECT COUNT(*) AS service_haus FROM public.haus_requests WHERE email = 'service.member@bond.test';
`,
  );
  console.log("SERVICE_ROLE_WRITES", serviceWrites.stdout.trim());
  if (serviceWrites.status !== 0) console.log("SERVICE_ROLE_WRITES_ERR", serviceWrites.stderr.trim());
  assert.equal(serviceWrites.status, 0, `${serviceWrites.stdout}\n${serviceWrites.stderr}`);
  assert.match(serviceWrites.stdout, /service_dispensary[\s\S]{0,80}\n-+\n\s*pending/);
  assert.match(serviceWrites.stdout, /service_order[\s\S]{0,80}\n-+\n\s*1/);
  assert.match(serviceWrites.stdout, /service_haus[\s\S]{0,80}\n-+\n\s*1/);

  const after = psqlSql(
    database,
    "SELECT status FROM public.dispensary_accounts WHERE email = 'harbor.buyer@example.test'",
  );
  assert.equal(after.status, 0, after.stderr);
  assert.match(after.stdout, /pending/);

  const prepared = psqlSql(
    database,
    `
INSERT INTO public.haus_requests (email, age21_ack, age21_ack_at, requested_dispensary)
VALUES ('listed@bond.test', true, now(), 'Harbor House');
INSERT INTO public.haus_sessions (email, email_hmac, expires_at)
VALUES ('listed@bond.test', repeat('d4', 32), now() + interval '1 day');
SELECT public.bond_record_haus_update('listed@bond.test', 'haus_page', repeat('d4', 32)) AS listed_recorded;
UPDATE public.haus_updates SET consent_at = now() - interval '2 days' WHERE email = 'listed@bond.test';
SELECT public.bond_issue_haus_update_token(repeat('d4', 32), 'unsub') AS unsub_token;
SELECT public.bond_issue_haus_update_token(repeat('d4', 32), 'confirm') AS confirm_token;
SELECT count(*) AS rows_before FROM public.haus_updates WHERE email_hmac = repeat('d4', 32);
SELECT count(*) AS tokens_before FROM public.haus_update_tokens WHERE email_hmac = repeat('d4', 32);
SELECT consent_at AS old_consent FROM public.haus_updates WHERE email = 'listed@bond.test';
SELECT has_table_privilege('service_role', 'public.haus_updates', 'SELECT') AS service_table_select;
SELECT prosecdef AS definer, proconfig::text AS config
FROM pg_proc WHERE proname = 'bond_has_haus_update';
SELECT proconfig::text AS reopt_config FROM pg_proc WHERE proname = 'bond_reopt_haus_update';
`,
  );
  console.log("SALON_PREP", prepared.stdout.trim());
  if (prepared.status !== 0) console.log("SALON_PREP_ERR", prepared.stderr.trim());
  assert.equal(prepared.status, 0, `${prepared.stdout}\n${prepared.stderr}`);
  assert.match(prepared.stdout, /rows_before[\s\S]{0,40}\n-+\n\s*1/);
  assert.match(prepared.stdout, /tokens_before[\s\S]{0,40}\n-+\n\s*2/);
  assert.match(prepared.stdout, /service_table_select[\s\S]{0,40}\n-+\n\s*f/);
  assert.match(prepared.stdout, /search_path=public, pg_temp/);
  assert.match(prepared.stdout, /reopt_config[\s\S]*search_path=public, pg_temp/);

  const serviceUntick = psqlSql(
    database,
    `
SET ROLE service_role;
SELECT public.bond_has_haus_update(repeat('d4', 32)) AS box_on;
SELECT public.bond_unsubscribe_haus_update(repeat('d4', 32)) AS untick;
`,
  );
  console.log("SERVICE_UNTICK", serviceUntick.stdout.trim());
  if (serviceUntick.status !== 0) console.log("SERVICE_UNTICK_ERR", serviceUntick.stderr.trim());
  assert.equal(serviceUntick.status, 0, `${serviceUntick.stdout}\n${serviceUntick.stderr}`);
  assert.match(serviceUntick.stdout, /box_on[\s\S]{0,40}\n-+\n\s*t/);
  assert.match(serviceUntick.stdout, /untick[\s\S]{0,40}\n-+\n\s*t/);

  const afterUntick = psqlSql(
    database,
    `
SELECT count(*) AS rows_off FROM public.haus_updates WHERE email_hmac = repeat('d4', 32);
SELECT count(*) AS tokens_off FROM public.haus_update_tokens WHERE email_hmac = repeat('d4', 32);
SELECT count(*) AS suppressed_on FROM public.haus_updates_suppression WHERE email_hmac = repeat('d4', 32);
`,
  );
  assert.equal(afterUntick.status, 0, `${afterUntick.stdout}\n${afterUntick.stderr}`);
  assert.match(afterUntick.stdout, /rows_off[\s\S]{0,40}\n-+\n\s*0/);
  assert.match(afterUntick.stdout, /tokens_off[\s\S]{0,40}\n-+\n\s*0/);
  assert.match(afterUntick.stdout, /suppressed_on[\s\S]{0,40}\n-+\n\s*1/);

  const serviceRetick = psqlSql(
    database,
    `
SET ROLE service_role;
SELECT public.bond_reopt_haus_update('listed@bond.test', repeat('d4', 32)) AS retick;
`,
  );
  console.log("SERVICE_RETICK", serviceRetick.stdout.trim());
  if (serviceRetick.status !== 0) console.log("SERVICE_RETICK_ERR", serviceRetick.stderr.trim());
  assert.equal(serviceRetick.status, 0, `${serviceRetick.stdout}\n${serviceRetick.stderr}`);
  assert.match(serviceRetick.stdout, /retick[\s\S]{0,40}\n-+\n\s*t/);

  const afterRetick = psqlSql(
    database,
    `
SELECT count(*) AS suppressed_off FROM public.haus_updates_suppression WHERE email_hmac = repeat('d4', 32);
SELECT source AS retick_source FROM public.haus_updates WHERE email = 'listed@bond.test';
SELECT (consent_at > now() - interval '1 day') AS new_consent FROM public.haus_updates WHERE email = 'listed@bond.test';
SELECT (target = repeat('d4', 32)) AS audit_hmac FROM public.audit_log WHERE action = 'haus_updates.reopt';
SELECT (position('listed@bond.test' in coalesce(action, '') || coalesce(target, '') || coalesce(before::text, '') || coalesce(after::text, '') || coalesce(ip, '') || coalesce(path, '') || coalesce(user_agent, '')) = 0) AS audit_no_email
FROM public.audit_log WHERE action = 'haus_updates.reopt';
`,
  );
  console.log("AFTER_RETICK", afterRetick.stdout.trim());
  if (afterRetick.status !== 0) console.log("AFTER_RETICK_ERR", afterRetick.stderr.trim());
  assert.equal(afterRetick.status, 0, `${afterRetick.stdout}\n${afterRetick.stderr}`);
  assert.match(afterRetick.stdout, /suppressed_off[\s\S]{0,40}\n-+\n\s*0/);
  assert.match(afterRetick.stdout, /salon/);
  assert.match(afterRetick.stdout, /new_consent[\s\S]{0,40}\n-+\n\s*t/);
  assert.match(afterRetick.stdout, /audit_hmac[\s\S]{0,80}\n-+\n\s*t/);
  assert.match(afterRetick.stdout, /audit_no_email[\s\S]{0,40}\n-+\n\s*t/);

  const linkOff = psqlSql(
    database,
    `
SET ROLE service_role;
SELECT public.bond_issue_haus_update_token(repeat('d4', 32), 'unsub') AS link_token;
SELECT public.bond_unsubscribe_haus_update(repeat('d4', 32)) AS link_unsub;
`,
  );
  console.log("LINK_UNSUB", linkOff.stdout.trim());
  if (linkOff.status !== 0) console.log("LINK_UNSUB_ERR", linkOff.stderr.trim());
  assert.equal(linkOff.status, 0, `${linkOff.stdout}\n${linkOff.stderr}`);
  assert.match(linkOff.stdout, /link_unsub[\s\S]{0,40}\n-+\n\s*t/);

  const afterLink = psqlSql(
    database,
    `
SELECT count(*) AS rows_end FROM public.haus_updates WHERE email_hmac = repeat('d4', 32);
SELECT count(*) AS tokens_end FROM public.haus_update_tokens WHERE email_hmac = repeat('d4', 32);
SELECT count(*) AS suppressed_end FROM public.haus_updates_suppression WHERE email_hmac = repeat('d4', 32);
`,
  );
  assert.equal(afterLink.status, 0, `${afterLink.stdout}\n${afterLink.stderr}`);
  assert.match(afterLink.stdout, /rows_end[\s\S]{0,40}\n-+\n\s*0/);
  assert.match(afterLink.stdout, /tokens_end[\s\S]{0,40}\n-+\n\s*0/);
  assert.match(afterLink.stdout, /suppressed_end[\s\S]{0,40}\n-+\n\s*1/);

  const doorBlocked = psqlSql(
    database,
    `
SET ROLE service_role;
SELECT public.bond_record_haus_update('listed@bond.test', 'haus_door', repeat('d4', 32)) AS door_blocked;
`,
  );
  console.log("DOOR_BLOCKED", doorBlocked.stdout.trim());
  if (doorBlocked.status !== 0) console.log("DOOR_BLOCKED_ERR", doorBlocked.stderr.trim());
  assert.equal(doorBlocked.status, 0, `${doorBlocked.stdout}\n${doorBlocked.stderr}`);
  assert.match(doorBlocked.stdout, /door_blocked[\s\S]{0,40}\n-+\n\s*f/);
  const doorStill = psqlSql(
    database,
    "SELECT count(*) AS still_suppressed FROM public.haus_updates_suppression WHERE email_hmac = repeat('d4', 32);",
  );
  assert.equal(doorStill.status, 0, doorStill.stderr);
  assert.match(doorStill.stdout, /still_suppressed[\s\S]{0,40}\n-+\n\s*1/);

  const mismatchPrep = psqlSql(
    database,
    `
SELECT public.bond_record_haus_update('side@bond.test', 'haus_page', repeat('d8', 32)) AS side_recorded;
SELECT public.bond_unsubscribe_haus_update(repeat('d8', 32)) AS side_unsub;
`,
  );
  assert.equal(mismatchPrep.status, 0, `${mismatchPrep.stdout}\n${mismatchPrep.stderr}`);
  const mismatch = psqlSql(
    database,
    `
SET ROLE service_role;
SELECT public.bond_reopt_haus_update('listed@bond.test', repeat('d8', 32)) AS mismatch;
`,
  );
  console.log("MISMATCH", mismatch.stdout.trim());
  if (mismatch.status !== 0) console.log("MISMATCH_ERR", mismatch.stderr.trim());
  assert.equal(mismatch.status, 0, `${mismatch.stdout}\n${mismatch.stderr}`);
  assert.match(mismatch.stdout, /mismatch[\s\S]{0,40}\n-+\n\s*f/);
  const mismatchStays = psqlSql(
    database,
    `
SELECT count(*) AS side_still FROM public.haus_updates_suppression WHERE email_hmac = repeat('d8', 32);
SELECT count(*) AS listed_still_mismatch FROM public.haus_updates_suppression WHERE email_hmac = repeat('d4', 32);
SELECT count(*) AS listed_rows_mismatch FROM public.haus_updates WHERE email = 'listed@bond.test';
`,
  );
  assert.equal(mismatchStays.status, 0, `${mismatchStays.stdout}\n${mismatchStays.stderr}`);
  assert.match(mismatchStays.stdout, /side_still[\s\S]{0,40}\n-+\n\s*1/);
  assert.match(mismatchStays.stdout, /listed_still_mismatch[\s\S]{0,40}\n-+\n\s*1/);
  assert.match(mismatchStays.stdout, /listed_rows_mismatch[\s\S]{0,40}\n-+\n\s*0/);

  const otherSession = psqlSql(
    database,
    `
DELETE FROM public.haus_sessions WHERE lower(email) = 'listed@bond.test';
INSERT INTO public.haus_requests (email, age21_ack, age21_ack_at, requested_dispensary)
VALUES ('other@bond.test', true, now(), 'Other House');
INSERT INTO public.haus_sessions (email, email_hmac, expires_at)
VALUES ('other@bond.test', repeat('d6', 32), now() + interval '1 day');
`,
  );
  assert.equal(otherSession.status, 0, `${otherSession.stdout}\n${otherSession.stderr}`);
  const otherCall = psqlSql(
    database,
    `
SET ROLE service_role;
SELECT public.bond_reopt_haus_update('listed@bond.test', repeat('d4', 32)) AS other_session;
SELECT public.bond_reopt_haus_update('other@bond.test', repeat('d6', 32)) AS other_own;
`,
  );
  console.log("OTHER_SESSION", otherCall.stdout.trim());
  if (otherCall.status !== 0) console.log("OTHER_SESSION_ERR", otherCall.stderr.trim());
  assert.equal(otherCall.status, 0, `${otherCall.stdout}\n${otherCall.stderr}`);
  assert.match(otherCall.stdout, /other_session[\s\S]{0,40}\n-+\n\s*f/);
  assert.match(otherCall.stdout, /other_own[\s\S]{0,40}\n-+\n\s*t/);
  const listedStays = psqlSql(
    database,
    "SELECT count(*) AS listed_still FROM public.haus_updates_suppression WHERE email_hmac = repeat('d4', 32);",
  );
  assert.equal(listedStays.status, 0, listedStays.stderr);
  assert.match(listedStays.stdout, /listed_still[\s\S]{0,40}\n-+\n\s*1/);

  const noAck = psqlSql(
    database,
    `
INSERT INTO public.haus_sessions (email, email_hmac, expires_at)
VALUES ('bare@bond.test', repeat('d7', 32), now() + interval '1 day');
SELECT public.bond_record_haus_update('bare@bond.test', 'haus_page', repeat('d7', 32)) AS bare_recorded;
SELECT public.bond_unsubscribe_haus_update(repeat('d7', 32)) AS bare_unsub;
`,
  );
  assert.equal(noAck.status, 0, `${noAck.stdout}\n${noAck.stderr}`);
  const noAckCall = psqlSql(
    database,
    `
SET ROLE service_role;
SELECT public.bond_reopt_haus_update('bare@bond.test', repeat('d7', 32)) AS no_ack;
`,
  );
  console.log("NO_ACK", noAckCall.stdout.trim());
  if (noAckCall.status !== 0) console.log("NO_ACK_ERR", noAckCall.stderr.trim());
  assert.equal(noAckCall.status, 0, `${noAckCall.stdout}\n${noAckCall.stderr}`);
  assert.match(noAckCall.stdout, /no_ack[\s\S]{0,40}\n-+\n\s*f/);
  const bareStays = psqlSql(
    database,
    "SELECT count(*) AS bare_still FROM public.haus_updates_suppression WHERE email_hmac = repeat('d7', 32);",
  );
  assert.equal(bareStays.status, 0, bareStays.stderr);
  assert.match(bareStays.stdout, /bare_still[\s\S]{0,40}\n-+\n\s*1/);

  const serviceTable = psqlSql(
    database,
    "SET ROLE service_role; SELECT email FROM public.haus_updates;",
  );
  console.log("SERVICE_TABLE_SELECT", serviceTable.stderr.trim());
  assert.notEqual(serviceTable.status, 0);
  assert.match(serviceTable.stderr, /permission denied for table haus_updates/i);

  for (const role of ["anon", "authenticated"]) {
    for (const sql of [
      "SELECT public.bond_has_haus_update(repeat('d4', 32))",
      "SELECT public.bond_unsubscribe_haus_update(repeat('d4', 32))",
      "SELECT public.bond_reopt_haus_update('listed@bond.test', repeat('d4', 32))",
      "SELECT public.bond_record_haus_update('listed@bond.test', 'haus_page', repeat('d4', 32))",
    ]) {
      const deniedFn = psqlSql(database, `SET ROLE ${role}; ${sql};`);
      console.log(`DENIED_${role.toUpperCase()}`, sql, deniedFn.stderr.trim());
      assert.notEqual(deniedFn.status, 0, `${role} ${sql}`);
      assert.match(deniedFn.stderr, /permission denied/i, `${role} ${sql}`);
    }
  }

  const sessionGrants = psqlSql(
    database,
    `
SELECT has_table_privilege('anon', 'public.haus_sessions', 'SELECT') AS anon_haus_select;
SELECT has_table_privilege('anon', 'public.haus_sessions', 'INSERT') AS anon_haus_insert;
SELECT has_table_privilege('anon', 'public.haus_sessions', 'UPDATE') AS anon_haus_update;
SELECT has_table_privilege('anon', 'public.haus_sessions', 'DELETE') AS anon_haus_delete;
SELECT has_table_privilege('authenticated', 'public.haus_sessions', 'SELECT') AS auth_haus_select;
SELECT has_table_privilege('authenticated', 'public.haus_sessions', 'INSERT') AS auth_haus_insert;
SELECT has_table_privilege('authenticated', 'public.haus_sessions', 'UPDATE') AS auth_haus_update;
SELECT has_table_privilege('authenticated', 'public.haus_sessions', 'DELETE') AS auth_haus_delete;
SELECT has_table_privilege('anon', 'public.dispensary_sessions', 'SELECT') AS anon_disp_select;
SELECT has_table_privilege('authenticated', 'public.dispensary_sessions', 'SELECT') AS auth_disp_select;
SELECT has_table_privilege('authenticated', 'public.dispensary_sessions', 'INSERT') AS auth_disp_insert;
SELECT has_table_privilege('authenticated', 'public.dispensary_sessions', 'DELETE') AS auth_disp_delete;
SELECT has_table_privilege('service_role', 'public.haus_sessions', 'SELECT') AS service_haus_select;
SELECT has_table_privilege('service_role', 'public.haus_sessions', 'INSERT') AS service_haus_insert;
SELECT has_table_privilege('service_role', 'public.haus_sessions', 'DELETE') AS service_haus_delete;
SELECT has_table_privilege('service_role', 'public.haus_sessions', 'UPDATE') AS service_haus_update;
SELECT has_table_privilege('service_role', 'public.dispensary_sessions', 'SELECT') AS service_disp_select;
SELECT has_table_privilege('service_role', 'public.dispensary_sessions', 'INSERT') AS service_disp_insert;
SELECT has_table_privilege('service_role', 'public.dispensary_sessions', 'DELETE') AS service_disp_delete;
SELECT has_table_privilege('service_role', 'public.dispensary_sessions', 'UPDATE') AS service_disp_update;
`,
  );
  console.log("SESSION_GRANTS", sessionGrants.stdout.trim());
  if (sessionGrants.status !== 0) console.log("SESSION_GRANTS_ERR", sessionGrants.stderr.trim());
  assert.equal(sessionGrants.status, 0, `${sessionGrants.stdout}\n${sessionGrants.stderr}`);
  for (const name of [
    "anon_haus_select",
    "anon_haus_insert",
    "anon_haus_update",
    "anon_haus_delete",
    "auth_haus_select",
    "auth_haus_insert",
    "auth_haus_update",
    "auth_haus_delete",
    "anon_disp_select",
    "auth_disp_select",
    "auth_disp_insert",
    "auth_disp_delete",
    "service_haus_update",
    "service_disp_update",
  ]) {
    assert.match(sessionGrants.stdout, new RegExp(`${name}[\\s\\S]{0,40}\\n-+\\n\\s*f`), name);
  }
  for (const name of [
    "service_haus_select",
    "service_haus_insert",
    "service_haus_delete",
    "service_disp_select",
    "service_disp_insert",
    "service_disp_delete",
  ]) {
    assert.match(sessionGrants.stdout, new RegExp(`${name}[\\s\\S]{0,40}\\n-+\\n\\s*t`), name);
  }

  const serviceSessions = psqlSql(
    database,
    `
SET ROLE service_role;
INSERT INTO public.haus_sessions (email, email_hmac, expires_at)
VALUES ('grant@bond.test', repeat('ab', 32), now() + interval '1 day');
SELECT count(*) AS grant_haus FROM public.haus_sessions WHERE email = 'grant@bond.test';
DELETE FROM public.haus_sessions WHERE email = 'grant@bond.test';
INSERT INTO public.dispensary_sessions (account_id, expires_at)
SELECT id, now() + interval '1 day'
FROM public.dispensary_accounts WHERE email = 'harbor.buyer@example.test';
SELECT count(*) AS grant_disp FROM public.dispensary_sessions s
JOIN public.dispensary_accounts a ON a.id = s.account_id
WHERE a.email = 'harbor.buyer@example.test';
DELETE FROM public.dispensary_sessions s
USING public.dispensary_accounts a
WHERE a.id = s.account_id AND a.email = 'harbor.buyer@example.test';
`,
  );
  console.log("SERVICE_SESSIONS", serviceSessions.stdout.trim());
  if (serviceSessions.status !== 0) console.log("SERVICE_SESSIONS_ERR", serviceSessions.stderr.trim());
  assert.equal(serviceSessions.status, 0, `${serviceSessions.stdout}\n${serviceSessions.stderr}`);
  assert.match(serviceSessions.stdout, /grant_haus[\s\S]{0,40}\n-+\n\s*1/);
  assert.match(serviceSessions.stdout, /grant_disp[\s\S]{0,40}\n-+\n\s*1/);

  for (const role of ["anon", "authenticated"]) {
    for (const sql of [
      "SELECT email FROM public.haus_sessions",
      "SELECT id FROM public.dispensary_sessions",
    ]) {
      const deniedSession = psqlSql(database, `SET ROLE ${role}; ${sql};`);
      console.log(`DENIED_SESSION_${role.toUpperCase()}`, sql, deniedSession.stderr.trim());
      assert.notEqual(deniedSession.status, 0, `${role} ${sql}`);
      assert.match(deniedSession.stderr, /permission denied/i, `${role} ${sql}`);
    }
  }

  const sessionPurgePrep = psqlSql(
    database,
    `
INSERT INTO public.haus_sessions (email, email_hmac, expires_at)
VALUES
  ('expired@bond.test', repeat('e1', 32), now() - interval '1 hour'),
  ('live@bond.test', repeat('e2', 32), now() + interval '1 day');
INSERT INTO public.dispensary_sessions (account_id, expires_at)
SELECT id, now() - interval '1 hour'
FROM public.dispensary_accounts WHERE email = 'harbor.buyer@example.test';
INSERT INTO public.dispensary_sessions (account_id, expires_at)
SELECT id, now() + interval '1 day'
FROM public.dispensary_accounts WHERE email = 'harbor.buyer@example.test';
SELECT public.bond_purge_expired_sessions() AS purged_sessions;
SELECT count(*) AS haus_expired FROM public.haus_sessions WHERE email = 'expired@bond.test';
SELECT count(*) AS haus_live FROM public.haus_sessions WHERE email = 'live@bond.test';
SELECT count(*) AS disp_expired FROM public.dispensary_sessions WHERE expires_at <= now();
SELECT count(*) AS disp_live FROM public.dispensary_sessions s
JOIN public.dispensary_accounts a ON a.id = s.account_id
WHERE a.email = 'harbor.buyer@example.test' AND s.expires_at > now();
SELECT r.rolname AS purge_owner
FROM pg_proc p
JOIN pg_roles r ON r.oid = p.proowner
WHERE p.proname = 'bond_purge_expired_sessions';
`,
  );
  console.log("SESSION_PURGE", sessionPurgePrep.stdout.trim());
  if (sessionPurgePrep.status !== 0) console.log("SESSION_PURGE_ERR", sessionPurgePrep.stderr.trim());
  assert.equal(sessionPurgePrep.status, 0, `${sessionPurgePrep.stdout}\n${sessionPurgePrep.stderr}`);
  assert.match(sessionPurgePrep.stdout, /haus_expired[\s\S]{0,40}\n-+\n\s*0/);
  assert.match(sessionPurgePrep.stdout, /haus_live[\s\S]{0,40}\n-+\n\s*1/);
  assert.match(sessionPurgePrep.stdout, /disp_expired[\s\S]{0,40}\n-+\n\s*0/);
  assert.match(sessionPurgePrep.stdout, /disp_live[\s\S]{0,40}\n-+\n\s*1/);
  assert.match(sessionPurgePrep.stdout, /purge_owner[\s\S]{0,40}\n-+\n\s*bond_retention/);

  const retentionPrivs = psqlSql(
    database,
    `
SELECT has_table_privilege('bond_retention', 'public.haus_sessions', 'SELECT') AS ret_haus_select;
SELECT has_table_privilege('bond_retention', 'public.haus_sessions', 'INSERT') AS ret_haus_insert;
SELECT has_table_privilege('bond_retention', 'public.haus_sessions', 'UPDATE') AS ret_haus_update;
SELECT has_table_privilege('bond_retention', 'public.haus_sessions', 'DELETE') AS ret_haus_delete;
SELECT has_table_privilege('bond_retention', 'public.dispensary_sessions', 'SELECT') AS ret_disp_select;
SELECT has_table_privilege('bond_retention', 'public.dispensary_sessions', 'INSERT') AS ret_disp_insert;
SELECT has_table_privilege('bond_retention', 'public.dispensary_sessions', 'UPDATE') AS ret_disp_update;
SELECT has_table_privilege('bond_retention', 'public.dispensary_sessions', 'DELETE') AS ret_disp_delete;
`,
  );
  console.log("RETENTION_PRIVS", retentionPrivs.stdout.trim());
  if (retentionPrivs.status !== 0) console.log("RETENTION_PRIVS_ERR", retentionPrivs.stderr.trim());
  assert.equal(retentionPrivs.status, 0, `${retentionPrivs.stdout}\n${retentionPrivs.stderr}`);
  for (const name of [
    "ret_haus_select",
    "ret_haus_insert",
    "ret_haus_update",
    "ret_haus_delete",
    "ret_disp_select",
    "ret_disp_insert",
    "ret_disp_update",
    "ret_disp_delete",
  ]) {
    assert.match(retentionPrivs.stdout, new RegExp(`${name}[\\s\\S]{0,40}\\n-+\\n\\s*f`), name);
  }

  const execPrivs = psqlSql(
    database,
    `
SELECT has_function_privilege('bond_retention', 'public.bond_delete_expired_sessions()', 'EXECUTE') AS ret_exec_inner;
SELECT has_function_privilege('postgres', 'public.bond_purge_expired_sessions()', 'EXECUTE') AS pg_exec_wrapper;
SELECT has_function_privilege('service_role', 'public.bond_delete_expired_sessions()', 'EXECUTE') AS svc_exec_inner;
SELECT has_function_privilege('service_role', 'public.bond_purge_expired_sessions()', 'EXECUTE') AS svc_exec_wrapper;
SELECT has_function_privilege('anon', 'public.bond_purge_expired_sessions()', 'EXECUTE') AS anon_exec_wrapper;
SELECT has_function_privilege('authenticated', 'public.bond_delete_expired_sessions()', 'EXECUTE') AS auth_exec_inner;
`,
  );
  console.log("SESSION_EXEC", execPrivs.stdout.trim());
  if (execPrivs.status !== 0) console.log("SESSION_EXEC_ERR", execPrivs.stderr.trim());
  assert.equal(execPrivs.status, 0, `${execPrivs.stdout}\n${execPrivs.stderr}`);
  for (const name of ["ret_exec_inner", "pg_exec_wrapper"]) {
    assert.match(execPrivs.stdout, new RegExp(`${name}[\\s\\S]{0,40}\\n-+\\n\\s*t`), name);
  }
  for (const name of ["svc_exec_inner", "svc_exec_wrapper", "anon_exec_wrapper", "auth_exec_inner"]) {
    assert.match(execPrivs.stdout, new RegExp(`${name}[\\s\\S]{0,40}\\n-+\\n\\s*f`), name);
  }

  for (const sql of [
    "SELECT email FROM public.haus_sessions",
    "INSERT INTO public.haus_sessions (email, email_hmac, expires_at) VALUES ('nope@bond.test', repeat('e3', 32), now() + interval '1 day')",
    "UPDATE public.haus_sessions SET expires_at = now()",
    "DELETE FROM public.haus_sessions",
    "SELECT id FROM public.dispensary_sessions",
    "UPDATE public.dispensary_sessions SET expires_at = now()",
    "DELETE FROM public.dispensary_sessions",
  ]) {
    const deniedRetention = psqlSql(database, `SET ROLE bond_retention; ${sql};`);
    console.log("DENIED_RETENTION", sql, deniedRetention.stderr.trim());
    assert.notEqual(deniedRetention.status, 0, sql);
    assert.match(deniedRetention.stderr, /permission denied/i, sql);
  }
  } finally {
    spawnSync(
      "sudo",
      ["-n", "-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS ${database}`],
      { encoding: "utf8" },
    );
  }
});
