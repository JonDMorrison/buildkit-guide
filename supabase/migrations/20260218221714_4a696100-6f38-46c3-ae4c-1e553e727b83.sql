
ALTER TABLE public.quote_events ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
