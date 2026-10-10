-- Delete Haus and dispensary sessions after they expire.
-- DO NOT apply this file to the live project ziruzhhkkndgmdouithb from this PR.
-- Apply after 20261009235000_session_grants_and_reopt_bind.sql.
--
-- bond_purge_expired_sessions runs as bond_retention, on the same pattern as
-- the jobs in 20261008201000_felix_request_retention.sql. It calls
-- bond_delete_expired_sessions, a definer owned by postgres, because choosing
-- the rows has to read expires_at. bond_retention has no table privileges on
-- these two tables, so it cannot read the email or delete a row on its own.
-- Sign-out deletes by service_role stay.

CREATE OR REPLACE FUNCTION public.bond_delete_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  removed integer := 0;
  batch integer := 0;
BEGIN
  DELETE FROM public.haus_sessions
  WHERE expires_at <= now();
  GET DIAGNOSTICS batch = ROW_COUNT;
  removed := removed + batch;

  DELETE FROM public.dispensary_sessions
  WHERE expires_at <= now();
  GET DIAGNOSTICS batch = ROW_COUNT;
  removed := removed + batch;

  RETURN removed;
END;
$function$;

REVOKE ALL ON FUNCTION public.bond_delete_expired_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_delete_expired_sessions() FROM anon;
REVOKE ALL ON FUNCTION public.bond_delete_expired_sessions() FROM authenticated;
REVOKE ALL ON FUNCTION public.bond_delete_expired_sessions() FROM service_role;
GRANT EXECUTE ON FUNCTION public.bond_delete_expired_sessions() TO bond_retention;

CREATE OR REPLACE FUNCTION public.bond_purge_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
BEGIN
  RETURN public.bond_delete_expired_sessions();
END;
$function$;

-- A non-superuser can only hand a function to a role that has CREATE on
-- its schema. Grant it for the ownership change only, then take it back.
GRANT CREATE ON SCHEMA public TO bond_retention;
ALTER FUNCTION public.bond_purge_expired_sessions() OWNER TO bond_retention;
REVOKE CREATE ON SCHEMA public FROM bond_retention;

REVOKE ALL ON FUNCTION public.bond_purge_expired_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_purge_expired_sessions() FROM anon;
REVOKE ALL ON FUNCTION public.bond_purge_expired_sessions() FROM authenticated;
REVOKE ALL ON FUNCTION public.bond_purge_expired_sessions() FROM service_role;
GRANT EXECUTE ON FUNCTION public.bond_purge_expired_sessions() TO postgres;

REVOKE ALL ON TABLE public.haus_sessions FROM bond_retention;
REVOKE ALL ON TABLE public.dispensary_sessions FROM bond_retention;

-- A missing pg_cron install is the only skip. cron.schedule errors fail this migration.
DO $cron$
DECLARE
  spec record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron schedule skipped (%). Enabling pg_cron is a ship-time step for M.',
      'pg_cron is not installed';
    RETURN;
  END IF;

  SELECT specs.schedule, specs.command
    INTO spec
  FROM public.bond_retention_cron_specs() AS specs
  WHERE specs.jobname = 'bond_purge_expired_sessions';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'retention job bond_purge_expired_sessions has no canonical definition';
  END IF;
  PERFORM cron.schedule(
    'bond_purge_expired_sessions',
    spec.schedule,
    spec.command
  );
END
$cron$;
