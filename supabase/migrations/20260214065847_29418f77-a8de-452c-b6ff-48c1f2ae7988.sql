
-- ============================================================
-- ESTIMATES MODULE: Schema + RLS + RPCs
-- ============================================================

-- ── 1. estimates table ──
CREATE TABLE public.estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid NULL REFERENCES public.clients(id),
  parent_client_id uuid NULL REFERENCES public.clients(id),
  estimate_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','archived')),
  customer_po_number text NULL,
  customer_pm_name text NULL,
  customer_pm_email text NULL,
  customer_pm_phone text NULL,
  -- Address snapshots (immutable once approved)
  bill_to_name text NULL,
  bill_to_address text NULL,
  bill_to_ap_email text NULL,
  ship_to_name text NULL,
  ship_to_address text NULL,
  -- Financial summary
  contract_value numeric NOT NULL DEFAULT 0,
  planned_labor_hours numeric NOT NULL DEFAULT 0,
  planned_labor_bill_rate numeric NOT NULL DEFAULT 0,
  planned_labor_bill_amount numeric NOT NULL DEFAULT 0,
  planned_material_cost numeric NOT NULL DEFAULT 0,
  planned_machine_cost numeric NOT NULL DEFAULT 0,
  planned_other_cost numeric NOT NULL DEFAULT 0,
  planned_total_cost numeric NOT NULL DEFAULT 0,
  planned_profit numeric NOT NULL DEFAULT 0,
  planned_margin_percent numeric NOT NULL DEFAULT 0,
  -- Notes
  note_for_customer text NULL,
  memo_on_statement text NULL,
  internal_notes text NULL,
  -- Audit
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz NULL,
  UNIQUE (organization_id, estimate_number)
);

CREATE TRIGGER set_estimates_updated_at
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. estimate_line_items table ──
CREATE TABLE public.estimate_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  item_type text NOT NULL DEFAULT 'task' CHECK (item_type IN ('task','service','product')),
  name text NOT NULL,
  description text NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NULL,
  rate numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  sales_tax_rate numeric NOT NULL DEFAULT 0,
  sales_tax_amount numeric NOT NULL DEFAULT 0,
  scope_item_id uuid NULL REFERENCES public.project_scope_items(id),
  task_id uuid NULL REFERENCES public.tasks(id)
);

-- ── 3. estimate_task_links (optional tracking) ──
CREATE TABLE public.estimate_task_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_line_item_id uuid NOT NULL REFERENCES public.estimate_line_items(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (estimate_line_item_id, task_id)
);

-- ════════════════════════════════════════════════════
-- RLS: estimates
-- ════════════════════════════════════════════════════
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates FORCE ROW LEVEL SECURITY;

CREATE POLICY "est_select" ON public.estimates FOR SELECT TO authenticated
  USING (has_org_membership(organization_id));

CREATE POLICY "est_insert" ON public.estimates FOR INSERT TO authenticated
  WITH CHECK (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm')
  );

CREATE POLICY "est_update" ON public.estimates FOR UPDATE TO authenticated
  USING (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm')
  )
  WITH CHECK (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm')
  );

CREATE POLICY "est_delete" ON public.estimates FOR DELETE TO authenticated
  USING (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm')
  );

-- ════════════════════════════════════════════════════
-- RLS: estimate_line_items
-- ════════════════════════════════════════════════════
ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_line_items FORCE ROW LEVEL SECURITY;

CREATE POLICY "eli_select" ON public.estimate_line_items FOR SELECT TO authenticated
  USING (has_org_membership(organization_id));

CREATE POLICY "eli_insert" ON public.estimate_line_items FOR INSERT TO authenticated
  WITH CHECK (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm')
  );

CREATE POLICY "eli_update" ON public.estimate_line_items FOR UPDATE TO authenticated
  USING (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm')
  )
  WITH CHECK (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm')
  );

