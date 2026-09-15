-- Allow lockout pre-check without writing a fail row.
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
  v_fails int;
  v_locked int;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN jsonb_build_object('allowed', false, 'locked', false);
  END IF;

  v_hash := encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex');

  SELECT count(*) INTO v_locked
  FROM public.auth_attempts
  WHERE email_hash = v_hash
    AND outcome = 'lockout'
    AND attempted_at > now() - interval '30 minutes';

  IF p_outcome = 'check' THEN
    RETURN jsonb_build_object('allowed', v_locked = 0, 'locked', v_locked > 0);
  END IF;

  IF v_locked > 0 AND p_outcome <> 'lockout' THEN
    INSERT INTO public.auth_attempts (email_hash, ip, outcome)
    VALUES (v_hash, p_ip, 'blocked');
    RETURN jsonb_build_object('allowed', false, 'locked', true);
  END IF;

  INSERT INTO public.auth_attempts (email_hash, ip, outcome)
  VALUES (v_hash, p_ip, p_outcome);

  IF p_outcome IN ('fail', 'blocked') THEN
    SELECT count(*) INTO v_fails
    FROM public.auth_attempts
    WHERE email_hash = v_hash
      AND outcome IN ('fail', 'blocked')
      AND attempted_at > now() - interval '15 minutes';

    IF v_fails >= 5 THEN
      INSERT INTO public.auth_attempts (email_hash, ip, outcome)
      VALUES (v_hash, p_ip, 'lockout');
      RETURN jsonb_build_object('allowed', false, 'locked', true);
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', p_outcome NOT IN ('fail', 'blocked', 'lockout'), 'locked', false);
END;
$function$;
