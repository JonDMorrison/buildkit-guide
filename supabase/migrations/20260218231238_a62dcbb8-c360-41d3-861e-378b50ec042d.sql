
-- Table: financial_integrity_overrides
CREATE TABLE public.financial_integrity_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  triggered_by uuid NOT NULL REFERENCES auth.users(id),
  checkpoint text NOT NULL CHECK (checkpoint IN ('pm_approval','invoice_send','project_close')),
  integrity_status text NOT NULL,
  integrity_score integer NOT NULL,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  override_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_integrity_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_integrity_overrides FORCE ROW LEVEL SECURITY;

-- SELECT only, org-scoped
CREATE POLICY "Org members can view overrides"
  ON public.financial_integrity_overrides
  FOR SELECT
  TO authenticated
  USING (has_org_membership(organization_id));

-- No INSERT/UPDATE/DELETE policies — writes go through RPC only

-- RPC: rpc_log_financial_override
CREATE OR REPLACE FUNCTION public.rpc_log_financial_override(
  p_project_id uuid,
  p_checkpoint text,
  p_override_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_caller uuid := auth.uid();
  v_variance jsonb;
  v_integrity jsonb;
  v_status text;
  v_score integer;
  v_blockers jsonb;
BEGIN
  -- Validate checkpoint value
  IF p_checkpoint NOT IN ('pm_approval', 'invoice_send', 'project_close') THEN
    RAISE EXCEPTION 'Invalid checkpoint: %', p_checkpoint USING ERRCODE = '22023';
  END IF;

  -- Validate reason length
  IF length(trim(p_override_reason)) < 10 THEN
    RAISE EXCEPTION 'Override reason must be at least 10 characters' USING ERRCODE = '22023';
  END IF;

  -- Validate project access + role (admin or project_manager)
  IF NOT has_project_access(p_project_id, ARRAY['admin', 'project_manager']) THEN
    RAISE EXCEPTION 'Forbidden: insufficient role' USING ERRCODE = '42501';
  END IF;

  -- Get org_id from project
  SELECT organization_id INTO v_org_id FROM projects WHERE id = p_project_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501';
  END IF;

  -- Fetch current integrity state server-side
  SELECT estimate_variance_summary(p_project_id) INTO v_variance;

  v_integrity := v_variance->'integrity';
  v_status := COALESCE(v_integrity->>'status', 'unknown');
  v_score := COALESCE((v_integrity->>'score')::integer, 0);
  v_blockers := COALESCE(v_integrity->'blockers', '[]'::jsonb);

  -- Insert override record
  INSERT INTO financial_integrity_overrides (
    organization_id, project_id, triggered_by, checkpoint,
    integrity_status, integrity_score, blockers, override_reason
  ) VALUES (
    v_org_id, p_project_id, v_caller, p_checkpoint,
    v_status, v_score, v_blockers, trim(p_override_reason)
  );

  RETURN true;
END;
$$;
