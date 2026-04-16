-- Create labor_rates table referenced by rpc_get_system_integrity_issues.
-- Columns match what the RPC queries: id, trade_id, organization_id, currency.
-- Also includes rate and timestamps so the table is usable.

CREATE TABLE IF NOT EXISTS public.labor_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  rate numeric(10,2) NOT NULL CHECK (rate >= 0),
  currency text NOT NULL DEFAULT 'CAD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, trade_id)
);

CREATE INDEX IF NOT EXISTS idx_labor_rates_org_trade
  ON public.labor_rates(organization_id, trade_id);

ALTER TABLE public.labor_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "labor_rates_select_org_members"
  ON public.labor_rates FOR SELECT
  USING (public.has_org_membership(organization_id));

CREATE POLICY "labor_rates_insert_admin"
  ON public.labor_rates FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "labor_rates_update_admin"
  ON public.labor_rates FOR UPDATE
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "labor_rates_delete_admin"
  ON public.labor_rates FOR DELETE
  USING (public.is_org_admin(auth.uid(), organization_id));
