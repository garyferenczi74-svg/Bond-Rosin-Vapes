-- Bond-Rosin-Vapes P1 hardening. No data deletes.
-- Run in the Supabase SQL editor on project ziruzhhkkndgmdouithb
-- if this file is not applied through the CLI.

-- F-2026-09-15-04: revoke EXECUTE on SECURITY DEFINER functions from public roles.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO postgres;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO postgres;

-- F-2026-09-15-05: keep RLS on. No anon or authenticated policies.
-- Access is service_role only. service_role bypasses RLS. Do not add
-- public SELECT until Phase 1 names an intentional read model.
ALTER TABLE public.ny_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_runs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ny_cities IS
  'Service role only. RLS enabled with no anon or authenticated policies by design.';
COMMENT ON TABLE public.reserve_runs IS
  'Service role only. RLS enabled with no anon or authenticated policies by design.';
COMMENT ON FUNCTION public.is_admin() IS
  'SECURITY DEFINER. EXECUTE granted to postgres and service_role only.';
COMMENT ON FUNCTION public.rls_auto_enable() IS
  'Event trigger helper. EXECUTE granted to postgres only. Not callable by anon or authenticated.';
