-- Phase B plumbing. Dry-run only. No live paging. No auto-actions.
-- Project: ziruzhhkkndgmdouithb (Bond-Rosin-Vapes)
-- Rollback candidate for promote: dpl_9s3QefvHFNsTyePTSqAMNm9TEbUu

-- 1. Cadence as data for the fourteen-monitor catalog.
CREATE TABLE IF NOT EXISTS public.monitor_schedules (
  id text PRIMARY KEY,
  name text NOT NULL,
  cadence text NOT NULL,
  cadence_seconds integer NOT NULL,
  rule_id text NOT NULL,
  citation text NOT NULL,
  fail_severity text NOT NULL,
  execution_mode text NOT NULL DEFAULT 'dry-run',
  live_enabled boolean NOT NULL DEFAULT false,
  next_due text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monitor_schedules_mode_dry CHECK (execution_mode = 'dry-run'),
  CONSTRAINT monitor_schedules_live_off CHECK (live_enabled = false)
);

ALTER TABLE public.monitor_schedules ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.monitor_schedules IS
  'Fourteen-monitor catalog cadence. Seed data. Live probes stay off.';

REVOKE ALL ON TABLE public.monitor_schedules FROM PUBLIC;
REVOKE ALL ON TABLE public.monitor_schedules FROM anon;
REVOKE ALL ON TABLE public.monitor_schedules FROM authenticated;
GRANT SELECT ON TABLE public.monitor_schedules TO authenticated;

DROP POLICY IF EXISTS monitor_schedules_select_admin ON public.monitor_schedules;
CREATE POLICY monitor_schedules_select_admin
  ON public.monitor_schedules
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

INSERT INTO public.monitor_schedules (
  id, name, cadence, cadence_seconds, rule_id, citation, fail_severity, execution_mode, live_enabled, next_due
) VALUES
  ('site-liveness', 'Site liveness', 'every 2 minutes', 120, 'rule-liveness', 'Public site answers from two regions.', 'P1', 'dry-run', false, '14:20:00'),
  ('age-gate', 'Age gate integrity', 'every 15 minutes', 900, 'rule-age', 'Synthetic visitor confirms gate before content.', 'P0', 'dry-run', false, '14:20:00'),
  ('compliance-band', 'Compliance band presence', 'hourly', 3600, 'rule-claims', 'Required warning text, rotating slot, license line.', 'P1', 'dry-run', false, '14:20:00'),
  ('robots-indexing', 'Robots and indexing state', 'hourly', 3600, 'rule-robots', 'Flag matches launch decision.', 'P1', 'dry-run', false, '14:20:00'),
  ('security-headers', 'Security headers and CSP', 'hourly', 3600, 'rule-headers', 'Response headers match the ruleset.', 'P1', 'dry-run', false, '14:20:00'),
  ('tls-domain', 'TLS and domain', 'daily', 86400, 'rule-tls', 'Certificate validity, DNS integrity, renewal horizon.', 'P1', 'dry-run', false, '14:20:00'),
  ('dependency-secret', 'Dependency and secret scan', 'every commit and nightly', 86400, 'rule-deps', 'CVE sweep and secret patterns.', 'P0', 'dry-run', false, '14:20:00'),
  ('auth-watch', 'Auth watch', 'streaming', 0, 'rule-auth', 'Lockouts, failure bursts, impossible travel on /haus.', 'P0', 'dry-run', false, '14:20:00'),
  ('rls-probe', 'RLS probe', 'hourly', 3600, 'rule-rls', 'Anonymous synthetic attempts protected tables.', 'P0', 'dry-run', false, '14:20:00'),
  ('form-abuse', 'Form abuse', 'streaming', 0, 'rule-forms', 'Bond Circle signup velocity and disposable domains.', 'P2', 'dry-run', false, '14:20:00'),
  ('metrc-sync', 'Metrc sync health', 'every 15 minutes', 900, 'rule-metrc', 'Trace staleness, error rates, open discrepancies.', 'P1', 'dry-run', false, '14:20:00'),
  ('content-lint', 'Content lint sweep', 'every deploy and nightly', 86400, 'rule-dash', 'Deployed pages for dash characters, forbidden vocabulary, claims.', 'P2', 'dry-run', false, '14:20:00'),
  ('audit-integrity', 'Audit log integrity', 'hourly', 3600, 'rule-audit', 'Append-only hash chain verifies.', 'P0', 'dry-run', false, '14:20:00'),
  ('agent-conduct', 'Agent conduct', 'streaming', 0, 'rule-agents', 'Enforcement set from the Rules room.', 'P1', 'dry-run', false, '14:20:00')
ON CONFLICT (id) DO NOTHING;

-- 2. Dry-run run records. Same shape as live. No side effects.
CREATE TABLE IF NOT EXISTS public.monitor_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  monitor_id text NOT NULL REFERENCES public.monitor_schedules(id),
  at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL,
  note text NOT NULL,
  mode text NOT NULL DEFAULT 'dry-run',
  origin text NOT NULL,
  finding_id text,
  incident_id text,
  CONSTRAINT monitor_runs_mode_dry CHECK (mode = 'dry-run')
);

