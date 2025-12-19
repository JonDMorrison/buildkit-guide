-- Create safety_form_acknowledgments table for individual worker sign-off (BC compliance requirement)
CREATE TABLE IF NOT EXISTS public.safety_form_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  safety_form_id UUID NOT NULL REFERENCES public.safety_forms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signature_url TEXT,
  attestation_text TEXT DEFAULT 'I acknowledge that I have been informed of the hazards, controls, and required PPE for today''s work.',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(safety_form_id, user_id)
);

-- Enable RLS on safety_form_acknowledgments
ALTER TABLE public.safety_form_acknowledgments ENABLE ROW LEVEL SECURITY;

-- RLS policies for safety_form_acknowledgments
CREATE POLICY "Project members can view acknowledgments"
ON public.safety_form_acknowledgments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.safety_forms sf
    WHERE sf.id = safety_form_acknowledgments.safety_form_id
    AND (is_admin(auth.uid()) OR is_project_member(auth.uid(), sf.project_id))
  )
);

CREATE POLICY "Workers can create their own acknowledgments"
ON public.safety_form_acknowledgments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.safety_forms sf
    WHERE sf.id = safety_form_acknowledgments.safety_form_id
    AND is_project_member(auth.uid(), sf.project_id)
  )
);

CREATE POLICY "Foreman+ can insert acknowledgments on behalf"
ON public.safety_form_acknowledgments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.safety_forms sf
    WHERE sf.id = safety_form_acknowledgments.safety_form_id
    AND (is_admin(auth.uid()) OR has_any_project_role(auth.uid(), sf.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  )
);

-- Add reviewed_by and reviewed_at columns to safety_forms for PM review workflow
ALTER TABLE public.safety_forms 
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_safety_form_acks_form ON public.safety_form_acknowledgments(safety_form_id);
CREATE INDEX IF NOT EXISTS idx_safety_form_acks_user ON public.safety_form_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_forms_reviewed ON public.safety_forms(reviewed_by) WHERE reviewed_by IS NOT NULL;