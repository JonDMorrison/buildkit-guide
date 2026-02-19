-- 1. Create audit_run_history table
CREATE TABLE public.audit_run_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pass_count int NOT NULL DEFAULT 0,
  fail_count int NOT NULL DEFAULT 0,
  manual_count int NOT NULL DEFAULT 0,
  p0_blockers int NOT NULL DEFAULT 0,
  json_result jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_run_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_run_history FORCE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org audit history"
  ON public.audit_run_history FOR SELECT TO authenticated
  USING (has_org_membership(organization_id));

CREATE POLICY "No direct insert" ON public.audit_run_history FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct update" ON public.audit_run_history FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No direct delete" ON public.audit_run_history FOR DELETE TO authenticated USING (false);

CREATE INDEX idx_audit_run_history_org ON public.audit_run_history (organization_id, created_at DESC);