ALTER TABLE public.monitor_runs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.monitor_runs IS
  'Dry-run monitor history. Insert only from admin session. No external synthetics.';

REVOKE ALL ON TABLE public.monitor_runs FROM PUBLIC;
REVOKE ALL ON TABLE public.monitor_runs FROM anon;
REVOKE ALL ON TABLE public.monitor_runs FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.monitor_runs TO authenticated;

DROP POLICY IF EXISTS monitor_runs_select_admin ON public.monitor_runs;
DROP POLICY IF EXISTS monitor_runs_insert_admin ON public.monitor_runs;
CREATE POLICY monitor_runs_select_admin
  ON public.monitor_runs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
CREATE POLICY monitor_runs_insert_admin
  ON public.monitor_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND mode = 'dry-run');

-- 3. Findings drafts. Same columns as a live finding. Not the live scorecard.
CREATE TABLE IF NOT EXISTS public.monitor_findings_drafts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  severity text NOT NULL,
  source text NOT NULL,
  surface text NOT NULL,
  citation text NOT NULL,
  owner text NOT NULL,
  due text NOT NULL,
  cite text NOT NULL,
  remediate text NOT NULL,
  document text NOT NULL,
  state text NOT NULL DEFAULT 'open',
  closed_evidence text NOT NULL DEFAULT '',
  opened_on text NOT NULL,
  escape boolean NOT NULL DEFAULT false,
  monitor_id text REFERENCES public.monitor_schedules(id),
  mode text NOT NULL DEFAULT 'dry-run',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monitor_findings_drafts_mode_dry CHECK (mode = 'dry-run')
);

ALTER TABLE public.monitor_findings_drafts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.monitor_findings_drafts IS
  'Dry-run findings drafts. Same shape as live. Not opened on the live scorecard.';

REVOKE ALL ON TABLE public.monitor_findings_drafts FROM PUBLIC;
REVOKE ALL ON TABLE public.monitor_findings_drafts FROM anon;
REVOKE ALL ON TABLE public.monitor_findings_drafts FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.monitor_findings_drafts TO authenticated;

DROP POLICY IF EXISTS monitor_findings_drafts_select_admin ON public.monitor_findings_drafts;
DROP POLICY IF EXISTS monitor_findings_drafts_insert_admin ON public.monitor_findings_drafts;
CREATE POLICY monitor_findings_drafts_select_admin
  ON public.monitor_findings_drafts
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
CREATE POLICY monitor_findings_drafts_insert_admin
  ON public.monitor_findings_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND mode = 'dry-run');

-- 4. Production audit hash chain. Tamper Test never writes here.
CREATE TABLE IF NOT EXISTS public.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  action text NOT NULL,
  target text NOT NULL,
  note text NOT NULL,
  prev_hash text NOT NULL,
  hash text NOT NULL,
  mode text NOT NULL DEFAULT 'dry-run',
  CONSTRAINT audit_events_mode_dry CHECK (mode = 'dry-run')
);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.audit_events IS
  'Append only hash chain. Predecessor hash on each row. Production chain never uses Tamper Test.';

REVOKE ALL ON TABLE public.audit_events FROM PUBLIC;
REVOKE ALL ON TABLE public.audit_events FROM anon;
REVOKE ALL ON TABLE public.audit_events FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_events TO authenticated;

DROP POLICY IF EXISTS audit_events_select_admin ON public.audit_events;
DROP POLICY IF EXISTS audit_events_insert_admin ON public.audit_events;
CREATE POLICY audit_events_select_admin
  ON public.audit_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
CREATE POLICY audit_events_insert_admin
  ON public.audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND mode = 'dry-run');

CREATE OR REPLACE FUNCTION public.audit_events_deny_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'audit_events is append only';
END;
$function$;

DROP TRIGGER IF EXISTS audit_events_no_update ON public.audit_events;
DROP TRIGGER IF EXISTS audit_events_no_delete ON public.audit_events;

CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_events_deny_mutation();

CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_events_deny_mutation();

REVOKE ALL ON FUNCTION public.audit_events_deny_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_events_deny_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.audit_events_deny_mutation() FROM authenticated;

