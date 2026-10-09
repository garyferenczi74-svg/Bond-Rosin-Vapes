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

  const dir = mkdtempSync(join(tmpdir(), "bond-signup-rls-"));
  chmodSync(dir, 0o755);
  const setup = join(dir, "setup.sql");
  const probe = join(dir, "probe.sql");
  writeFileSync(
    setup,
    `
DROP DATABASE IF EXISTS bond_signup_rls;
CREATE DATABASE bond_signup_rls;
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
SELECT public.bond_unsubscribe_haus_update(repeat('ab', 32)) AS gone_unsubscribed;
SELECT COUNT(*) AS gone_left FROM public.haus_updates WHERE email = 'gone@bond.test';
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
SELECT public.bond_record_haus_update('keptconfirm@bond.test', 'haus_door', repeat('bb', 32)) AS kept_recorded;
UPDATE public.haus_updates
SET consent_at = now() - interval '25 months', confirmed_at = now()
WHERE email = 'keptconfirm@bond.test';
SELECT public.bond_purge_haus_updates() AS updates_purged;
SELECT COUNT(*) AS aged_left FROM public.haus_updates WHERE email = 'aged@bond.test';
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
  AND column_name IN ('id', 'email_hmac', 'purpose', 'created_at');
SELECT COUNT(*) AS token_extra
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'haus_update_tokens'
  AND column_name NOT IN ('id', 'email_hmac', 'purpose', 'created_at');

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
  const probed = psqlFile("bond_signup_rls", probe);
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
  saw("gone_unsubscribed", "t");
  saw("gone_left", "0");
  saw("suppressed_rejected", "f");
  saw("suppressed_absent", "0");
  saw("reader_unsubscribed", "t");
  saw("reader_left", "0");
  saw("reader_suppressed", "1");
  saw("reader_readd", "f");
  saw("updates_purged", "1");
  saw("aged_left", "0");
  saw("keptconfirm_left", "1");
  saw("fresh_after_purge", "1");
  saw("suppression_after_purge", "2");
  saw("token_opaque", "t");
  saw("token_email_cols", "0");
  saw("token_cols", "4");
  saw("token_extra", "0");
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
    "bond_signup_rls",
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
    "bond_signup_rls",
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
    const blocked = psqlSql("bond_signup_rls", `SET ROLE anon; ${sql};`);
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
    const blocked = psqlSql("bond_signup_rls", sql);
    assert.notEqual(blocked.status, 0, sql);
    assert.match(`${blocked.stderr}\n${blocked.stdout}`, /append only|retention deletes are limited/i, sql);
  }

  const operatorUpdate = psqlSql(
    "bond_signup_rls",
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
    "bond_signup_rls",
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
    "bond_signup_rls",
    "SET ROLE anon; INSERT INTO public.haus_updates (email, source, email_hmac) VALUES ('reader@bond.test', 'haus_door', repeat('ef', 32));",
  );
  console.log("FELIX_REPRO_ANON_SUPPRESSED", felixAnonSuppressed.stderr.trim());
  assert.notEqual(felixAnonSuppressed.status, 0);
  assert.match(felixAnonSuppressed.stderr, /permission denied/i);

  const felixAnonThird = psqlSql(
    "bond_signup_rls",
    "SET ROLE anon; INSERT INTO public.haus_updates (email, source) VALUES ('third.party@example.test', 'haus_door');",
  );
  console.log("FELIX_REPRO_ANON_THIRD", felixAnonThird.stderr.trim());
  assert.notEqual(felixAnonThird.status, 0);
  assert.match(felixAnonThird.stderr, /permission denied/i);

  const felixAnonSuppression = psqlSql(
    "bond_signup_rls",
    "SET ROLE anon; INSERT INTO public.haus_updates_suppression (email_hmac) VALUES (repeat('11', 32));",
  );
  console.log("FELIX_REPRO_ANON_SUPPRESSION", felixAnonSuppression.stderr.trim());
  assert.notEqual(felixAnonSuppression.status, 0);
  assert.match(felixAnonSuppression.stderr, /permission denied/i);

  const felixService = psqlSql(
    "bond_signup_rls",
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
    "bond_signup_rls",
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
    "bond_signup_rls",
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
    "bond_signup_rls",
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
    "bond_signup_rls",
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
    "bond_signup_rls",
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
    "bond_signup_rls",
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
    "bond_signup_rls",
    "SELECT status FROM public.dispensary_accounts WHERE email = 'harbor.buyer@example.test'",
  );
  assert.equal(after.status, 0, after.stderr);
  assert.match(after.stdout, /pending/);
});
