-- Mirrors the live migration history row 20261011054912 on project
-- ziruzhhkkndgmdouithb. Live recorded that version and the repo had no file
-- for it. A read-only check shows pg_cron installed in pg_catalog
-- (pg_extension.extnamespace). That is pg_cron's fixed schema. cron.schedule
-- and cron.job stay in schema cron.
--
-- This version sorts after 20261010002000_require_retention_cron_jobs.sql,
-- matching live history. The guard still fail-closes when pg_cron is absent,
-- so a fresh apply does not start scheduling before the guard can check.
-- Ship order is unchanged: enable pg_cron, then apply. When the extension is
-- already installed, this statement notices and skips. A NOSUPERUSER role can
-- run that skip.

create extension if not exists pg_cron;
