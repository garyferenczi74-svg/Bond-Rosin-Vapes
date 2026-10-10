-- Felix compliance addendum. DO NOT apply this file to the live project
-- ziruzhhkkndgmdouithb from this PR. M applies it at ship time.
--
-- Records are requests. Haus rows are email, a 21+ self-attestation (boolean
-- plus time), created time, and the requested dispensary. No birth date and
-- no age-gate answers. Wholesale rows in order_requests stay request data
-- only: no payment, hold, allocation, or reservation columns.
--
-- Retention, ruled by Felix:
--   haus_requests and order_requests: delete after 24 months.
--   Felix named Haus request records and 21+ acks. This migration applies
--   the same 24 months to wholesale request rows and flags that choice.
--   dispensary_accounts are not on that schedule.
--   auth_attempts: delete after 90 days. IP is sha256(lower(trim(ip))), the
--   same pattern as the email hash. There is no salt or pepper today.
--   audit_log: append-only. A dedicated role bond_retention may delete rows
--   older than 24 months. Every other role is blocked by trigger.
--
-- pg_cron schedules are below. Enabling pg_cron is a ship-time step for M.
-- Job name, schedule, and command live only in bond_retention_cron_specs.
-- If pg_cron is not installed, these schedules are not written. The guard
-- migration then schedules any missing job and fails unless all seven match.
-- An error from cron.schedule fails this migration.

ALTER TABLE public.haus_signups RENAME TO haus_requests;

ALTER TABLE public.haus_requests
  ADD COLUMN age21_ack boolean,
  ADD COLUMN requested_dispensary text;

UPDATE public.haus_requests
SET age21_ack = true
WHERE age21_ack IS NULL AND age21_ack_at IS NOT NULL;

UPDATE public.haus_requests
SET requested_dispensary = ''
WHERE requested_dispensary IS NULL;

ALTER TABLE public.haus_requests
  ALTER COLUMN age21_ack SET NOT NULL,
  ALTER COLUMN requested_dispensary SET NOT NULL;

ALTER TABLE public.haus_requests
  ADD CONSTRAINT haus_requests_age21_ack_check CHECK (age21_ack);

COMMENT ON TABLE public.haus_requests IS
  'Haus requests. Email, 21+ self-attestation (boolean and time), created time, requested dispensary. No birth date. No age-gate answers. Not sent to Metrc. Deleted after 24 months by bond_retention.';

COMMENT ON COLUMN public.haus_requests.age21_ack IS
  'Self-attestation that the person is 21 or older. Not an age-gate record and not a date of birth.';

COMMENT ON COLUMN public.haus_requests.requested_dispensary IS
  'Dispensary the person requested. Request data only.';

COMMENT ON TABLE public.order_requests IS
  'Wholesale request data only. No payment, hold, allocation, or reservation state. Not sent to Metrc. Deleted after 24 months by bond_retention. Felix named Haus records for that period; wholesale request rows use the same period and that choice is flagged for review.';

ALTER TABLE public.order_requests
  ADD CONSTRAINT order_requests_request_data_only CHECK (
    position('payment' in lower(lines::text)) = 0
    AND position('allocation' in lower(lines::text)) = 0
    AND position('reservation' in lower(lines::text)) = 0
    AND position('hold' in lower(lines::text)) = 0
  );

DROP POLICY IF EXISTS haus_signups_anon_insert ON public.haus_requests;
DROP POLICY IF EXISTS haus_signups_owner_select ON public.haus_requests;

CREATE POLICY haus_requests_anon_insert
  ON public.haus_requests
  FOR INSERT
  TO anon
  WITH CHECK (
    age21_ack = true
    AND age21_ack_at IS NOT NULL
    AND length(trim(email)) > 3
    AND length(trim(requested_dispensary)) >= 2
  );

CREATE POLICY haus_requests_member_or_admin_select
  ON public.haus_requests
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR public.is_admin()
  );

REVOKE UPDATE, DELETE ON TABLE public.haus_requests FROM PUBLIC;
REVOKE UPDATE, DELETE ON TABLE public.haus_requests FROM anon;
REVOKE UPDATE, DELETE ON TABLE public.haus_requests FROM authenticated;

