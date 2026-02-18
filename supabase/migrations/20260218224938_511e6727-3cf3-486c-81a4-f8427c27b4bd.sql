
-- 1. Organizations: add base_currency
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS base_currency text NOT NULL DEFAULT 'CAD';

ALTER TABLE public.organizations
  ADD CONSTRAINT chk_org_base_currency CHECK (base_currency IN ('CAD','USD'));

-- 2. Organization memberships: add CHECK on rates_currency
ALTER TABLE public.organization_memberships
  ADD CONSTRAINT chk_rates_currency CHECK (rates_currency IN ('CAD','USD'));

-- 3. Projects: add currency
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CAD';

ALTER TABLE public.projects
  ADD CONSTRAINT chk_project_currency CHECK (currency IN ('CAD','USD'));

-- Backfill projects.currency from org base_currency
UPDATE public.projects p
SET currency = o.base_currency
FROM public.organizations o
WHERE p.organization_id = o.id
  AND p.currency = 'CAD'
  AND o.base_currency != 'CAD';

-- 4. Estimates: add currency
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CAD';

ALTER TABLE public.estimates
  ADD CONSTRAINT chk_estimate_currency CHECK (currency IN ('CAD','USD'));

-- Backfill estimates from project currency
UPDATE public.estimates e
SET currency = p.currency
FROM public.projects p
WHERE e.project_id = p.id
  AND e.currency != p.currency;

-- 5. Quotes: add currency
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CAD';

ALTER TABLE public.quotes
  ADD CONSTRAINT chk_quote_currency CHECK (currency IN ('CAD','USD'));

-- Backfill quotes from project currency
UPDATE public.quotes q
SET currency = p.currency
FROM public.projects p
WHERE q.project_id = p.id
  AND q.currency != p.currency;

-- 6. Invoices: add currency
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CAD';

ALTER TABLE public.invoices
  ADD CONSTRAINT chk_invoice_currency CHECK (currency IN ('CAD','USD'));

-- Backfill invoices from project currency if linked, else org base
UPDATE public.invoices i
SET currency = COALESCE(
  (SELECT p.currency FROM public.projects p WHERE p.id = i.project_id),
  (SELECT o.base_currency FROM public.organizations o WHERE o.id = i.organization_id)
)
WHERE currency = 'CAD';
