
-- AI Insight Validation Log
-- Records every failed narrative-vs-evidence cross-check
CREATE TABLE public.ai_insight_validation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  project_id uuid REFERENCES public.projects(id),
  insight_type text NOT NULL DEFAULT 'weekly_summary',
  snapshot_date date NOT NULL,
  validation_result text NOT NULL CHECK (validation_result IN ('pass', 'fail_narrative_numbers', 'fail_evidence_mismatch', 'fail_missing_evidence')),
  narrative_numbers jsonb NOT NULL DEFAULT '[]',
  evidence_values jsonb NOT NULL DEFAULT '{}',
  mismatched_numbers jsonb NOT NULL DEFAULT '[]',
  raw_content jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_insight_validation_log ENABLE ROW LEVEL SECURITY;

-- Only org members can view logs
CREATE POLICY "Org members can view validation logs"
  ON public.ai_insight_validation_log
  FOR SELECT
  TO authenticated
  USING (public.has_org_membership(organization_id));

-- Only service role inserts (from edge function)
-- No INSERT policy for authenticated = edge function uses service role

CREATE INDEX idx_ai_validation_log_org_date 
  ON public.ai_insight_validation_log(organization_id, snapshot_date DESC);

COMMENT ON TABLE public.ai_insight_validation_log IS
  'Audit log for AI insight narrative-vs-evidence cross-validation. '
  'Every generated insight is validated: numbers extracted from narrative prose '
  'must exist in the EVIDENCE JSON block. Failed validations prevent storage.';
