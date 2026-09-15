# Supabase (Gary)

This repo does not apply SQL to production. The static marketing site does not call Supabase.

## Project
- Name: Bond-Rosin-Vapes
- Ref: ziruzhhkkndgmdouithb
- URL: https://ziruzhhkkndgmdouithb.supabase.co

## Run this PR's hardening
File: `supabase/migrations/20260915183000_revoke_definer_execute_and_document_rls.sql`

1. Open the Supabase SQL editor for Bond-Rosin-Vapes.
2. Paste and run that file.
3. Confirm no row counts change. This script does not delete data.

What it does:
- Revokes EXECUTE on `public.is_admin()` from `anon` and `authenticated`. Keeps `postgres` and `service_role`.
- Revokes EXECUTE on `public.rls_auto_enable()` from `anon` and `authenticated`. Keeps `postgres`.
- Leaves `ny_cities` and `reserve_runs` with RLS on and no public policies (service role only). Adds table comments so that deny-all is intentional.

Do not add anon SELECT on those tables until Phase 1 defines a public read model.
