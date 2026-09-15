-- Phase 1 access shell. No marketing data deletes.
-- Project: ziruzhhkkndgmdouithb (Bond-Rosin-Vapes)

-- 1. is_admin reads the admins table plus AAL2. Never user_metadata.
--    JWT role = admin was a false claim (Supabase sets role to authenticated).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.admins a
    WHERE a.user_id = auth.uid()
      AND a.status = 'active'
      AND a.role IN ('owner', 'operator')
  )
  AND coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$function$;

COMMENT ON FUNCTION public.is_admin() IS
  'SECURITY DEFINER. True only for an active owner or operator with AAL2. Used by RLS. EXECUTE granted to authenticated for policy evaluation. Revoked from anon.';

CREATE OR REPLACE FUNCTION public.admin_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT a.role
  FROM public.admins a
  WHERE a.user_id = auth.uid()
    AND a.status = 'active'
    AND a.role IN ('owner', 'operator')
    AND coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  LIMIT 1
$function$;

COMMENT ON FUNCTION public.admin_role() IS
  'SECURITY DEFINER. Returns owner or operator for an AAL2 admin session. Null otherwise.';

CREATE OR REPLACE FUNCTION public.mark_admin_mfa_enrolled()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.admins
  SET mfa_enrolled = true
  WHERE user_id = auth.uid()
    AND status = 'active';
END;
$function$;

COMMENT ON FUNCTION public.mark_admin_mfa_enrolled() IS
  'SECURITY DEFINER. Sets mfa_enrolled on the caller admin row only.';

-- 2. Grants: anon cannot execute definers. authenticated may call is_admin for RLS.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO postgres;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

REVOKE ALL ON FUNCTION public.admin_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_role() TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_role() TO service_role;

REVOKE ALL ON FUNCTION public.mark_admin_mfa_enrolled() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_admin_mfa_enrolled() FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_admin_mfa_enrolled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_admin_mfa_enrolled() TO postgres;
GRANT EXECUTE ON FUNCTION public.mark_admin_mfa_enrolled() TO service_role;

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO postgres;

-- 3. Table grants. Anon has no admin surface. Audit is insert plus select only.
REVOKE ALL ON TABLE public.admins FROM PUBLIC;
REVOKE ALL ON TABLE public.admins FROM anon;
REVOKE ALL ON TABLE public.admins FROM authenticated;
GRANT SELECT ON TABLE public.admins TO authenticated;

REVOKE ALL ON TABLE public.audit_log FROM PUBLIC;
REVOKE ALL ON TABLE public.audit_log FROM anon;
REVOKE ALL ON TABLE public.audit_log FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_log TO authenticated;

-- 4. Self-read of the caller admin row so Haus can route before AAL2.
DROP POLICY IF EXISTS "admins read admins" ON public.admins;
DROP POLICY IF EXISTS admins_self_select ON public.admins;
DROP POLICY IF EXISTS admins_aal2_select ON public.admins;

CREATE POLICY admins_self_select
  ON public.admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND status = 'active');

CREATE POLICY admins_aal2_select
  ON public.admins
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 5. Audit log: who, what, before, after, when, from where.
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS user_agent text;

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS path text;

COMMENT ON TABLE public.audit_log IS
  'Append only. who=actor, what=action+target, before, after, when=at, from where=ip+user_agent+path.';

DROP POLICY IF EXISTS "admins insert audit" ON public.audit_log;
DROP POLICY IF EXISTS "admins read audit" ON public.audit_log;
DROP POLICY IF EXISTS audit_insert_admin ON public.audit_log;
DROP POLICY IF EXISTS audit_select_admin ON public.audit_log;

CREATE POLICY audit_insert_admin
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND actor = auth.uid());

CREATE POLICY audit_select_admin
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.audit_log_deny_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
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

REVOKE ALL ON FUNCTION public.audit_log_deny_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_log_deny_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.audit_log_deny_mutation() FROM authenticated;

-- 6. Sign-in lockout stub. Failed attempts before a session exists.
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_hash text NOT NULL,
  ip text,
  outcome text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.auth_attempts IS
  'Phase 1 lockout stub. Writes go through record_auth_attempt. No direct client grants.';

REVOKE ALL ON TABLE public.auth_attempts FROM PUBLIC;
REVOKE ALL ON TABLE public.auth_attempts FROM anon;
REVOKE ALL ON TABLE public.auth_attempts FROM authenticated;

CREATE OR REPLACE FUNCTION public.record_auth_attempt(
  p_email text,
  p_ip text,
  p_outcome text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hash text;
  v_fails int;
  v_locked int;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN jsonb_build_object('allowed', false, 'locked', false);
  END IF;

  v_hash := encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex');

  SELECT count(*) INTO v_locked
  FROM public.auth_attempts
  WHERE email_hash = v_hash
    AND outcome = 'lockout'
    AND attempted_at > now() - interval '30 minutes';

  IF v_locked > 0 AND p_outcome <> 'lockout' THEN
    INSERT INTO public.auth_attempts (email_hash, ip, outcome)
    VALUES (v_hash, p_ip, 'blocked');
    RETURN jsonb_build_object('allowed', false, 'locked', true);
  END IF;

  INSERT INTO public.auth_attempts (email_hash, ip, outcome)
  VALUES (v_hash, p_ip, p_outcome);

  IF p_outcome IN ('fail', 'blocked') THEN
    SELECT count(*) INTO v_fails
    FROM public.auth_attempts
    WHERE email_hash = v_hash
      AND outcome IN ('fail', 'blocked')
      AND attempted_at > now() - interval '15 minutes';

    IF v_fails >= 5 THEN
      INSERT INTO public.auth_attempts (email_hash, ip, outcome)
      VALUES (v_hash, p_ip, 'lockout');
      RETURN jsonb_build_object('allowed', false, 'locked', true);
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', p_outcome NOT IN ('fail', 'blocked', 'lockout'), 'locked', false);
END;
$function$;

COMMENT ON FUNCTION public.record_auth_attempt(text, text, text) IS
  'SECURITY DEFINER lockout stub. 5 fails in 15 minutes lock 30 minutes. Alerting is documented, not wired.';

REVOKE ALL ON FUNCTION public.record_auth_attempt(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_auth_attempt(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.record_auth_attempt(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_auth_attempt(text, text, text) TO postgres;
GRANT EXECUTE ON FUNCTION public.record_auth_attempt(text, text, text) TO service_role;

-- 7. Intentional deny-all remains on marketing support tables.
ALTER TABLE public.ny_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_runs ENABLE ROW LEVEL SECURITY;
