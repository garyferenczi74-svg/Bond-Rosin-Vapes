-- Felix ruling. Revoke anon INSERT on the three signup tables.
-- DO NOT apply this file to the live project ziruzhhkkndgmdouithb from this PR.
-- Apply after 20261009203000_haus_updates_hold.sql.
--
-- The app writes these rows with the service role (remote.ts). service_role
-- bypasses row level security, so the old anon policies are not a backstop
-- for that path. The INSERT triggers below keep the same checks. They do not
-- run on UPDATE, so approval and the dispensary purge can still change a row.
-- order_requests already has order_requests_lines_array and
-- order_requests_no_trace, which match its old insert policy.

REVOKE INSERT ON TABLE public.dispensary_accounts FROM PUBLIC;
REVOKE INSERT ON TABLE public.dispensary_accounts FROM anon;
REVOKE INSERT ON TABLE public.dispensary_accounts FROM authenticated;

REVOKE INSERT ON TABLE public.order_requests FROM PUBLIC;
REVOKE INSERT ON TABLE public.order_requests FROM anon;
REVOKE INSERT ON TABLE public.order_requests FROM authenticated;

REVOKE INSERT ON TABLE public.haus_requests FROM PUBLIC;
REVOKE INSERT ON TABLE public.haus_requests FROM anon;
REVOKE INSERT ON TABLE public.haus_requests FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.dispensary_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.order_requests TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.haus_requests TO service_role;

DROP POLICY IF EXISTS dispensary_accounts_anon_insert ON public.dispensary_accounts;
DROP POLICY IF EXISTS order_requests_anon_insert ON public.order_requests;
DROP POLICY IF EXISTS haus_signups_anon_insert ON public.haus_requests;
DROP POLICY IF EXISTS haus_requests_anon_insert ON public.haus_requests;

CREATE OR REPLACE FUNCTION public.dispensary_accounts_insert_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending'
     OR coalesce(length(NEW.password_hash), 0) = 0
     OR coalesce(length(NEW.password_salt), 0) = 0 THEN
    RAISE EXCEPTION 'dispensary registration must be pending with a password hash'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS dispensary_accounts_insert_check ON public.dispensary_accounts;
CREATE TRIGGER dispensary_accounts_insert_check
  BEFORE INSERT ON public.dispensary_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.dispensary_accounts_insert_check();

CREATE OR REPLACE FUNCTION public.haus_requests_insert_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.age21_ack IS DISTINCT FROM true
     OR NEW.age21_ack_at IS NULL
     OR length(btrim(coalesce(NEW.email, ''))) <= 3
     OR length(btrim(coalesce(NEW.requested_dispensary, ''))) < 2 THEN
    RAISE EXCEPTION 'haus request must attest 21+ and name a dispensary'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS haus_requests_insert_check ON public.haus_requests;
CREATE TRIGGER haus_requests_insert_check
  BEFORE INSERT ON public.haus_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.haus_requests_insert_check();

REVOKE ALL ON FUNCTION public.dispensary_accounts_insert_check() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.haus_requests_insert_check() FROM PUBLIC;