-- IP hash. Email is already sha256(lower(trim(email))) with no salt or pepper.
UPDATE public.auth_attempts
SET ip = encode(extensions.digest(lower(btrim(ip)), 'sha256'), 'hex')
WHERE ip IS NOT NULL
  AND btrim(ip) <> ''
  AND ip !~ '^[0-9a-f]{64}$';

ALTER TABLE public.auth_attempts RENAME COLUMN ip TO ip_hash;

COMMENT ON COLUMN public.auth_attempts.ip_hash IS
  'sha256 hex of lower(trim(ip)). Same pattern as email_hash. No salt or pepper. Empty string when no address was supplied.';

CREATE OR REPLACE FUNCTION public.record_auth_attempt(
  p_email text,
  p_ip text,
  p_outcome text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_hash text;
  v_ip text;
  v_fails int;
  v_locked int;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN jsonb_build_object('allowed', false, 'locked', false);
  END IF;

  v_hash := encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex');
  v_ip := CASE
    WHEN p_ip IS NULL OR length(btrim(p_ip)) = 0 THEN ''
    WHEN p_ip ~ '^[0-9a-f]{64}$' THEN lower(p_ip)
    ELSE encode(extensions.digest(lower(btrim(p_ip)), 'sha256'), 'hex')
  END;

  SELECT count(*) INTO v_locked
  FROM public.auth_attempts
  WHERE email_hash = v_hash
    AND outcome = 'lockout'
    AND attempted_at > now() - interval '30 minutes';

  IF p_outcome = 'check' THEN
    RETURN jsonb_build_object('allowed', v_locked = 0, 'locked', v_locked > 0);
  END IF;

  IF v_locked > 0 AND p_outcome <> 'lockout' THEN
    INSERT INTO public.auth_attempts (email_hash, ip_hash, outcome)
    VALUES (v_hash, v_ip, 'blocked');
    RETURN jsonb_build_object('allowed', false, 'locked', true);
  END IF;

  INSERT INTO public.auth_attempts (email_hash, ip_hash, outcome)
  VALUES (v_hash, v_ip, p_outcome);

  IF p_outcome IN ('fail', 'blocked') THEN
    SELECT count(*) INTO v_fails
    FROM public.auth_attempts
    WHERE email_hash = v_hash
      AND outcome IN ('fail', 'blocked')
      AND attempted_at > now() - interval '15 minutes';

    IF v_fails >= 5 THEN
      INSERT INTO public.auth_attempts (email_hash, ip_hash, outcome)
      VALUES (v_hash, v_ip, 'lockout');
      RETURN jsonb_build_object('allowed', false, 'locked', true);
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', p_outcome NOT IN ('fail', 'blocked', 'lockout'), 'locked', false);
END;
$function$;

COMMENT ON FUNCTION public.record_auth_attempt(text, text, text) IS
  'SECURITY DEFINER lockout. Email and IP are stored as sha256 hex. 5 fails in 15 minutes lock 30 minutes. Lockout still keys off email_hash.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bond_retention') THEN
    CREATE ROLE bond_retention NOLOGIN;
  END IF;
END
$$;

-- PG16+ (Supabase runs 17): a non-superuser that creates a role gets ADMIN on
-- it but not SET or INHERIT, because createrole_self_grant is empty. The
-- ALTER ... OWNER TO bond_retention statements need SET. The later CREATE OR
-- REPLACE, COMMENT, GRANT, REVOKE and DROP on those functions need the
-- owner's privileges, which need INHERIT. Without INHERIT, REVOKE ... FROM
-- PUBLIC on them only warns and leaves EXECUTE open. Grant both to the
-- applying role and to postgres, once. Superusers are skipped.
DO $$
DECLARE
  v_role oid := (SELECT oid FROM pg_roles WHERE rolname = 'bond_retention');
  v_member record;
BEGIN
  FOR v_member IN
    SELECT r.oid, r.rolname
    FROM pg_roles AS r
    WHERE r.rolname IN (current_user, 'postgres')
      AND NOT r.rolsuper
  LOOP
    IF current_setting('server_version_num')::int >= 160000 THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_auth_members AS m
        WHERE m.roleid = v_role AND m.member = v_member.oid
          AND m.set_option AND m.inherit_option
      ) THEN
        EXECUTE format('GRANT bond_retention TO %I WITH SET TRUE, INHERIT TRUE', v_member.rolname);
      END IF;
    ELSIF NOT pg_has_role(v_member.oid, v_role, 'MEMBER') THEN
      EXECUTE format('GRANT bond_retention TO %I', v_member.rolname);
    END IF;
  END LOOP;