CREATE POLICY "eli_delete" ON public.estimate_line_items FOR DELETE TO authenticated
  USING (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm')
  );

-- ════════════════════════════════════════════════════
-- RLS: estimate_task_links
-- ════════════════════════════════════════════════════
ALTER TABLE public.estimate_task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_task_links FORCE ROW LEVEL SECURITY;

-- SELECT via join to estimate_line_items org
CREATE POLICY "etl_select" ON public.estimate_task_links FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.estimate_line_items eli
      WHERE eli.id = estimate_line_item_id
        AND has_org_membership(eli.organization_id)
    )
  );

CREATE POLICY "etl_insert" ON public.estimate_task_links FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.estimate_line_items eli
      WHERE eli.id = estimate_line_item_id
        AND has_org_membership(eli.organization_id)
        AND org_role(eli.organization_id) IN ('admin','pm')
    )
  );

CREATE POLICY "etl_delete" ON public.estimate_task_links FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.estimate_line_items eli
      WHERE eli.id = estimate_line_item_id
        AND has_org_membership(eli.organization_id)
        AND org_role(eli.organization_id) IN ('admin','pm')
    )
  );

-- ════════════════════════════════════════════════════
-- Immutability trigger: block edits when approved
-- ════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.enforce_estimate_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'approved' AND NEW.status = 'approved' THEN
    RAISE EXCEPTION 'Cannot modify an approved estimate. Duplicate it to create a new draft.';
  END IF;
  -- Allow status transitions: approved→archived
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_estimate_immutability_trigger
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_estimate_immutability();

CREATE OR REPLACE FUNCTION public.enforce_estimate_line_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.estimates WHERE id = COALESCE(OLD.estimate_id, NEW.estimate_id);
  IF v_status = 'approved' THEN
    RAISE EXCEPTION 'Cannot modify line items of an approved estimate.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER enforce_eli_immutability_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.estimate_line_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_estimate_line_immutability();

-- ════════════════════════════════════════════════════
-- Sequential estimate number generator
-- ════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_next_estimate_number(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next int;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN estimate_number ~ '^EST-\d+$'
    THEN CAST(SUBSTRING(estimate_number FROM 5) AS int)
    ELSE 0 END
  ), 0) + 1
  INTO v_next
  FROM public.estimates
  WHERE organization_id = p_org_id;

  RETURN 'EST-' || LPAD(v_next::text, 4, '0');
END;
$$;

