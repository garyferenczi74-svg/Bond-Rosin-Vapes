-- Bind a Haus re-opt-in to the session hash, and grant session tables explicitly.
-- DO NOT apply this file to the live project ziruzhhkkndgmdouithb from this PR.
-- Apply after 20261009234000_haus_update_reopt.sql.
-- Live has neither haus_sessions nor dispensary_sessions yet. Those tables
-- are created in 20261008193000_server_side_signups.sql. This file is ordered
-- after that create and after the re-opt function.
--
-- The HMAC key stays in the app. Sign-in writes email_hmac on haus_sessions
-- with hashLockoutValue of that same email. bond_reopt_haus_update accepts a
-- hash only when an unexpired session for that email already stores it.
-- A mismatched email and hash writes nothing.
--
-- service_role receives only the privileges the server uses. anon,
-- authenticated, and public receive none. Do not rely on Supabase defaults.

ALTER TABLE public.haus_sessions
  ADD COLUMN email_hmac text;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.haus_sessions WHERE email_hmac IS NULL) THEN
    RAISE EXCEPTION 'haus_sessions already has rows. Do not apply this draft over live data.';
  END IF;
END
$guard$;

ALTER TABLE public.haus_sessions
  ALTER COLUMN email_hmac SET NOT NULL;

ALTER TABLE public.haus_sessions
  ADD CONSTRAINT haus_sessions_email_hmac_shape CHECK (email_hmac ~ '^[0-9a-f]{64}$');

COMMENT ON COLUMN public.haus_sessions.email_hmac IS
  'Keyed HMAC of this session email, written at sign-in. bond_reopt_haus_update accepts a hash only when it equals this column.';

DROP POLICY IF EXISTS haus_sessions_owner_select ON public.haus_sessions;
DROP POLICY IF EXISTS dispensary_sessions_owner_select ON public.dispensary_sessions;

REVOKE ALL ON TABLE public.haus_sessions FROM PUBLIC;
REVOKE ALL ON TABLE public.haus_sessions FROM anon;
REVOKE ALL ON TABLE public.haus_sessions FROM authenticated;
REVOKE ALL ON TABLE public.haus_sessions FROM service_role;

REVOKE ALL ON TABLE public.dispensary_sessions FROM PUBLIC;
REVOKE ALL ON TABLE public.dispensary_sessions FROM anon;
REVOKE ALL ON TABLE public.dispensary_sessions FROM authenticated;
REVOKE ALL ON TABLE public.dispensary_sessions FROM service_role;

GRANT SELECT, INSERT, DELETE ON TABLE public.haus_sessions TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.dispensary_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.bond_reopt_haus_update(p_email text, p_email_hmac text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  mark text := lower(btrim(COALESCE(p_email, '')));
  bound text;
BEGIN
  IF mark !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RETURN false;
  END IF;
  IF p_email_hmac IS NULL OR p_email_hmac !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;
  SELECT sess.email_hmac
  INTO bound
  FROM public.haus_sessions AS sess
  WHERE lower(btrim(sess.email)) = mark
    AND sess.expires_at > now()
    AND sess.email_hmac = p_email_hmac
  LIMIT 1;
  IF bound IS NULL OR bound IS DISTINCT FROM p_email_hmac THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.haus_requests AS req
    WHERE lower(btrim(req.email)) = mark
      AND req.age21_ack IS TRUE
  ) THEN
    RETURN false;
  END IF;

  PERFORM set_config('bond.haus_update_via_function', '1', true);
  DELETE FROM public.haus_updates_suppression WHERE email_hmac = bound;
  DELETE FROM public.haus_updates WHERE email = mark OR email_hmac = bound;
  INSERT INTO public.haus_updates (email, source, email_hmac, consent_at)
  VALUES (mark, 'salon', bound, now());

  INSERT INTO public.audit_log (action, target, before, after)
  VALUES (
    'haus_updates.reopt',
    bound,
    jsonb_build_object('suppressed', true),
    jsonb_build_object('suppressed', false, 'source', 'salon')
  );

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.bond_reopt_haus_update(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_reopt_haus_update(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.bond_reopt_haus_update(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bond_reopt_haus_update(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bond_reopt_haus_update(text, text) TO postgres;
