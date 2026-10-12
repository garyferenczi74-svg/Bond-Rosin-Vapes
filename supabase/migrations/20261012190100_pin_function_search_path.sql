-- Pin search_path on every public function the security advisor flags as
-- mutable. Confirmed read-only on 2026-10-12 against project
-- ziruzhhkkndgmdouithb (get_advisors security, lint function_search_path_mutable).
-- Five functions:
--   public.audit_log_deny_mutation()
--   public.bond_retention_delete_only()
--   public.dispensary_accounts_mark_closed()
--   public.haus_updates_before_delete()
--   public.nearest_bond_dispensaries(input_city text)
--
-- nearest_bond_dispensaries is on live and is not created by these migrations.
-- The four trigger functions are. Owners are not all the applying role: purge
-- helpers are owned by bond_retention, and a later owner change has to be
-- handled the same way as 20261008201000_felix_request_retention.sql. On
-- PG16 and PG17 a non-superuser creator does not receive SET, so grant SET
-- and INHERIT before SET ROLE. Then alter the function as its owner.
-- Idempotent. A missing nearest_bond_dispensaries is skipped. The four
-- in-repo functions are required.

DO $pin$
DECLARE
  rec record;
  v_switched boolean;
BEGIN
  IF to_regprocedure('public.audit_log_deny_mutation()') IS NULL
     OR to_regprocedure('public.bond_retention_delete_only()') IS NULL
     OR to_regprocedure('public.dispensary_accounts_mark_closed()') IS NULL
     OR to_regprocedure('public.haus_updates_before_delete()') IS NULL THEN
    RAISE EXCEPTION 'search_path pin is missing a retention or haus trigger function';
  END IF;

  FOR rec IN
    SELECT p.oid::regprocedure AS sig, r.rolname AS owner
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    JOIN pg_roles AS r ON r.oid = p.proowner
    WHERE n.nspname = 'public'
      AND (
        (p.proname = 'audit_log_deny_mutation' AND pg_get_function_identity_arguments(p.oid) = '')
        OR (p.proname = 'bond_retention_delete_only' AND pg_get_function_identity_arguments(p.oid) = '')
        OR (p.proname = 'dispensary_accounts_mark_closed' AND pg_get_function_identity_arguments(p.oid) = '')
        OR (p.proname = 'haus_updates_before_delete' AND pg_get_function_identity_arguments(p.oid) = '')
        OR (p.proname = 'nearest_bond_dispensaries' AND pg_get_function_identity_arguments(p.oid) = 'input_city text')
      )
  LOOP
    v_switched := rec.owner IS DISTINCT FROM current_user;
    IF v_switched AND NOT pg_has_role(current_user, rec.owner, 'SET') THEN
      IF current_setting('server_version_num')::int >= 160000 THEN
        EXECUTE format('GRANT %I TO %I WITH SET TRUE, INHERIT TRUE', rec.owner, current_user);
      ELSE
        EXECUTE format('GRANT %I TO %I', rec.owner, current_user);
      END IF;
    END IF;

    BEGIN
      IF v_switched THEN
        EXECUTE format('SET ROLE %I', rec.owner);
      END IF;
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', rec.sig);
      IF v_switched THEN
        EXECUTE 'RESET ROLE';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        IF v_switched THEN
          EXECUTE 'RESET ROLE';
        END IF;
        RAISE;
    END;
  END LOOP;
END
$pin$;
