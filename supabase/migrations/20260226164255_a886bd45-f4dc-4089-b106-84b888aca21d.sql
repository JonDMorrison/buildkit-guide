
-- Stage 21: Add onboarding wizard resume state to profiles
-- All columns nullable with no defaults to avoid breaking existing rows

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_step smallint,
  ADD COLUMN IF NOT EXISTS onboarding_org_id uuid,
  ADD COLUMN IF NOT EXISTS onboarding_project_id uuid;

-- No indexes needed: these are only read by the owning user during onboarding
-- RLS on profiles already restricts updates to auth.uid() = id
