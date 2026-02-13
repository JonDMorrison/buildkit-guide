
-- ============================================================
-- Weekly financial snapshots: project-level + org-level
-- ============================================================

-- 1) project_financial_snapshots
CREATE TABLE public.project_financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  snapshot_period text NOT NULL DEFAULT 'weekly',
  status text NULL,
  has_budget boolean NOT NULL DEFAULT false,

  -- Budget (planned)
  contract_value numeric(12,2) NOT NULL DEFAULT 0,
  planned_labor_hours numeric(12,2) NOT NULL DEFAULT 0,
  planned_labor_cost numeric(12,2) NOT NULL DEFAULT 0,
  planned_material_cost numeric(12,2) NOT NULL DEFAULT 0,
  planned_machine_cost numeric(12,2) NOT NULL DEFAULT 0,
  planned_other_cost numeric(12,2) NOT NULL DEFAULT 0,
  planned_total_cost numeric(12,2) NOT NULL DEFAULT 0,

  -- Actuals
  actual_labor_hours numeric(12,2) NOT NULL DEFAULT 0,
  actual_labor_cost numeric(12,2) NOT NULL DEFAULT 0,
  actual_material_cost numeric(12,2) NOT NULL DEFAULT 0,
  actual_machine_cost numeric(12,2) NOT NULL DEFAULT 0,
  actual_other_cost numeric(12,2) NOT NULL DEFAULT 0,
  actual_unclassified_cost numeric(12,2) NOT NULL DEFAULT 0,
  actual_total_cost numeric(12,2) NOT NULL DEFAULT 0,

  -- Invoicing (strict)
  invoiced_amount_strict numeric(12,2) NOT NULL DEFAULT 0,
  remainder_to_invoice_strict numeric(12,2) NOT NULL DEFAULT 0,
  billed_percentage_strict numeric(6,2) NOT NULL DEFAULT 0,

  -- Invoicing (relaxed)
  invoiced_amount_relaxed numeric(12,2) NOT NULL DEFAULT 0,
  remainder_to_invoice_relaxed numeric(12,2) NOT NULL DEFAULT 0,
  billed_percentage_relaxed numeric(6,2) NOT NULL DEFAULT 0,

  -- Profit & margin (actual)
  actual_profit numeric(12,2) NOT NULL DEFAULT 0,
  actual_margin_pct numeric(6,2) NOT NULL DEFAULT 0,

  -- Profit & margin (planned)
  planned_profit numeric(12,2) NOT NULL DEFAULT 0,
  planned_margin_pct numeric(6,2) NOT NULL DEFAULT 0,

  -- Diagnostics
  labor_hours_missing_cost_rate numeric(12,2) NOT NULL DEFAULT 0,
  labor_hours_missing_membership numeric(12,2) NOT NULL DEFAULT 0,
  unclassified_receipt_count int NOT NULL DEFAULT 0,
  labor_entry_count_missing_cost_rate int NOT NULL DEFAULT 0,
  labor_entry_count_missing_membership int NOT NULL DEFAULT 0,

  -- Meta
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,

  CONSTRAINT uq_project_snapshot UNIQUE (project_id, snapshot_date, snapshot_period)
);

CREATE INDEX idx_pfs_org_date ON public.project_financial_snapshots (organization_id, snapshot_date);
CREATE INDEX idx_pfs_project_date ON public.project_financial_snapshots (project_id, snapshot_date);
CREATE INDEX idx_pfs_org_period_date ON public.project_financial_snapshots (organization_id, snapshot_period, snapshot_date);

-- 2) org_financial_snapshots
CREATE TABLE public.org_financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  snapshot_period text NOT NULL DEFAULT 'weekly',

  total_contract_value numeric(14,2) NOT NULL DEFAULT 0,
  total_planned_cost numeric(14,2) NOT NULL DEFAULT 0,
  total_actual_cost numeric(14,2) NOT NULL DEFAULT 0,
  total_invoiced_strict numeric(14,2) NOT NULL DEFAULT 0,
  total_profit_actual numeric(14,2) NOT NULL DEFAULT 0,
  weighted_margin_pct_actual numeric(6,2) NOT NULL DEFAULT 0,

  projects_count int NOT NULL DEFAULT 0,
  projects_with_budget_count int NOT NULL DEFAULT 0,
  projects_missing_budget_count int NOT NULL DEFAULT 0,
  projects_over_budget_count int NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_org_snapshot UNIQUE (organization_id, snapshot_date, snapshot_period)
);

CREATE INDEX idx_ofs_org_date ON public.org_financial_snapshots (organization_id, snapshot_date);

-- ============================================================
-- RLS
-- ============================================================

-- project_financial_snapshots
ALTER TABLE public.project_financial_snapshots ENABLE ROW LEVEL SECURITY;

-- Org members can read their snapshots
CREATE POLICY "Org members can view project snapshots"
  ON public.project_financial_snapshots
  FOR SELECT
  TO authenticated
  USING (public.has_org_membership(organization_id));

-- Block all direct inserts/updates/deletes from normal users.
-- Only service_role or SECURITY DEFINER RPCs can write.
-- (No INSERT/UPDATE/DELETE policies = denied by default with RLS enabled.)

-- org_financial_snapshots
ALTER TABLE public.org_financial_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view org snapshots"
  ON public.org_financial_snapshots
  FOR SELECT
  TO authenticated
  USING (public.has_org_membership(organization_id));
