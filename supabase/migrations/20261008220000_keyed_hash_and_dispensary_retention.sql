-- Felix Pre-Check HOLD, rulings b and c.
--
-- Legacy auth_attempts rows: DELETE them. Do not null them and do not backfill.
-- The lockout window is short. SQL cannot compute HMAC-SHA256 without
-- BOND_HASH_KEY, so the old unsalted sha256 digests and any leftover raw IP
-- values cannot be rewritten into the new form.
--
-- Dispensary contact fields are cleared 24 months after the later of closed_at
-- and last_active_at. The dispensary name and OCM license stay.

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
  v_ip text;
  v_fails int;
  v_locked int;
BEGIN
  -- The app sends HMAC-SHA256 hex. This function stores that digest. It does not hash.
  v_hash := lower(btrim(coalesce(p_email, '')));
  IF v_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('allowed', false, 'locked', true);
  END IF;

  IF p_ip IS NULL OR length(btrim(p_ip)) = 0 THEN
    v_ip := '';
  ELSIF lower(btrim(p_ip)) ~ '^[0-9a-f]{64}$' THEN
    v_ip := lower(btrim(p_ip));
  ELSE
    RETURN jsonb_build_object('allowed', false, 'locked', true);
  END IF;

  SELECT count(*) INTO v_locked
  FROM public.auth_attempts
  WHERE email_hash = v_hash
    AND outcome = 'lockout'
    AND attempted_at > now() - interval '30 minutes';

  IF p_outcome = 'check' THEN
    RETURN jsonb_build_object('allowed', v_locked = 0, 'locked', v_locked > 0);
  END IF;

  IF v_locked > 0 AND p_outcome <> 'lockout' THEN
    INSERT INTO public.auth_attempts (email_hash, ip_hash, outcome)
    VALUES (v_hash, v_ip, 'blocked');
    RETURN jsonb_build_object('allowed', false, 'locked', true);
  END IF;

  INSERT INTO public.auth_attempts (email_hash, ip_hash, outcome)
  VALUES (v_hash, v_ip, p_outcome);

  IF p_outcome IN ('fail', 'blocked') THEN
    SELECT count(*) INTO v_fails
    FROM public.auth_attempts
    WHERE email_hash = v_hash
      AND outcome IN ('fail', 'blocked')
      AND attempted_at > now() - interval '15 minutes';

    IF v_fails >= 5 THEN
      INSERT INTO public.auth_attempts (email_hash, ip_hash, outcome)
      VALUES (v_hash, v_ip, 'lockout');
      RETURN jsonb_build_object('allowed', false, 'locked', true);
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', p_outcome NOT IN ('fail', 'blocked', 'lockout'), 'locked', false);
END;
$function$;

COMMENT ON FUNCTION public.record_auth_attempt(text, text, text) IS
  'SECURITY DEFINER lockout. Email and IP are HMAC-SHA256 hex from the app (BOND_HASH_KEY). SQL stores the digest and does not hash. 5 fails in 15 minutes lock 30 minutes. Lockout still keys off email_hash.';

COMMENT ON COLUMN public.auth_attempts.ip_hash IS
  'HMAC-SHA256 hex of lower(trim(ip)), keyed with server-only BOND_HASH_KEY. Empty string when no address was supplied. Not a raw IP.';

COMMENT ON COLUMN public.auth_attempts.email_hash IS
  'HMAC-SHA256 hex of lower(trim(email)), keyed with server-only BOND_HASH_KEY. Not a raw email.';

-- One-shot delete of pre-HMAC rows. Owned by bond_retention so the delete trigger allows it.
CREATE OR REPLACE FUNCTION public.bond_drop_legacy_auth_attempts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.auth_attempts;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$function$;

ALTER FUNCTION public.bond_drop_legacy_auth_attempts() OWNER TO bond_retention;
REVOKE ALL ON FUNCTION public.bond_drop_legacy_auth_attempts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bond_drop_legacy_auth_attempts() TO postgres;

SELECT public.bond_drop_legacy_auth_attempts();

DROP FUNCTION public.bond_drop_legacy_auth_attempts();

