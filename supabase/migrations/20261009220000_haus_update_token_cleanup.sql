-- Felix follow-up. Delete Haus update link ids with the row.
-- DO NOT apply this file to the live project ziruzhhkkndgmdouithb from this PR.
-- Apply after 20261009210000_revoke_anon_signup_inserts.sql.
--
-- Unsubscribe deletes every haus_update_tokens row for that keyed hash.
-- The 24 month purge deletes tokens for the rows it removes, then deletes
-- orphan tokens older than 30 days. A token with no row stays for 30 days
-- so an unsubscribe link can still be used after a send. No sends exist yet.
-- No INSERT grant for anon or authenticated.

CREATE OR REPLACE FUNCTION public.bond_unsubscribe_haus_update(p_email_hmac text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_email_hmac IS NULL OR p_email_hmac !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;
  PERFORM set_config('bond.haus_update_via_function', '1', true);
  DELETE FROM public.haus_update_tokens WHERE email_hmac = p_email_hmac;
  DELETE FROM public.haus_updates WHERE email_hmac = p_email_hmac;
  INSERT INTO public.haus_updates_suppression (email_hmac)
  VALUES (p_email_hmac)
  ON CONFLICT (email_hmac) DO NOTHING;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bond_purge_haus_updates()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.haus_update_tokens AS token
  USING public.haus_updates AS upd
  WHERE token.email_hmac = upd.email_hmac
    AND GREATEST(upd.consent_at, COALESCE(upd.confirmed_at, upd.consent_at)) < now() - interval '24 months';

  DELETE FROM public.haus_updates
  WHERE GREATEST(consent_at, COALESCE(confirmed_at, consent_at)) < now() - interval '24 months';
  GET DIAGNOSTICS removed = ROW_COUNT;

  DELETE FROM public.haus_update_tokens AS token
  WHERE token.created_at < now() - interval '30 days'
    AND NOT EXISTS (
      SELECT 1
      FROM public.haus_updates AS upd
      WHERE upd.email_hmac = token.email_hmac
    );

  RETURN removed;
END;
$function$;

ALTER FUNCTION public.bond_purge_haus_updates() OWNER TO bond_retention;

GRANT USAGE ON SCHEMA public TO bond_retention;
GRANT SELECT, DELETE ON TABLE public.haus_update_tokens TO bond_retention;

DROP POLICY IF EXISTS haus_update_tokens_retention_select ON public.haus_update_tokens;
CREATE POLICY haus_update_tokens_retention_select
  ON public.haus_update_tokens
  FOR SELECT
  TO bond_retention
  USING (true);

DROP POLICY IF EXISTS haus_update_tokens_retention_delete ON public.haus_update_tokens;
CREATE POLICY haus_update_tokens_retention_delete
  ON public.haus_update_tokens
  FOR DELETE
  TO bond_retention
  USING (true);

REVOKE INSERT ON TABLE public.haus_updates FROM PUBLIC;
REVOKE INSERT ON TABLE public.haus_updates FROM anon;
REVOKE INSERT ON TABLE public.haus_updates FROM authenticated;
REVOKE INSERT ON TABLE public.haus_updates_suppression FROM PUBLIC;
REVOKE INSERT ON TABLE public.haus_updates_suppression FROM anon;
REVOKE INSERT ON TABLE public.haus_updates_suppression FROM authenticated;
REVOKE INSERT ON TABLE public.haus_update_tokens FROM PUBLIC;
REVOKE INSERT ON TABLE public.haus_update_tokens FROM anon;
REVOKE INSERT ON TABLE public.haus_update_tokens FROM authenticated;

REVOKE ALL ON FUNCTION public.bond_unsubscribe_haus_update(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_unsubscribe_haus_update(text) FROM anon;
REVOKE ALL ON FUNCTION public.bond_unsubscribe_haus_update(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.bond_purge_haus_updates() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_purge_haus_updates() FROM anon;
REVOKE ALL ON FUNCTION public.bond_purge_haus_updates() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.bond_unsubscribe_haus_update(text) TO postgres;
GRANT EXECUTE ON FUNCTION public.bond_unsubscribe_haus_update(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bond_purge_haus_updates() TO postgres;
GRANT EXECUTE ON FUNCTION public.bond_purge_haus_updates() TO service_role;
