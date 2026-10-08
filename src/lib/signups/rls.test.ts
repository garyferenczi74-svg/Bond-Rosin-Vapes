import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migration = fileURLToPath(new URL("../../../supabase/migrations/20261008193000_server_side_signups.sql", import.meta.url));
const psql = spawnSync("psql", ["--version"], { encoding: "utf8" });
const sudo = spawnSync("sudo", ["-n", "-u", "postgres", "psql", "-c", "SELECT 1"], { encoding: "utf8" });
const ready = psql.status === 0 && sudo.status === 0;

test("signup migrations apply and RLS holds on local Postgres", { skip: ready ? false : "local Postgres is not available" }, () => {
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
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;

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

\\i ${migration}

GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;

INSERT INTO public.dispensary_accounts (
  dispensary_name, address, contact_name, phone, ocm_license, email,
  password_hash, password_salt, age21_ack_at, status
) VALUES (
  'Harbor House', '18 Harbor Street, Albany, NY 12207', 'Harbor Buyer', '518-555-0199',
  'OCM-HARBOR-19', 'harbor.buyer@example.test', 'scrypt-hash', 'scrypt-salt', now(), 'pending'
);

SET ROLE anon;
INSERT INTO public.haus_signups (email, age21_ack_at) VALUES ('member@bond.test', now());
RESET ROLE;

SELECT status AS still_pending FROM public.dispensary_accounts WHERE email = 'harbor.buyer@example.test';
SELECT COUNT(*) AS haus_kept FROM public.haus_signups WHERE email = 'member@bond.test';

INSERT INTO public.admins (user_id, role, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'operator', 'active');

SELECT set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
SET ROLE authenticated;
SELECT COUNT(*) AS stranger_seen FROM public.dispensary_accounts;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
SET ROLE authenticated;
SELECT COUNT(*) AS operator_seen FROM public.dispensary_accounts;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
SET ROLE authenticated;
SELECT COUNT(*) AS owner_seen FROM public.dispensary_accounts;
SELECT COUNT(*) AS owner_haus FROM public.haus_signups;
RESET ROLE;
`,
  );

  chmodSync(probe, 0o644);
  const probed = spawnSync(
    "sudo",
    ["-n", "-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", "bond_signup_rls", "-f", probe],
    { encoding: "utf8" },
  );
  assert.equal(probed.status, 0, `${probed.stdout}\n${probed.stderr}`);
  const text = probed.stdout;
  assert.match(text, /still_pending[\s\S]{0,40}\n-+\n pending/);
  assert.match(text, /haus_kept[\s\S]{0,40}\n-+\n\s+1/);
  assert.match(text, /stranger_seen[\s\S]{0,40}\n-+\n\s+0/);
  assert.match(text, /operator_seen[\s\S]{0,40}\n-+\n\s+0/);
  assert.match(text, /owner_seen[\s\S]{0,40}\n-+\n\s+1/);
  assert.match(text, /owner_haus[\s\S]{0,40}\n-+\n\s+1/);

  const denied = spawnSync(
    "sudo",
    ["-n", "-u", "postgres", "psql", "-d", "bond_signup_rls", "-v", "ON_ERROR_STOP=1", "-c", `
SET ROLE anon;
INSERT INTO public.dispensary_accounts (
  dispensary_name, address, contact_name, phone, ocm_license, email,
  password_hash, password_salt, age21_ack_at, status
) VALUES (
  'Approved House', '18 Harbor Street, Albany, NY 12207', 'Harbor Buyer', '518-555-0199',
  'OCM-APPROVED-1', 'approved.buyer@example.test', 'scrypt-hash', 'scrypt-salt', now(), 'approved'
);
`],
    { encoding: "utf8" },
  );
  assert.notEqual(denied.status, 0, denied.stdout);
  assert.match(`${denied.stderr}\n${denied.stdout}`, /row-level security|check constraint|new row violates/i);

  for (const sql of [
    "SELECT COUNT(*) FROM public.dispensary_accounts",
    "UPDATE public.dispensary_accounts SET status = 'approved'",
    "DELETE FROM public.dispensary_accounts",
    "SELECT COUNT(*) FROM public.haus_signups",
  ]) {
    const blocked = spawnSync(
      "sudo",
      ["-n", "-u", "postgres", "psql", "-d", "bond_signup_rls", "-v", "ON_ERROR_STOP=1", "-c", `SET ROLE anon; ${sql};`],
      { encoding: "utf8" },
    );
    assert.notEqual(blocked.status, 0, sql);
    assert.match(`${blocked.stderr}\n${blocked.stdout}`, /permission denied/i, sql);
  }

  const after = spawnSync(
    "sudo",
    ["-n", "-u", "postgres", "psql", "-d", "bond_signup_rls", "-tA", "-c", "SELECT status FROM public.dispensary_accounts WHERE email = 'harbor.buyer@example.test'"],
    { encoding: "utf8" },
  );
  assert.equal(after.stdout.trim(), "pending");
});
