# Supabase (Gary)

Project: Bond-Rosin-Vapes
Ref: ziruzhhkkndgmdouithb
URL: https://ziruzhhkkndgmdouithb.supabase.co

The Next.js access shell uses the anon or publishable key only. Gary holds production and social publish keys elsewhere.

## Migrations

1. `20260915183000_revoke_definer_execute_and_document_rls.sql` (earlier hardening)
2. `20260915194500_phase1_access_shell.sql` (admins gate, append-only audit, lockout stub)
3. `20260915195000_auth_attempt_check_outcome.sql` (lockout pre-check)
4. `20260915210000_phase1_mfa_waiver_w_2026_09_15_p1_override.sql` (Gary waiver: drop AAL2 from `is_admin` and `admin_role`)

These do not delete marketing data.

What Phase 1 changes:

- `is_admin()` reads `public.admins` (owner or operator, active). Waiver W-2026-09-15-P1-OVERRIDE removes the JWT `aal=aal2` requirement. It does not read `user_metadata`.
- Anon cannot `EXECUTE` `is_admin` or `rls_auto_enable`.
- `authenticated` can `EXECUTE` `is_admin` so RLS policies can run.
- `audit_log` is insert plus select for authenticated admins. Update and delete are blocked by trigger.
- `auth_attempts` is written only through `record_auth_attempt`.

Seed an admin by inserting one `auth.users` row (no shared accounts), then one `public.admins` row for that `user_id`. Under W-2026-09-15-P1-OVERRIDE, password auth at `/haus` opens `/vauxhall` without MFA enroll.