END
$$;

GRANT USAGE ON SCHEMA public TO bond_retention;
GRANT SELECT, DELETE ON TABLE public.haus_requests TO bond_retention;
GRANT SELECT, DELETE ON TABLE public.order_requests TO bond_retention;
GRANT SELECT, DELETE ON TABLE public.auth_attempts TO bond_retention;
GRANT SELECT, DELETE ON TABLE public.audit_log TO bond_retention;

REVOKE DELETE ON TABLE public.haus_requests FROM service_role;
REVOKE DELETE ON TABLE public.order_requests FROM service_role;
REVOKE DELETE ON TABLE public.auth_attempts FROM service_role;

-- A delete needs to read the timestamp in its WHERE clause. Postgres applies
-- the select policy to that read, so the job role also has a select policy.
-- The role is NOLOGIN and is not granted to anon or authenticated. The
-- trigger still rejects every other role, including the table owner.
CREATE POLICY haus_requests_retention_select
  ON public.haus_requests
  FOR SELECT
  TO bond_retention
  USING (true);

CREATE POLICY haus_requests_retention_delete
  ON public.haus_requests
  FOR DELETE
  TO bond_retention
  USING (true);

CREATE POLICY order_requests_retention_select
  ON public.order_requests
  FOR SELECT
  TO bond_retention
  USING (true);

CREATE POLICY order_requests_retention_delete
  ON public.order_requests
  FOR DELETE
  TO bond_retention
  USING (true);

CREATE POLICY auth_attempts_retention_select
  ON public.auth_attempts
  FOR SELECT
  TO bond_retention
  USING (true);

CREATE POLICY auth_attempts_retention_delete
  ON public.auth_attempts
  FOR DELETE
  TO bond_retention
  USING (true);

CREATE POLICY audit_log_retention_select
  ON public.audit_log
  FOR SELECT
  TO bond_retention
  USING (true);

CREATE POLICY audit_log_retention_delete
  ON public.audit_log
  FOR DELETE
  TO bond_retention
  USING (true);

COMMENT ON TABLE public.haus_sessions IS
  'Opaque Haus session ids. Membership is the haus_requests row, not the cookie. No anon access.';

CREATE OR REPLACE FUNCTION public.bond_retention_delete_only()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' AND current_user = 'bond_retention' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'retention deletes are limited to the retention job';
END;
$function$;

DROP TRIGGER IF EXISTS haus_requests_retention_delete ON public.haus_requests;
CREATE TRIGGER haus_requests_retention_delete
  BEFORE DELETE ON public.haus_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.bond_retention_delete_only();

DROP TRIGGER IF EXISTS order_requests_retention_delete ON public.order_requests;
CREATE TRIGGER order_requests_retention_delete
  BEFORE DELETE ON public.order_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.bond_retention_delete_only();

DROP TRIGGER IF EXISTS auth_attempts_retention_delete ON public.auth_attempts;
CREATE TRIGGER auth_attempts_retention_delete
  BEFORE DELETE ON public.auth_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.bond_retention_delete_only();

CREATE OR REPLACE FUNCTION public.audit_log_deny_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' AND current_user = 'bond_retention' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_log is append only';
END;
$function$;

DROP TRIGGER IF EXISTS audit_log_no_update ON public.audit_log;
DROP TRIGGER IF EXISTS audit_log_no_delete ON public.audit_log;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_deny_mutation();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_deny_mutation();

REVOKE UPDATE, DELETE ON TABLE public.audit_log FROM PUBLIC;
REVOKE UPDATE, DELETE ON TABLE public.audit_log FROM anon;
REVOKE UPDATE, DELETE ON TABLE public.audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON TABLE public.audit_log FROM service_role;

CREATE OR REPLACE FUNCTION public.bond_purge_haus_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.haus_requests
  WHERE created_at < now() - interval '24 months';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bond_purge_order_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.order_requests
  WHERE created_at < now() - interval '24 months';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bond_purge_auth_attempts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.auth_attempts
  WHERE attempted_at < now() - interval '90 days';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bond_purge_audit_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.audit_log
  WHERE at < now() - interval '24 months';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$function$;

