-- Add has_onboarded flag to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_onboarded boolean NOT NULL DEFAULT false;

-- Set existing users as already onboarded (they've been using the app)
UPDATE public.profiles SET has_onboarded = true WHERE has_onboarded = false;

-- Create index for quick lookup during auth checks
CREATE INDEX IF NOT EXISTS idx_profiles_has_onboarded ON public.profiles(id) WHERE has_onboarded = false;