ALTER TABLE public.dispensary_accounts
  ADD COLUMN last_active_at timestamptz,
  ADD COLUMN closed_at timestamptz;

UPDATE public.dispensary_accounts
SET last_active_at = COALESCE(updated_at, created_at)
WHERE last_active_at IS NULL;

UPDATE public.dispensary_accounts
SET closed_at = COALESCE(updated_at, created_at)
WHERE status = 'rejected'
  AND closed_at IS NULL;

ALTER TABLE public.dispensary_accounts
  ALTER COLUMN last_active_at SET DEFAULT now(),
  ALTER COLUMN last_active_at SET NOT NULL;

COMMENT ON COLUMN public.dispensary_accounts.last_active_at IS
  'Last sign-in or request activity. The app sets this. Contact retention uses the later of this and closed_at.';

COMMENT ON COLUMN public.dispensary_accounts.closed_at IS
  'Set when status becomes rejected. Contact retention uses the later of this and last_active_at.';

CREATE OR REPLACE FUNCTION public.dispensary_accounts_mark_closed()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'rejected' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'rejected') THEN
    IF NEW.closed_at IS NULL THEN
      NEW.closed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS dispensary_accounts_mark_closed ON public.dispensary_accounts;
CREATE TRIGGER dispensary_accounts_mark_closed
  BEFORE INSERT OR UPDATE ON public.dispensary_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.dispensary_accounts_mark_closed();

GRANT SELECT ON TABLE public.dispensary_accounts TO bond_retention;
GRANT UPDATE (
  contact_name,
  phone,
  address,
  email,
  password_hash,
  password_salt
) ON TABLE public.dispensary_accounts TO bond_retention;

DROP POLICY IF EXISTS dispensary_accounts_retention_select ON public.dispensary_accounts;
CREATE POLICY dispensary_accounts_retention_select
  ON public.dispensary_accounts
  FOR SELECT
  TO bond_retention
  USING (true);

DROP POLICY IF EXISTS dispensary_accounts_retention_update ON public.dispensary_accounts;
CREATE POLICY dispensary_accounts_retention_update
  ON public.dispensary_accounts
  FOR UPDATE
  TO bond_retention
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.bond_purge_dispensary_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  removed integer;
BEGIN
  UPDATE public.dispensary_accounts
  SET
    contact_name = '',
    phone = '',
    address = '',
    email = id::text || '@redacted.invalid',
    password_hash = '',
    password_salt = ''
  WHERE GREATEST(last_active_at, COALESCE(closed_at, last_active_at)) < now() - interval '24 months'
    AND email NOT LIKE '%@redacted.invalid';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$function$;

ALTER FUNCTION public.bond_purge_dispensary_accounts() OWNER TO bond_retention;
REVOKE ALL ON FUNCTION public.bond_purge_dispensary_accounts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_purge_dispensary_accounts() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bond_purge_dispensary_accounts() TO postgres;

COMMENT ON FUNCTION public.bond_purge_dispensary_accounts() IS
  'Clears dispensary contact fields 24 months after the later of closed_at and last_active_at. Keeps dispensary_name and ocm_license.';

COMMENT ON TABLE public.order_requests IS
  'Wholesale request data only. No payment, hold, allocation, or reservation state. Not sent to Metrc. Deleted after 24 months by bond_retention. Felix approved that period.';

COMMENT ON TABLE public.dispensary_accounts IS
  'Licensed dispensary sign-ups. Status is server-owned. Anon may insert only as pending. Owner read. Not sent to Metrc. Contact fields are cleared 24 months after the later of closed_at and last_active_at. The business name and license number stay.';

-- A missing pg_cron install is the only skip. cron.schedule errors fail this migration.
DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron schedule skipped (%). Enabling pg_cron is a ship-time step for M.',
      'pg_cron is not installed';
    RETURN;
  END IF;
  PERFORM cron.schedule(
    'bond_purge_dispensary_accounts',
    '40 4 * * *',
    'SELECT public.bond_purge_dispensary_accounts()'
  );
END
$cron$;
