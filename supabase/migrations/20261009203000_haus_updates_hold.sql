-- Felix hold on the Bond Haus updates opt-in.
-- DO NOT apply this file to the live project ziruzhhkkndgmdouithb from this PR.
-- Apply after 20261009190000_haus_updates_optin.sql.
--
-- The earlier migration granted anon INSERT with an always-true check.
-- This migration removes that path. Writes go through the functions below.
-- A trigger rejects every other insert, including the table owner and a
-- service role that bypasses row level security.
-- SQL still cannot compute the HMAC. The app passes a 64 hex digest.

ALTER TABLE public.haus_updates
  ADD COLUMN email_hmac text;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.haus_updates WHERE email_hmac IS NULL) THEN
    RAISE EXCEPTION 'haus_updates already has rows. Do not apply this draft over live data.';
  END IF;
END
$guard$;

ALTER TABLE public.haus_updates
  ALTER COLUMN email_hmac SET NOT NULL;

ALTER TABLE public.haus_updates
  ADD CONSTRAINT haus_updates_email_hmac_shape CHECK (email_hmac ~ '^[0-9a-f]{64}$');

ALTER TABLE public.haus_updates
  ADD CONSTRAINT haus_updates_email_hmac_key UNIQUE (email_hmac);

DROP POLICY IF EXISTS haus_updates_anon_insert ON public.haus_updates;

REVOKE ALL ON TABLE public.haus_updates FROM PUBLIC;
REVOKE ALL ON TABLE public.haus_updates FROM anon;
REVOKE ALL ON TABLE public.haus_updates FROM authenticated;
REVOKE ALL ON TABLE public.haus_updates FROM service_role;
GRANT SELECT ON TABLE public.haus_updates TO authenticated;

REVOKE ALL ON TABLE public.haus_updates_suppression FROM PUBLIC;
REVOKE ALL ON TABLE public.haus_updates_suppression FROM anon;
REVOKE ALL ON TABLE public.haus_updates_suppression FROM authenticated;
REVOKE ALL ON TABLE public.haus_updates_suppression FROM service_role;

GRANT USAGE ON SCHEMA public TO bond_retention;
GRANT SELECT, DELETE ON TABLE public.haus_updates TO bond_retention;

DROP POLICY IF EXISTS haus_updates_retention_select ON public.haus_updates;
CREATE POLICY haus_updates_retention_select
  ON public.haus_updates
  FOR SELECT
  TO bond_retention
  USING (true);

DROP POLICY IF EXISTS haus_updates_retention_delete ON public.haus_updates;
CREATE POLICY haus_updates_retention_delete
  ON public.haus_updates
  FOR DELETE
  TO bond_retention
  USING (true);

