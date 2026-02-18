
-- Add sandbox columns to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_sandbox boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sandbox_label text;

COMMENT ON COLUMN public.organizations.is_sandbox IS 'When true, this org is a test/sandbox environment';
COMMENT ON COLUMN public.organizations.sandbox_label IS 'Custom label shown in UI badge (defaults to "Sandbox")';
