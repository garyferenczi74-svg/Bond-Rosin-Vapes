-- Server-side dispensary accounts, order requests, and Haus sign-ups.
-- DO NOT apply this file to the live project ziruzhhkkndgmdouithb from this PR.
-- M applies it at ship time, after Felix, Vesper, and Gary.
--
-- Passwords stay scrypt in the application (node:crypto, N=4096, r=8, p=1,
-- 16-byte salt, 32-byte hash), not in Supabase Auth. Dispensary accounts must
-- be able to sit at pending until Bond operations approves them. Haus sign-ups
-- have no password. Staff sign-in stays on auth.users and public.admins.
-- Nothing in these tables is written to Metrc.

CREATE OR REPLACE FUNCTION public.is_signup_owner()
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

COMMENT ON FUNCTION public.is_signup_owner() IS
  'SECURITY DEFINER. True only for an active owner row in public.admins. Does not require AAL2 while admin MFA is on hold. Never reads user_metadata.';

REVOKE ALL ON FUNCTION public.is_signup_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_signup_owner() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_signup_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_signup_owner() TO postgres;
GRANT EXECUTE ON FUNCTION public.is_signup_owner() TO service_role;

CREATE TABLE public.dispensary_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensary_name text NOT NULL,
  address text NOT NULL,
  contact_name text NOT NULL,
  phone text NOT NULL,
  ocm_license text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  age21_ack_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispensary_accounts_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT dispensary_accounts_email_unique UNIQUE (email),
  CONSTRAINT dispensary_accounts_license_unique UNIQUE (ocm_license)
);

COMMENT ON TABLE public.dispensary_accounts IS
  'Licensed dispensary sign-ups. Status is server-owned. Anon may insert only as pending. Owner read. Not sent to Metrc.';

CREATE TABLE public.dispensary_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.dispensary_accounts (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dispensary_sessions IS
  'Opaque dispensary session ids. The browser cookie holds only a signed id. No anon access.';

CREATE TABLE public.order_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensary_account_id uuid NOT NULL REFERENCES public.dispensary_accounts (id) ON DELETE CASCADE,
  lines jsonb NOT NULL,
  promised_on text NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_requests_lines_array CHECK (jsonb_typeof(lines) = 'array'),
  CONSTRAINT order_requests_no_trace CHECK (position('metrc' in lower(lines::text)) = 0)
);

COMMENT ON TABLE public.order_requests IS
  'Dispensary order requests. Linked to dispensary_accounts. No trace identifiers. Not sent to Metrc.';

CREATE TABLE public.haus_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  age21_ack_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.haus_signups IS
  'Haus sign-ups: email and the time the 21+ acknowledgement was stored. Owner read. Not sent to Metrc.';

CREATE TABLE public.haus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  signup_id uuid REFERENCES public.haus_signups (id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.haus_sessions IS
  'Opaque Haus session ids. Membership is the haus_signups row, not the cookie. No anon access.';

ALTER TABLE public.dispensary_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispensary_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haus_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haus_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.dispensary_accounts FROM PUBLIC;
REVOKE ALL ON TABLE public.dispensary_accounts FROM anon;
REVOKE ALL ON TABLE public.dispensary_accounts FROM authenticated;
GRANT INSERT ON TABLE public.dispensary_accounts TO anon;
GRANT SELECT ON TABLE public.dispensary_accounts TO authenticated;

REVOKE ALL ON TABLE public.order_requests FROM PUBLIC;
REVOKE ALL ON TABLE public.order_requests FROM anon;
REVOKE ALL ON TABLE public.order_requests FROM authenticated;
GRANT INSERT ON TABLE public.order_requests TO anon;
GRANT SELECT ON TABLE public.order_requests TO authenticated;

REVOKE ALL ON TABLE public.haus_signups FROM PUBLIC;
REVOKE ALL ON TABLE public.haus_signups FROM anon;
REVOKE ALL ON TABLE public.haus_signups FROM authenticated;
GRANT INSERT ON TABLE public.haus_signups TO anon;
GRANT SELECT ON TABLE public.haus_signups TO authenticated;

REVOKE ALL ON TABLE public.dispensary_sessions FROM PUBLIC;
REVOKE ALL ON TABLE public.dispensary_sessions FROM anon;
REVOKE ALL ON TABLE public.dispensary_sessions FROM authenticated;
GRANT SELECT ON TABLE public.dispensary_sessions TO authenticated;

REVOKE ALL ON TABLE public.haus_sessions FROM PUBLIC;
REVOKE ALL ON TABLE public.haus_sessions FROM anon;
REVOKE ALL ON TABLE public.haus_sessions FROM authenticated;
GRANT SELECT ON TABLE public.haus_sessions TO authenticated;

CREATE POLICY dispensary_accounts_anon_insert
  ON public.dispensary_accounts
  FOR INSERT
  TO anon
  WITH CHECK (status = 'pending' AND length(password_hash) > 0 AND length(password_salt) > 0);

CREATE POLICY dispensary_accounts_owner_select
  ON public.dispensary_accounts
  FOR SELECT
  TO authenticated
  USING (public.is_signup_owner());

CREATE POLICY order_requests_anon_insert
  ON public.order_requests
  FOR INSERT
  TO anon
  WITH CHECK (jsonb_typeof(lines) = 'array' AND position('metrc' in lower(lines::text)) = 0);

CREATE POLICY order_requests_owner_select
  ON public.order_requests
  FOR SELECT
  TO authenticated
  USING (public.is_signup_owner());

CREATE POLICY haus_signups_anon_insert
  ON public.haus_signups
  FOR INSERT
  TO anon
  WITH CHECK (length(trim(email)) > 3 AND age21_ack_at IS NOT NULL);

CREATE POLICY haus_signups_owner_select
  ON public.haus_signups
  FOR SELECT
  TO authenticated
  USING (public.is_signup_owner());

CREATE POLICY dispensary_sessions_owner_select
  ON public.dispensary_sessions
  FOR SELECT
  TO authenticated
  USING (public.is_signup_owner());

CREATE POLICY haus_sessions_owner_select
  ON public.haus_sessions
  FOR SELECT
  TO authenticated
  USING (public.is_signup_owner());

CREATE OR REPLACE FUNCTION public.order_requests_require_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user = 'anon' AND NOT EXISTS (
    SELECT 1
    FROM public.dispensary_accounts a
    WHERE a.id = NEW.dispensary_account_id
      AND a.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'order request requires an approved account';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.order_requests_require_approved() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.order_requests_require_approved() FROM anon;
REVOKE ALL ON FUNCTION public.order_requests_require_approved() FROM authenticated;

CREATE TRIGGER order_requests_require_approved
  BEFORE INSERT ON public.order_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.order_requests_require_approved();
