-- Read whether a keyed email is on the Haus updates list.
-- DO NOT apply this file to the live project ziruzhhkkndgmdouithb from this PR.
-- Apply after 20261009230000_haus_confirm_token_expiry.sql.
--
-- 20261009203000 revokes service_role on haus_updates and does not grant it
-- back. A direct SELECT fails, and the app must not treat that as
-- "not subscribed". This function is the only read. The table stays locked.

CREATE OR REPLACE FUNCTION public.bond_has_haus_update(p_email_hmac text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.haus_updates AS upd
    WHERE upd.email_hmac = p_email_hmac
  );
$function$;

REVOKE ALL ON FUNCTION public.bond_has_haus_update(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_has_haus_update(text) FROM anon;
REVOKE ALL ON FUNCTION public.bond_has_haus_update(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bond_has_haus_update(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bond_has_haus_update(text) TO postgres;
