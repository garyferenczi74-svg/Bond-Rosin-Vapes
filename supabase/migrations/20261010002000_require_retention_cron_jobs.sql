-- Fail the apply unless the seven retention jobs are scheduled.
-- DO NOT apply this file to the live project ziruzhhkkndgmdouithb from this PR.
-- Apply after 20261010001000_purge_expired_sessions.sql.
--
-- The four schedule migrations were edited in place. None of them has run on
-- live. Live still has four migrations, through 20260921063126_harden_rls_rpc.
-- Ship order: enable pg_cron, then apply. Privacy retention depends on these jobs.

DO $guard$
DECLARE
  missing text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron is not installed. Enable pg_cron on this database before applying migrations. Privacy retention depends on the daily purge jobs.';
  END IF;

  IF to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION 'pg_cron is installed but cron.job is missing. Enable pg_cron before applying migrations.';
  END IF;

  SELECT string_agg(expected.jobname, ', ' ORDER BY expected.jobname)
    INTO missing
  FROM (
    VALUES
      ('bond_purge_haus_requests'),
      ('bond_purge_order_requests'),
      ('bond_purge_auth_attempts'),
      ('bond_purge_audit_log'),
      ('bond_purge_dispensary_accounts'),
      ('bond_purge_haus_updates'),
      ('bond_purge_expired_sessions')
  ) AS expected(jobname)
  WHERE NOT EXISTS (
    SELECT 1 FROM cron.job AS job WHERE job.jobname = expected.jobname
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'pg_cron is installed but these retention jobs are missing from cron.job: %', missing;
  END IF;
END
$guard$;
