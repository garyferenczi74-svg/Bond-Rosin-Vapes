-- Fail the apply unless the seven retention jobs match the canonical list.
-- DO NOT apply this file to the live project ziruzhhkkndgmdouithb from this PR.
-- Apply after 20261010001000_purge_expired_sessions.sql.
--
-- The four schedule migrations were edited in place. None of them has run on
-- live. Live still has four migrations, through 20260921063126_harden_rls_rpc.
-- Ship order: enable pg_cron, then apply. If those four were applied earlier
-- and skipped their schedules, re-run this file, or once this function is
-- installed run: SELECT public.bond_require_retention_cron_jobs();
-- Then confirm the seven rows in cron.job.

CREATE OR REPLACE FUNCTION public.bond_require_retention_cron_jobs()
RETURNS void
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $function$
DECLARE
  spec record;
  found_schedule text;
  found_command text;
  found_active boolean;
  found_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron is not installed. Enable pg_cron on this database before applying migrations. Privacy retention depends on the daily purge jobs.';
  END IF;

  IF to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION 'pg_cron is installed but cron.job is missing. Enable pg_cron before applying migrations.';
  END IF;

  FOR spec IN
    SELECT specs.jobname, specs.schedule, specs.command
    FROM public.bond_retention_cron_specs() AS specs
  LOOP
    IF NOT EXISTS (SELECT 1 FROM cron.job AS job WHERE job.jobname = spec.jobname) THEN
      PERFORM cron.schedule(spec.jobname, spec.schedule, spec.command);
    END IF;
  END LOOP;

  FOR spec IN
    SELECT specs.jobname, specs.schedule, specs.command
    FROM public.bond_retention_cron_specs() AS specs
  LOOP
    SELECT count(*)
      INTO found_count
    FROM cron.job AS job
    WHERE job.jobname = spec.jobname;

    IF found_count = 0 THEN
      RAISE EXCEPTION 'retention job % failed check: missing', spec.jobname;
    END IF;
    IF found_count > 1 THEN
      RAISE EXCEPTION 'retention job % failed check: duplicate', spec.jobname;
    END IF;

    SELECT job.schedule, job.command, job.active
      INTO found_schedule, found_command, found_active
    FROM cron.job AS job
    WHERE job.jobname = spec.jobname;

    IF found_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'retention job % failed check: active', spec.jobname;
    END IF;
    IF found_schedule IS DISTINCT FROM spec.schedule THEN
      RAISE EXCEPTION 'retention job % failed check: schedule', spec.jobname;
    END IF;
    IF found_command IS DISTINCT FROM spec.command THEN
      RAISE EXCEPTION 'retention job % failed check: command', spec.jobname;
    END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.bond_require_retention_cron_jobs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_require_retention_cron_jobs() FROM anon;
REVOKE ALL ON FUNCTION public.bond_require_retention_cron_jobs() FROM authenticated;
REVOKE ALL ON FUNCTION public.bond_require_retention_cron_jobs() FROM service_role;
GRANT EXECUTE ON FUNCTION public.bond_require_retention_cron_jobs() TO postgres;

COMMENT ON FUNCTION public.bond_require_retention_cron_jobs() IS
  'Schedules a missing retention job from bond_retention_cron_specs, then checks active, schedule, and command. Enable pg_cron first. Re-run this migration, or SELECT public.bond_require_retention_cron_jobs().';

SELECT public.bond_require_retention_cron_jobs();
