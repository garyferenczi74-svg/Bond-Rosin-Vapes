-- A signed-in member can opt back in after unsubscribing.
-- DO NOT apply this file to the live project ziruzhhkkndgmdouithb from this PR.
-- Apply after 20261009233000_bond_has_haus_update.sql.
--
-- Only this function clears haus_updates_suppression. It runs for the
-- session email, requires that email's 21+ haus_requests row, writes a new
-- haus_updates row with source salon, and logs the lift by keyed hash only.
-- The door, an email link, anon, and authenticated cannot call it.
-- The haus_updates table stays revoked from service_role.

CREATE OR REPLACE FUNCTION public.bond_reopt_haus_update(
  p_email text,
  p_email_hmac text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  mark text := lower(btrim(COALESCE(p_email, '')));
BEGIN
  IF mark !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RETURN false;
  END IF;
  IF p_email_hmac IS NULL OR p_email_hmac !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.haus_sessions AS sess
    WHERE lower(btrim(sess.email)) = mark
      AND sess.expires_at > now()
  ) THEN
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
  DELETE FROM public.haus_updates_suppression WHERE email_hmac = p_email_hmac;
  DELETE FROM public.haus_updates WHERE email = mark OR email_hmac = p_email_hmac;
  INSERT INTO public.haus_updates (email, source, email_hmac, consent_at)
  VALUES (mark, 'salon', p_email_hmac, now());

  INSERT INTO public.audit_log (action, target, before, after)
  VALUES (
    'haus_updates.reopt',
    p_email_hmac,
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
