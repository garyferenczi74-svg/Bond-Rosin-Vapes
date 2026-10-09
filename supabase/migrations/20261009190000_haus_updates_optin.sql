-- Bond Haus updates opt-in. Draft only.
-- DO NOT apply this file to the live project ziruzhhkkndgmdouithb from this PR.
-- Apply after 20261008213000_owner_only_signup_reads.sql so is_owner() exists.
--
-- haus_updates keeps email, consent time, source, and a confirmation time.
-- haus_updates_suppression keeps only a keyed HMAC of an unsubscribed email.
-- The HMAC is computed in the app with BOND_HASH_KEY. SQL cannot compute it.
-- Server writes go through the functions below (service role). Direct anon
-- insert remains for the insert policy. The function rejects a suppressed HMAC.

CREATE TABLE public.haus_updates (
  email text PRIMARY KEY,
  consent_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  confirmed_at timestamptz,
  CONSTRAINT haus_updates_email_shape CHECK (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  CONSTRAINT haus_updates_source_present CHECK (char_length(btrim(source)) > 0)
);

CREATE TABLE public.haus_updates_suppression (
  email_hmac text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT haus_updates_suppression_hmac CHECK (email_hmac ~ '^[0-9a-f]{64}$')
);

CREATE OR REPLACE FUNCTION public.haus_updates_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  NEW.source := btrim(NEW.source);
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

DROP TRIGGER IF EXISTS haus_updates_before_insert ON public.haus_updates;
CREATE TRIGGER haus_updates_before_insert
  BEFORE INSERT ON public.haus_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.haus_updates_before_insert();

ALTER TABLE public.haus_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haus_updates_suppression ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.haus_updates FROM PUBLIC;
REVOKE ALL ON TABLE public.haus_updates FROM anon;
REVOKE ALL ON TABLE public.haus_updates FROM authenticated;
GRANT INSERT ON TABLE public.haus_updates TO anon;
GRANT SELECT ON TABLE public.haus_updates TO authenticated;

REVOKE ALL ON TABLE public.haus_updates_suppression FROM PUBLIC;
REVOKE ALL ON TABLE public.haus_updates_suppression FROM anon;
REVOKE ALL ON TABLE public.haus_updates_suppression FROM authenticated;

DROP POLICY IF EXISTS haus_updates_anon_insert ON public.haus_updates;
CREATE POLICY haus_updates_anon_insert
  ON public.haus_updates
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS haus_updates_owner_select ON public.haus_updates;
CREATE POLICY haus_updates_owner_select
  ON public.haus_updates
  FOR SELECT
  TO authenticated
  USING (public.is_owner());

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
  INSERT INTO public.haus_updates (email, source)
  VALUES (mark, origin)
  ON CONFLICT (email) DO NOTHING;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bond_unsubscribe_haus_update(
  p_email text,
  p_email_hmac text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  mark text := lower(btrim(COALESCE(p_email, '')));
BEGIN
  IF p_email_hmac IS NULL OR p_email_hmac !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;
  DELETE FROM public.haus_updates WHERE email = mark;
  INSERT INTO public.haus_updates_suppression (email_hmac)
  VALUES (p_email_hmac)
  ON CONFLICT (email_hmac) DO NOTHING;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bond_confirm_haus_update(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  mark text := lower(btrim(COALESCE(p_email, '')));
BEGIN
  UPDATE public.haus_updates
  SET confirmed_at = COALESCE(confirmed_at, now())
  WHERE email = mark
    AND confirmed_at IS NULL;
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.haus_updates_before_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_record_haus_update(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_record_haus_update(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.bond_record_haus_update(text, text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.bond_unsubscribe_haus_update(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_unsubscribe_haus_update(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.bond_unsubscribe_haus_update(text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.bond_confirm_haus_update(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_confirm_haus_update(text) FROM anon;
REVOKE ALL ON FUNCTION public.bond_confirm_haus_update(text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.bond_record_haus_update(text, text, text) TO postgres;
GRANT EXECUTE ON FUNCTION public.bond_record_haus_update(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bond_unsubscribe_haus_update(text, text) TO postgres;
GRANT EXECUTE ON FUNCTION public.bond_unsubscribe_haus_update(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bond_confirm_haus_update(text) TO postgres;
GRANT EXECUTE ON FUNCTION public.bond_confirm_haus_update(text) TO service_role;

COMMENT ON TABLE public.haus_updates IS
  'Opt-in Bond Haus updates. Email, consent time, source, and a later confirmation time. Owner read. Anon insert. No update or delete grant for anon or operators.';

COMMENT ON TABLE public.haus_updates_suppression IS
  'Keyed HMAC of an email removed from Bond Haus updates. Blocks a later insert of that address. No raw email.';