-- A non-superuser can only hand a function to a role that has CREATE on
-- its schema. Grant it for the ownership change only, then take it back.
GRANT CREATE ON SCHEMA public TO bond_retention;
ALTER FUNCTION public.bond_purge_haus_requests() OWNER TO bond_retention;
ALTER FUNCTION public.bond_purge_order_requests() OWNER TO bond_retention;
ALTER FUNCTION public.bond_purge_auth_attempts() OWNER TO bond_retention;
ALTER FUNCTION public.bond_purge_audit_log() OWNER TO bond_retention;
REVOKE CREATE ON SCHEMA public FROM bond_retention;

REVOKE ALL ON FUNCTION public.bond_purge_haus_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_purge_order_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_purge_auth_attempts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_purge_audit_log() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_retention_delete_only() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_purge_haus_requests() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.bond_purge_order_requests() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.bond_purge_auth_attempts() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.bond_purge_audit_log() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bond_purge_haus_requests() TO postgres;
GRANT EXECUTE ON FUNCTION public.bond_purge_order_requests() TO postgres;
GRANT EXECUTE ON FUNCTION public.bond_purge_auth_attempts() TO postgres;
GRANT EXECUTE ON FUNCTION public.bond_purge_audit_log() TO postgres;

-- Canonical retention jobs. The schedule migrations and the guard read this list.
CREATE OR REPLACE FUNCTION public.bond_retention_cron_specs()
RETURNS TABLE (jobname text, schedule text, command text)
LANGUAGE sql
IMMUTABLE
SET search_path TO public, pg_temp
AS $function$
  SELECT *
  FROM (VALUES
    ('bond_purge_haus_requests', '20 4 * * *', 'SELECT public.bond_purge_haus_requests()'),
    ('bond_purge_order_requests', '25 4 * * *', 'SELECT public.bond_purge_order_requests()'),
    ('bond_purge_auth_attempts', '30 4 * * *', 'SELECT public.bond_purge_auth_attempts()'),
    ('bond_purge_audit_log', '35 4 * * *', 'SELECT public.bond_purge_audit_log()'),
    ('bond_purge_dispensary_accounts', '40 4 * * *', 'SELECT public.bond_purge_dispensary_accounts()'),
    ('bond_purge_haus_updates', '45 4 * * *', 'SELECT public.bond_purge_haus_updates()'),
    ('bond_purge_expired_sessions', '50 4 * * *', 'SELECT public.bond_purge_expired_sessions()')
  ) AS spec(jobname, schedule, command);
$function$;

REVOKE ALL ON FUNCTION public.bond_retention_cron_specs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_retention_cron_specs() FROM anon;
REVOKE ALL ON FUNCTION public.bond_retention_cron_specs() FROM authenticated;
REVOKE ALL ON FUNCTION public.bond_retention_cron_specs() FROM service_role;
GRANT EXECUTE ON FUNCTION public.bond_retention_cron_specs() TO postgres;

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
  WHERE specs.jobname = 'bond_purge_haus_requests';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'retention job bond_purge_haus_requests has no canonical definition';
  END IF;
  PERFORM cron.schedule(
    'bond_purge_haus_requests',
    spec.schedule,
    spec.command
  );

  SELECT specs.schedule, specs.command
    INTO spec
  FROM public.bond_retention_cron_specs() AS specs
  WHERE specs.jobname = 'bond_purge_order_requests';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'retention job bond_purge_order_requests has no canonical definition';
  END IF;
  PERFORM cron.schedule(
    'bond_purge_order_requests',
    spec.schedule,
    spec.command
  );

  SELECT specs.schedule, specs.command
    INTO spec
  FROM public.bond_retention_cron_specs() AS specs
  WHERE specs.jobname = 'bond_purge_auth_attempts';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'retention job bond_purge_auth_attempts has no canonical definition';
  END IF;
  PERFORM cron.schedule(
    'bond_purge_auth_attempts',
    spec.schedule,
    spec.command
  );

  SELECT specs.schedule, specs.command
    INTO spec
  FROM public.bond_retention_cron_specs() AS specs
  WHERE specs.jobname = 'bond_purge_audit_log';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'retention job bond_purge_audit_log has no canonical definition';
  END IF;
  PERFORM cron.schedule(
    'bond_purge_audit_log',
    spec.schedule,
    spec.command
  );
END
$cron$;