CREATE OR REPLACE FUNCTION public.haus_updates_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('bond.haus_update_via_function', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'haus_updates writes go through bond_record_haus_update';
  END IF;
  NEW.email := lower(btrim(NEW.email));
  NEW.source := btrim(NEW.source);
  IF NEW.email_hmac IS NULL OR NEW.email_hmac !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'haus_updates email_hmac must be a keyed digest'
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.haus_updates_suppression suppressed
    WHERE suppressed.email_hmac = NEW.email_hmac
  ) THEN
    RAISE EXCEPTION 'haus_updates address is suppressed'
      USING ERRCODE = 'check_violation';
  END IF;
  NEW.confirmed_at := NULL;
  IF NEW.consent_at IS NULL THEN
    NEW.consent_at := now();
  END IF;
  IF EXISTS (SELECT 1 FROM public.haus_updates existing WHERE existing.email = NEW.email) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.haus_updates_suppression_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('bond.haus_update_via_function', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'haus_updates_suppression writes go through bond_unsubscribe_haus_update';
  END IF;
  IF NEW.email_hmac IS NULL OR NEW.email_hmac !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'haus_updates_suppression email_hmac must be a keyed digest'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS haus_updates_suppression_before_insert ON public.haus_updates_suppression;
CREATE TRIGGER haus_updates_suppression_before_insert
  BEFORE INSERT ON public.haus_updates_suppression
  FOR EACH ROW
  EXECUTE FUNCTION public.haus_updates_suppression_before_insert();

CREATE OR REPLACE FUNCTION public.haus_updates_before_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF current_user = 'bond_retention' THEN
    RETURN OLD;
  END IF;
  IF current_setting('bond.haus_update_via_function', true) = '1' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'retention deletes are limited to the retention job';
END;
$function$;

DROP TRIGGER IF EXISTS haus_updates_before_delete ON public.haus_updates;
CREATE TRIGGER haus_updates_before_delete
  BEFORE DELETE ON public.haus_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.haus_updates_before_delete();

CREATE OR REPLACE FUNCTION public.bond_record_haus_update(
  p_email text,
  p_source text,
  p_email_hmac text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  mark text := lower(btrim(COALESCE(p_email, '')));
  origin text := btrim(COALESCE(p_source, ''));
BEGIN
  IF mark !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RETURN false;
  END IF;
  IF origin = '' THEN
    RETURN false;
  END IF;
  IF p_email_hmac IS NULL OR p_email_hmac !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.haus_updates_suppression suppressed
    WHERE suppressed.email_hmac = p_email_hmac
  ) THEN
    RETURN false;
  END IF;
  PERFORM set_config('bond.haus_update_via_function', '1', true);
  BEGIN
    INSERT INTO public.haus_updates (email, source, email_hmac)
    VALUES (mark, origin, p_email_hmac)
    ON CONFLICT (email) DO NOTHING;
  EXCEPTION
    WHEN check_violation OR unique_violation THEN
      RETURN false;
  END;
  RETURN true;
END;
$function$;

DROP FUNCTION IF EXISTS public.bond_unsubscribe_haus_update(text, text);

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
  DELETE FROM public.haus_updates WHERE email_hmac = p_email_hmac;
  INSERT INTO public.haus_updates_suppression (email_hmac)
  VALUES (p_email_hmac)
  ON CONFLICT (email_hmac) DO NOTHING;
  RETURN true;
END;
$function$;

DROP FUNCTION IF EXISTS public.bond_confirm_haus_update(text);

CREATE OR REPLACE FUNCTION public.bond_confirm_haus_update(p_email_hmac text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_email_hmac IS NULL OR p_email_hmac !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;
  UPDATE public.haus_updates
  SET confirmed_at = COALESCE(confirmed_at, now())
  WHERE email_hmac = p_email_hmac
    AND confirmed_at IS NULL;
  RETURN FOUND;
END;
$function$;

CREATE TABLE public.haus_update_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hmac text NOT NULL,
  purpose text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT haus_update_tokens_hmac CHECK (email_hmac ~ '^[0-9a-f]{64}$'),
  CONSTRAINT haus_update_tokens_purpose CHECK (purpose IN ('unsub', 'confirm'))
);

ALTER TABLE public.haus_update_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.haus_update_tokens FROM PUBLIC;
REVOKE ALL ON TABLE public.haus_update_tokens FROM anon;
REVOKE ALL ON TABLE public.haus_update_tokens FROM authenticated;
REVOKE ALL ON TABLE public.haus_update_tokens FROM service_role;

CREATE OR REPLACE FUNCTION public.bond_issue_haus_update_token(
  p_email_hmac text,
  p_purpose text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  issued uuid;
BEGIN
  IF p_email_hmac IS NULL OR p_email_hmac !~ '^[0-9a-f]{64}$' THEN
    RETURN NULL;
  END IF;
  IF p_purpose IS NULL OR p_purpose NOT IN ('unsub', 'confirm') THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.haus_update_tokens (email_hmac, purpose)
  VALUES (p_email_hmac, p_purpose)
  RETURNING id INTO issued;
  RETURN issued;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bond_read_haus_update_token(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $function$
DECLARE
  found jsonb;
BEGIN
  SELECT jsonb_build_object('email_hmac', token.email_hmac, 'purpose', token.purpose)
  INTO found
  FROM public.haus_update_tokens token
  WHERE token.id = p_id;
  RETURN found;
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
  DELETE FROM public.haus_updates
  WHERE GREATEST(consent_at, COALESCE(confirmed_at, consent_at)) < now() - interval '24 months';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$function$;

ALTER FUNCTION public.bond_purge_haus_updates() OWNER TO bond_retention;

REVOKE ALL ON FUNCTION public.haus_updates_before_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.haus_updates_suppression_before_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.haus_updates_before_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_record_haus_update(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_record_haus_update(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.bond_record_haus_update(text, text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.bond_unsubscribe_haus_update(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_unsubscribe_haus_update(text) FROM anon;
REVOKE ALL ON FUNCTION public.bond_unsubscribe_haus_update(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.bond_confirm_haus_update(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_confirm_haus_update(text) FROM anon;
REVOKE ALL ON FUNCTION public.bond_confirm_haus_update(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.bond_issue_haus_update_token(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_issue_haus_update_token(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.bond_issue_haus_update_token(text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.bond_read_haus_update_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_read_haus_update_token(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.bond_read_haus_update_token(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.bond_purge_haus_updates() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_purge_haus_updates() FROM anon;
REVOKE ALL ON FUNCTION public.bond_purge_haus_updates() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.bond_record_haus_update(text, text, text) TO postgres;
GRANT EXECUTE ON FUNCTION public.bond_record_haus_update(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bond_unsubscribe_haus_update(text) TO postgres;
GRANT EXECUTE ON FUNCTION public.bond_unsubscribe_haus_update(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bond_confirm_haus_update(text) TO postgres;
GRANT EXECUTE ON FUNCTION public.bond_confirm_haus_update(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bond_issue_haus_update_token(text, text) TO postgres;
GRANT EXECUTE ON FUNCTION public.bond_issue_haus_update_token(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bond_read_haus_update_token(uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.bond_read_haus_update_token(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bond_purge_haus_updates() TO postgres;
GRANT EXECUTE ON FUNCTION public.bond_purge_haus_updates() TO service_role;

-- Enabling pg_cron is a ship-time step. The schedule is still written here.
DO $cron$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule(
    'bond_purge_haus_updates',
    '45 4 * * *',
    'SELECT public.bond_purge_haus_updates()'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron schedule skipped (%). Enabling pg_cron is a ship-time step for M.', SQLERRM;
END
$cron$;

COMMENT ON TABLE public.haus_updates IS
  'Opt-in Bond Haus updates. Email, consent_at, source, confirmed_at, and email_hmac. Owner read. Writes go through bond_record_haus_update. No anon insert.';

COMMENT ON TABLE public.haus_updates_suppression IS
  'Keyed HMAC of an email removed from Bond Haus updates. Blocks a later insert of that address. No raw email. No anon or authenticated write.';

COMMENT ON TABLE public.haus_update_tokens IS
  'Opaque ids for unsubscribe and confirm links. Stores the email HMAC and the purpose. The URL does not carry the email.';
