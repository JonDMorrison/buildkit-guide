-- Add jurisdiction_code to organization_settings
ALTER TABLE public.organization_settings 
ADD COLUMN IF NOT EXISTS jurisdiction_code TEXT DEFAULT 'BC';

-- Add record_hash and device_info to safety_forms for immutable records
ALTER TABLE public.safety_forms 
ADD COLUMN IF NOT EXISTS record_hash TEXT,
ADD COLUMN IF NOT EXISTS device_info JSONB;

-- Create safety_form_attendees table for tracking who signed/attended
CREATE TABLE IF NOT EXISTS public.safety_form_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  safety_form_id UUID NOT NULL REFERENCES public.safety_forms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  signed_at TIMESTAMPTZ,
  signature_url TEXT,
  is_foreman BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on safety_form_attendees
ALTER TABLE public.safety_form_attendees ENABLE ROW LEVEL SECURITY;

-- RLS policies for safety_form_attendees
CREATE POLICY "Project members can view attendees"
ON public.safety_form_attendees
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.safety_forms sf
    WHERE sf.id = safety_form_attendees.safety_form_id
    AND (is_admin(auth.uid()) OR is_project_member(auth.uid(), sf.project_id))
  )
);

CREATE POLICY "Foreman+ can insert attendees"
ON public.safety_form_attendees
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.safety_forms sf
    WHERE sf.id = safety_form_attendees.safety_form_id
    AND (is_admin(auth.uid()) OR has_any_project_role(auth.uid(), sf.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  )
);

CREATE POLICY "Foreman+ can update attendees"
ON public.safety_form_attendees
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.safety_forms sf
    WHERE sf.id = safety_form_attendees.safety_form_id
    AND (is_admin(auth.uid()) OR has_any_project_role(auth.uid(), sf.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  )
);

-- Create safety_form_amendments table for defensible edits
CREATE TABLE IF NOT EXISTS public.safety_form_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  safety_form_id UUID NOT NULL REFERENCES public.safety_forms(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles(id),
  proposed_changes JSONB NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  original_snapshot JSONB NOT NULL,
  approved_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on safety_form_amendments
ALTER TABLE public.safety_form_amendments ENABLE ROW LEVEL SECURITY;

-- RLS policies for safety_form_amendments
CREATE POLICY "Project members can view amendments"
ON public.safety_form_amendments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.safety_forms sf
    WHERE sf.id = safety_form_amendments.safety_form_id
    AND (is_admin(auth.uid()) OR is_project_member(auth.uid(), sf.project_id))
  )
);

CREATE POLICY "Foreman+ can create amendments"
ON public.safety_form_amendments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.safety_forms sf
    WHERE sf.id = safety_form_amendments.safety_form_id
    AND (is_admin(auth.uid()) OR has_any_project_role(auth.uid(), sf.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  )
);

CREATE POLICY "PM/Admin can review amendments"
ON public.safety_form_amendments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.safety_forms sf
    WHERE sf.id = safety_form_amendments.safety_form_id
    AND (is_admin(auth.uid()) OR has_project_role(auth.uid(), sf.project_id, 'project_manager'::app_role))
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_safety_form_attendees_form ON public.safety_form_attendees(safety_form_id);
CREATE INDEX IF NOT EXISTS idx_safety_form_attendees_user ON public.safety_form_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_form_amendments_form ON public.safety_form_amendments(safety_form_id);
CREATE INDEX IF NOT EXISTS idx_safety_form_amendments_status ON public.safety_form_amendments(status);