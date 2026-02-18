
-- Add org-level default labor rates to organization_memberships
ALTER TABLE public.organization_memberships
  ADD COLUMN IF NOT EXISTS hourly_cost_rate numeric(10,2),
  ADD COLUMN IF NOT EXISTS hourly_bill_rate numeric(10,2),
  ADD COLUMN IF NOT EXISTS rates_currency text NOT NULL DEFAULT 'CAD';

-- Add CHECK constraints
ALTER TABLE public.organization_memberships
  ADD CONSTRAINT chk_hourly_cost_rate_positive CHECK (hourly_cost_rate IS NULL OR hourly_cost_rate >= 0),
  ADD CONSTRAINT chk_hourly_bill_rate_positive CHECK (hourly_bill_rate IS NULL OR hourly_bill_rate >= 0);

COMMENT ON COLUMN public.organization_memberships.hourly_cost_rate IS 'Default hourly cost rate for this member (used as fallback when project_members.cost_rate is null)';
COMMENT ON COLUMN public.organization_memberships.hourly_bill_rate IS 'Default hourly bill rate for this member (used as fallback when project_members.bill_rate is null)';
COMMENT ON COLUMN public.organization_memberships.rates_currency IS 'Currency for rates (default CAD)';
