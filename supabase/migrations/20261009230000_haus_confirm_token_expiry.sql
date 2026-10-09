-- Confirm link ids expire after 7 days. Unsubscribe link ids do not expire.
-- DO NOT apply this file to the live project ziruzhhkkndgmdouithb from this PR.
-- Apply after 20261009220000_haus_update_token_cleanup.sql.
--
-- Unsubscribe ids are still deleted only with the record, at unsubscribe,
-- or as orphans older than 30 days. No INSERT grant for anon or authenticated.

ALTER TABLE public.haus_update_tokens
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.haus_update_tokens
SET expires_at = created_at + interval '7 days'
WHERE purpose = 'confirm' AND expires_at IS NULL;

ALTER TABLE public.haus_update_tokens
  DROP CONSTRAINT IF EXISTS haus_update_tokens_expiry;

ALTER TABLE public.haus_update_tokens
  ADD CONSTRAINT haus_update_tokens_expiry CHECK (
    (purpose = 'unsub' AND expires_at IS NULL)
    OR (purpose = 'confirm' AND expires_at IS NOT NULL)
  );

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
  INSERT INTO public.haus_update_tokens (email_hmac, purpose, expires_at)
  VALUES (
    p_email_hmac,
    p_purpose,
    CASE
      WHEN p_purpose = 'confirm' THEN now() + interval '7 days'
      ELSE NULL
    END
  )
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
  SELECT jsonb_build_object(
    'email_hmac', token.email_hmac,
    'purpose', token.purpose,
    'expires_at', token.expires_at
  )
  INTO found
  FROM public.haus_update_tokens token
  WHERE token.id = p_id;
  RETURN found;
END;
$function$;

REVOKE ALL ON FUNCTION public.bond_issue_haus_update_token(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_issue_haus_update_token(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.bond_issue_haus_update_token(text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.bond_read_haus_update_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bond_read_haus_update_token(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.bond_read_haus_update_token(uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.bond_issue_haus_update_token(text, text) TO postgres;
GRANT EXECUTE ON FUNCTION public.bond_issue_haus_update_token(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bond_read_haus_update_token(uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.bond_read_haus_update_token(uuid) TO service_role;

REVOKE INSERT ON TABLE public.haus_updates FROM PUBLIC;
REVOKE INSERT ON TABLE public.haus_updates FROM anon;
REVOKE INSERT ON TABLE public.haus_updates FROM authenticated;
REVOKE INSERT ON TABLE public.haus_updates_suppression FROM PUBLIC;
REVOKE INSERT ON TABLE public.haus_updates_suppression FROM anon;
REVOKE INSERT ON TABLE public.haus_updates_suppression FROM authenticated;
REVOKE INSERT ON TABLE public.haus_update_tokens FROM PUBLIC;
REVOKE INSERT ON TABLE public.haus_update_tokens FROM anon;
REVOKE INSERT ON TABLE public.haus_update_tokens FROM authenticated;

COMMENT ON TABLE public.haus_update_tokens IS
  'Opaque ids for unsubscribe and confirm links. Stores the email HMAC and the purpose. A confirm id expires after 7 days. An unsubscribe id does not expire. The URL does not carry the email.';
