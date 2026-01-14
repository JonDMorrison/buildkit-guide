-- Setup checklist progress tracking table
CREATE TABLE public.setup_checklist_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Phase 1: Foundation
  step_org_created boolean DEFAULT false,
  step_timezone_set boolean DEFAULT false,
  step_first_project boolean DEFAULT false,
  step_first_job_site boolean DEFAULT false,
  -- Phase 2: Team Setup
  step_first_invite boolean DEFAULT false,
  step_trades_configured boolean DEFAULT false,
  step_users_assigned boolean DEFAULT false,
  -- Phase 3: Time Tracking
  step_time_tracking_enabled boolean DEFAULT false,
  step_time_tracking_configured boolean DEFAULT false,
  -- Phase 4: Safety & Compliance
  step_ppe_reviewed boolean DEFAULT false,
  step_first_safety_form boolean DEFAULT false,
  step_hazard_library boolean DEFAULT false,
  -- Phase 5: Documents
  step_first_drawing boolean DEFAULT false,
  -- Meta fields
  dismissed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT setup_checklist_progress_organization_id_key UNIQUE (organization_id)
);

-- Enable RLS
ALTER TABLE public.setup_checklist_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only org members can view/update their org's checklist
CREATE POLICY "Org members can view their setup progress"
ON public.setup_checklist_progress
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_memberships.organization_id = setup_checklist_progress.organization_id
    AND organization_memberships.user_id = auth.uid()
    AND organization_memberships.is_active = true
  )
);

CREATE POLICY "Org admins can update their setup progress"
ON public.setup_checklist_progress
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_memberships.organization_id = setup_checklist_progress.organization_id
    AND organization_memberships.user_id = auth.uid()
    AND organization_memberships.is_active = true
    AND organization_memberships.role IN ('admin', 'owner')
  )
);

CREATE POLICY "Org admins can insert their setup progress"
ON public.setup_checklist_progress
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_memberships.organization_id = setup_checklist_progress.organization_id
    AND organization_memberships.user_id = auth.uid()
    AND organization_memberships.is_active = true
    AND organization_memberships.role IN ('admin', 'owner')
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_setup_checklist_progress_updated_at
BEFORE UPDATE ON public.setup_checklist_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();