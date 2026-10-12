-- Revoke EXECUTE on the SECURITY DEFINER trigger functions the security
-- advisor flags. Confirmed read-only on 2026-10-12 against project
-- ziruzhhkkndgmdouithb (get_advisors security, plus pg_proc.prosecdef).
--
-- Flagged, prosecdef, and used by a table trigger:
--   public.haus_updates_before_insert()
--   public.haus_updates_suppression_before_insert()
-- anon can execute both. authenticated can execute both.
--
-- Not in this revoke:
--   bond_retention_delete_only() is a trigger, but prosecdef is false, so
--   the executable security definer lints do not flag it.
--   order_requests_require_approved() is a security definer trigger and is
--   not flagged. anon and authenticated already lack EXECUTE.
--   admin_role, is_admin, is_owner, is_signup_owner, and
--   mark_admin_mfa_enrolled are security definer and authenticated can
--   execute them. They are not triggers. is_admin stays executable so RLS
--   policies can run.
--
-- Trigger execution does not check EXECUTE for the caller. Revoking it
-- blocks /rest/v1/rpc calls. Inserts and deletes that fire the trigger
-- still run the function.

REVOKE EXECUTE ON FUNCTION public.haus_updates_before_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.haus_updates_before_insert() FROM anon;
REVOKE EXECUTE ON FUNCTION public.haus_updates_before_insert() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.haus_updates_suppression_before_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.haus_updates_suppression_before_insert() FROM anon;
REVOKE EXECUTE ON FUNCTION public.haus_updates_suppression_before_insert() FROM authenticated;
