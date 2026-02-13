
-- snapshots_run_log: tracks each automated snapshot collection run
CREATE TABLE public.snapshots_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_at timestamptz NOT NULL DEFAULT now(),
  snapshot_date date NOT NULL,
  projects_count int NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT true,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.snapshots_run_log ENABLE ROW LEVEL SECURITY;

-- Org members can read their org's run logs
CREATE POLICY "Org members can read snapshot run logs"
  ON public.snapshots_run_log
  FOR SELECT
  TO authenticated
  USING (public.has_org_membership(organization_id));

-- Block direct INSERT/UPDATE/DELETE from normal users (service role bypasses RLS)
CREATE POLICY "Service role only can write snapshot run logs"
  ON public.snapshots_run_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role only can update snapshot run logs"
  ON public.snapshots_run_log
  FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role only can delete snapshot run logs"
  ON public.snapshots_run_log
  FOR DELETE
  TO service_role
  USING (true);

-- Index for querying by org
CREATE INDEX idx_snapshots_run_log_org_date ON public.snapshots_run_log (organization_id, snapshot_date);
