-- Owner-only reads for signup records. JB and Gary: Gary sees the records
-- in /vauxhall, owner only.
--
-- Does not replace the admin helper. Policies on other tables stay as they
-- are. A Haus member can still read the row whose email matches the JWT.
-- DO NOT apply this file to the live project ziruzhhkkndgmdouithb from this PR.

CREATE OR REPLACE FUNCTION public.is_owner()
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
      AND a.role = 'owner'
  )
$function$;

COMMENT ON FUNCTION public.is_owner() IS
  'SECURITY DEFINER. True only for an active owner row in public.admins. Signup record reads. Does not replace the admin helper. Never reads user_metadata.';

REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_owner() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO postgres;
GRANT EXECUTE ON FUNCTION public.is_owner() TO service_role;

DROP POLICY IF EXISTS haus_requests_member_or_admin_select ON public.haus_requests;

CREATE POLICY haus_requests_member_or_owner_select
  ON public.haus_requests
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR public.is_owner()
  );

DROP POLICY IF EXISTS dispensary_accounts_owner_select ON public.dispensary_accounts;

CREATE POLICY dispensary_accounts_owner_select
  ON public.dispensary_accounts
  FOR SELECT
  TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS order_requests_owner_select ON public.order_requests;

CREATE POLICY order_requests_owner_select
  ON public.order_requests
  FOR SELECT
  TO authenticated
  USING (public.is_owner());
