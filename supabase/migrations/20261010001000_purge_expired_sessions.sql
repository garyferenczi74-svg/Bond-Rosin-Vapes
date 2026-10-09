-- Delete Haus and dispensary sessions after they expire.
-- DO NOT apply this file to the live project ziruzhhkkndgmdouithb from this PR.
-- Apply after 20261009235000_session_grants_and_reopt_bind.sql.
--
-- bond_purge_expired_sessions runs as bond_retention, on the same pattern as
-- the jobs in 20261008201000_felix_request_retention.sql. bond_retention is
-- granted DELETE only on these two tables. It is not granted SELECT, so it
-- cannot read the plaintext email. Reading expires_at is required to choose
-- the rows, so the delete itself is a definer owned by postgres and called
-- from the retention function. Sign-out deletes by service_role stay.

CREATE OR REPLACE FUNCTION public.bond_delete_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.bond_delete_expired_sessions();
END;
$function$;

ALTER FUNCTION public.bond_purge_expired_sessions() OWNER TO bond_retention;

REVOKE ALL ON FUNCTION public.bond_purge_expired_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_purge_expired_sessions() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bond_purge_expired_sessions() TO postgres;

REVOKE ALL ON TABLE public.haus_sessions FROM bond_retention;
REVOKE ALL ON TABLE public.dispensary_sessions FROM bond_retention;
GRANT DELETE ON TABLE public.haus_sessions TO bond_retention;
GRANT DELETE ON TABLE public.dispensary_sessions TO bond_retention;

DO $cron$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule(
    'bond_purge_expired_sessions',
    '50 4 * * *',
    'SELECT public.bond_purge_expired_sessions()'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron schedule skipped (%). Enabling pg_cron is a ship-time step for M.', SQLERRM;
END
$cron$;
