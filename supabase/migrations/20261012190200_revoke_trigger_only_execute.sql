-- Revoke EXECUTE from PUBLIC, anon, and authenticated on trigger functions
-- that return trigger and are not called directly. Confirmed read-only on
-- 2026-10-12 against project ziruzhhkkndgmdouithb (pg_proc result type,
-- pg_depend, pg_trigger) and against a scratch database after these
-- migrations. No RLS policy, view, or other function references them.
-- App code does not call them.
--
--   public.bond_retention_delete_only()
--     triggers: haus_requests_retention_delete, order_requests_retention_delete,
--     auth_attempts_retention_delete
--   public.haus_updates_before_delete()
--     trigger: haus_updates_before_delete on haus_updates
--   public.dispensary_accounts_mark_closed()
--     trigger: dispensary_accounts_mark_closed on dispensary_accounts
--
-- nearest_bond_dispensaries(input_city text) stays granted. It returns a
-- table, not trigger. anon can execute it. The finder in this repo does
-- not call it, and live SQL does not reference it. That does not prove no
-- client calls it over RPC.
--
-- Trigger execution does not check EXECUTE for the caller. Revoking it
-- blocks a direct call. The triggers still fire.
-- Idempotent. REVOKE on a missing grant is a no-op.

REVOKE EXECUTE ON FUNCTION public.bond_retention_delete_only() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bond_retention_delete_only() FROM anon;
REVOKE EXECUTE ON FUNCTION public.bond_retention_delete_only() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.haus_updates_before_delete() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.haus_updates_before_delete() FROM anon;
REVOKE EXECUTE ON FUNCTION public.haus_updates_before_delete() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.dispensary_accounts_mark_closed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dispensary_accounts_mark_closed() FROM anon;
REVOKE EXECUTE ON FUNCTION public.dispensary_accounts_mark_closed() FROM authenticated;
