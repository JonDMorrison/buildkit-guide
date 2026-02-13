
-- ai_insights table for storing AI-generated narrative summaries
CREATE TABLE public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  insight_type text NOT NULL DEFAULT 'weekly_summary',
  input_hash text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: one insight per org/project/date/type/input combination
CREATE UNIQUE INDEX uq_ai_insights_idempotent 
  ON public.ai_insights (organization_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'), snapshot_date, insight_type, input_hash);

-- Enable RLS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Org members can view insights for their org
CREATE POLICY "Org members can view insights"
  ON public.ai_insights
  FOR SELECT
  USING (public.has_org_membership(organization_id));

-- Only admins/PMs can insert/update (edge function uses service role, but this protects client-side)
CREATE POLICY "Org admins can manage insights"
  ON public.ai_insights
  FOR ALL
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

-- Index for fast lookups
CREATE INDEX idx_ai_insights_lookup 
  ON public.ai_insights (organization_id, project_id, insight_type, snapshot_date DESC);