CREATE OR REPLACE FUNCTION public.audit_events_seal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_prev text;
BEGIN
  SELECT hash INTO v_prev
  FROM public.audit_events
  ORDER BY id DESC
  LIMIT 1;

  IF v_prev IS NULL THEN
    v_prev := 'genesis';
  END IF;

  NEW.prev_hash := v_prev;
  NEW.mode := 'dry-run';
  NEW.hash := encode(
    extensions.digest(
      concat_ws('|', v_prev, NEW.at::text, NEW.actor, NEW.action, NEW.target, NEW.note),
      'sha256'
    ),
    'hex'
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS audit_events_seal_bi ON public.audit_events;
CREATE TRIGGER audit_events_seal_bi
  BEFORE INSERT ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_events_seal();

REVOKE ALL ON FUNCTION public.audit_events_seal() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_events_seal() FROM anon;
REVOKE ALL ON FUNCTION public.audit_events_seal() FROM authenticated;

-- 5. Scheduled verification job stub and off-site checkpoint hook stub.
CREATE OR REPLACE FUNCTION public.verify_audit_chain()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prev text := 'genesis';
  v_row public.audit_events%ROWTYPE;
  v_expected text;
  v_count int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'verify_audit_chain denied';
  END IF;

  FOR v_row IN
    SELECT * FROM public.audit_events ORDER BY id ASC
  LOOP
    v_expected := encode(
      extensions.digest(
        concat_ws('|', v_prev, v_row.at::text, v_row.actor, v_row.action, v_row.target, v_row.note),
        'sha256'
      ),
      'hex'
    );
    IF v_row.prev_hash <> v_prev OR v_row.hash <> v_expected THEN
      RETURN jsonb_build_object('ok', false, 'broken_at', v_row.id, 'mode', 'dry-run');
    END IF;
    v_prev := v_row.hash;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'rows', v_count, 'mode', 'dry-run');
END;
$function$;

COMMENT ON FUNCTION public.verify_audit_chain() IS
  'Scheduled verification job stub. Walks audit_events. Never runs Tamper Test.';

REVOKE ALL ON FUNCTION public.verify_audit_chain() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_audit_chain() FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain() TO postgres;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain() TO service_role;

CREATE OR REPLACE FUNCTION public.checkpoint_audit_offsite()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'checkpoint_audit_offsite denied';
  END IF;
  RETURN jsonb_build_object(
    'ok', false,
    'enabled', false,
    'note', 'Off-site checkpoint hook stub. No copy leaves the room.'
  );
END;
$function$;

COMMENT ON FUNCTION public.checkpoint_audit_offsite() IS
  'Off-site checkpoint hook stub. Disabled in Phase B plumbing.';

REVOKE ALL ON FUNCTION public.checkpoint_audit_offsite() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkpoint_audit_offsite() FROM anon;
GRANT EXECUTE ON FUNCTION public.checkpoint_audit_offsite() TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkpoint_audit_offsite() TO postgres;
GRANT EXECUTE ON FUNCTION public.checkpoint_audit_offsite() TO service_role;

-- 6. Scanner ingest + Pre-Check server dry-run rows.
CREATE TABLE IF NOT EXISTS public.scanner_ingestions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL,
  note text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  finding_id text,
  last_sweep text,
  mode text NOT NULL DEFAULT 'dry-run',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scanner_ingestions_mode_dry CHECK (mode = 'dry-run')
);

ALTER TABLE public.scanner_ingestions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.scanner_ingestions IS
  'CI scan ingest stub. Maps into findings drafts. Merge block stays off.';

REVOKE ALL ON TABLE public.scanner_ingestions FROM PUBLIC;
REVOKE ALL ON TABLE public.scanner_ingestions FROM anon;
REVOKE ALL ON TABLE public.scanner_ingestions FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.scanner_ingestions TO authenticated;

DROP POLICY IF EXISTS scanner_ingestions_select_admin ON public.scanner_ingestions;
DROP POLICY IF EXISTS scanner_ingestions_insert_admin ON public.scanner_ingestions;
CREATE POLICY scanner_ingestions_select_admin
  ON public.scanner_ingestions
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
CREATE POLICY scanner_ingestions_insert_admin
  ON public.scanner_ingestions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND mode = 'dry-run');

CREATE TABLE IF NOT EXISTS public.precheck_server_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  candidate text NOT NULL,
  verdict text NOT NULL,
  reasons text[] NOT NULL DEFAULT ARRAY[]::text[],
  metrc_source text NOT NULL DEFAULT 'trace-mock',
  mode text NOT NULL DEFAULT 'dry-run',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT precheck_server_runs_mode_dry CHECK (mode = 'dry-run'),
  CONSTRAINT precheck_server_runs_metrc_mock CHECK (metrc_source = 'trace-mock')
);

ALTER TABLE public.precheck_server_runs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.precheck_server_runs IS
  'Pre-Check server dry-run. Metrc freshness from Trace mock only.';

REVOKE ALL ON TABLE public.precheck_server_runs FROM PUBLIC;
REVOKE ALL ON TABLE public.precheck_server_runs FROM anon;
REVOKE ALL ON TABLE public.precheck_server_runs FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.precheck_server_runs TO authenticated;

DROP POLICY IF EXISTS precheck_server_runs_select_admin ON public.precheck_server_runs;
DROP POLICY IF EXISTS precheck_server_runs_insert_admin ON public.precheck_server_runs;
CREATE POLICY precheck_server_runs_select_admin
  ON public.precheck_server_runs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
CREATE POLICY precheck_server_runs_insert_admin
  ON public.precheck_server_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND mode = 'dry-run' AND metrc_source = 'trace-mock');