-- ════════════════════════════════════════════════════
-- RPC: estimate_variance_summary
-- ════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.estimate_variance_summary(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_est RECORD;
  v_labor_hours numeric := 0;
  v_labor_cost numeric := 0;
  v_mat_cost numeric := 0;
  v_machine_cost numeric := 0;
  v_other_cost numeric := 0;
  v_unclassified numeric := 0;
  v_missing_rates_hours numeric := 0;
  v_unassigned_hours numeric := 0;
  v_org_id uuid;
BEGIN
  -- Get org_id from project
  SELECT organization_id INTO v_org_id FROM public.projects WHERE id = p_project_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  -- Auth check
  IF NOT public.has_org_membership(v_org_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Get latest approved estimate for the project
  SELECT * INTO v_est FROM public.estimates
  WHERE project_id = p_project_id AND status = 'approved'
  ORDER BY approved_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  -- Actual labor: closed time entries with valid hours
  SELECT
    COALESCE(SUM(te.duration_hours), 0),
    COALESCE(SUM(
      CASE WHEN pm.cost_rate IS NOT NULL AND pm.cost_rate > 0
      THEN te.duration_hours * pm.cost_rate
      ELSE 0 END
    ), 0),
    COALESCE(SUM(
      CASE WHEN pm.cost_rate IS NULL OR pm.cost_rate = 0
      THEN te.duration_hours ELSE 0 END
    ), 0),
    COALESCE(SUM(
      CASE WHEN te.task_id IS NULL THEN te.duration_hours ELSE 0 END
    ), 0)
  INTO v_labor_hours, v_labor_cost, v_missing_rates_hours, v_unassigned_hours
  FROM public.time_entries te
  LEFT JOIN public.project_members pm ON pm.user_id = te.user_id AND pm.project_id = te.project_id
  WHERE te.project_id = p_project_id
    AND te.status = 'closed'
    AND te.check_out_at IS NOT NULL
    AND te.duration_hours IS NOT NULL
    AND te.duration_hours > 0;

  -- Actual receipts by cost_type
  SELECT
    COALESCE(SUM(CASE WHEN r.cost_type = 'material' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type = 'machine' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type = 'other' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type = 'unclassified' OR r.cost_type IS NULL THEN r.amount ELSE 0 END), 0)
  INTO v_mat_cost, v_machine_cost, v_other_cost, v_unclassified
  FROM public.receipts r
  WHERE r.project_id = p_project_id
    AND r.review_status = 'reviewed';

  RETURN jsonb_build_object(
    'has_estimate', v_est IS NOT NULL,
    'estimate_id', v_est.id,
    'planned', jsonb_build_object(
      'labor_hours', COALESCE(v_est.planned_labor_hours, 0),
      'labor_bill_amount', COALESCE(v_est.planned_labor_bill_amount, 0),
      'material_cost', COALESCE(v_est.planned_material_cost, 0),
      'machine_cost', COALESCE(v_est.planned_machine_cost, 0),
      'other_cost', COALESCE(v_est.planned_other_cost, 0),
      'total_cost', COALESCE(v_est.planned_total_cost, 0),
      'contract_value', COALESCE(v_est.contract_value, 0),
      'profit', COALESCE(v_est.planned_profit, 0),
      'margin_percent', COALESCE(v_est.planned_margin_percent, 0)
    ),
    'actual', jsonb_build_object(
      'labor_hours', v_labor_hours,
      'labor_cost', v_labor_cost,
      'material_cost', v_mat_cost,
      'machine_cost', v_machine_cost,
      'other_cost', v_other_cost,
      'unclassified_cost', v_unclassified,
      'total_cost', ROUND(v_labor_cost + v_mat_cost + v_machine_cost + v_other_cost + v_unclassified, 2)
    ),
    'deltas', jsonb_build_object(
      'labor_hours', ROUND(v_labor_hours - COALESCE(v_est.planned_labor_hours, 0), 2),
      'labor_cost', ROUND(v_labor_cost - COALESCE(v_est.planned_labor_bill_amount, 0), 2),
      'material', ROUND(v_mat_cost - COALESCE(v_est.planned_material_cost, 0), 2),
      'machine', ROUND(v_machine_cost - COALESCE(v_est.planned_machine_cost, 0), 2),
      'other', ROUND(v_other_cost - COALESCE(v_est.planned_other_cost, 0), 2),
      'total_cost', ROUND(
        (v_labor_cost + v_mat_cost + v_machine_cost + v_other_cost + v_unclassified)
        - COALESCE(v_est.planned_total_cost, 0), 2)
    ),
    'margin', jsonb_build_object(
      'contract_value', COALESCE(v_est.contract_value, 0),
      'actual_profit', ROUND(COALESCE(v_est.contract_value, 0) - (v_labor_cost + v_mat_cost + v_machine_cost + v_other_cost + v_unclassified), 2),
      'actual_margin_percent', CASE WHEN COALESCE(v_est.contract_value, 0) > 0
        THEN ROUND(((COALESCE(v_est.contract_value, 0) - (v_labor_cost + v_mat_cost + v_machine_cost + v_other_cost + v_unclassified)) / v_est.contract_value) * 100, 1)
        ELSE 0 END
    ),
    'diagnostics', jsonb_build_object(
      'missing_cost_rates_hours', v_missing_rates_hours,
      'unassigned_time_hours', v_unassigned_hours,
      'unclassified_receipts_amount', v_unclassified
    )
  );
END;
$$;
