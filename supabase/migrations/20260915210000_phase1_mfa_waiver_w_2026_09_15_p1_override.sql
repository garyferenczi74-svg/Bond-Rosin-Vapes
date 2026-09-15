-- Waiver W-2026-09-15-P1-OVERRIDE.
-- Phase 1 password-only admin entry. MFA enroll is not required.
-- is_admin still reads public.admins only. Never user_metadata.

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
$function$;

COMMENT ON FUNCTION public.is_admin() IS
  'SECURITY DEFINER. True for an active owner or operator in public.admins. Waiver W-2026-09-15-P1-OVERRIDE removes the AAL2 requirement. Never reads user_metadata. EXECUTE granted to authenticated for policy evaluation. Revoked from anon.';

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
  LIMIT 1
$function$;

COMMENT ON FUNCTION public.admin_role() IS
  'SECURITY DEFINER. Returns owner or operator for an active admin session. Waiver W-2026-09-15-P1-OVERRIDE removes the AAL2 requirement. Null otherwise.';
