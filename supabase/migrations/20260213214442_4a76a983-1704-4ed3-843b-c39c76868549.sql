
-- =============================================
-- Budget-to-Execution Intelligence Functions
-- =============================================

-- Index: invoices by project_id (for invoicing summary)
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

-- =============================================
-- 1. project_actual_costs
-- =============================================
CREATE OR REPLACE FUNCTION public.project_actual_costs(p_project_id uuid)
RETURNS TABLE (
  actual_labor_hours numeric(10,2),
  actual_labor_cost numeric(12,2),
  actual_labor_billable numeric(12,2),
  actual_material_cost numeric(12,2),
  actual_machine_cost numeric(12,2),
  actual_other_cost numeric(12,2),
  actual_total_cost numeric(12,2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.projects WHERE id = p_project_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  IF NOT public.is_org_member(auth.uid(), v_org_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH labor AS (
    SELECT
      COALESCE(ROUND(SUM(te.duration_hours), 2), 0) AS hours,
      COALESCE(ROUND(SUM(te.duration_hours * COALESCE(pm.cost_rate, 0)), 2), 0) AS cost,
      COALESCE(ROUND(SUM(te.duration_hours * COALESCE(pm.bill_rate, 0)), 2), 0) AS billable
    FROM public.time_entries te
    LEFT JOIN public.project_members pm
      ON pm.project_id = te.project_id AND pm.user_id = te.user_id
    WHERE te.project_id = p_project_id
      AND te.status = 'closed'
      AND te.duration_hours IS NOT NULL
  ),
  receipts_agg AS (
    SELECT
      COALESCE(ROUND(SUM(CASE WHEN r.cost_type = 'material' THEN r.amount ELSE 0 END), 2), 0) AS mat,
      COALESCE(ROUND(SUM(CASE WHEN r.cost_type = 'machine'  THEN r.amount ELSE 0 END), 2), 0) AS mach,
      COALESCE(ROUND(SUM(CASE WHEN r.cost_type = 'other'    THEN r.amount ELSE 0 END), 2), 0) AS oth
    FROM public.receipts r
    WHERE r.project_id = p_project_id
  )
  SELECT
    labor.hours,
    labor.cost,
    labor.billable,
    receipts_agg.mat,
    receipts_agg.mach,
    receipts_agg.oth,
    ROUND(labor.cost + receipts_agg.mat + receipts_agg.mach + receipts_agg.oth, 2)
  FROM labor, receipts_agg;
END;
$$;

-- =============================================
-- 2. project_invoicing_summary
-- =============================================
CREATE OR REPLACE FUNCTION public.project_invoicing_summary(p_project_id uuid)
RETURNS TABLE (
  contract_value numeric(12,2),
  invoiced_amount numeric(12,2),
  remainder_to_invoice numeric(12,2),
  billed_percentage numeric(6,2),
  current_percent_to_bill numeric(6,2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_contract numeric(12,2);
  v_invoiced numeric(12,2);
BEGIN
  SELECT organization_id INTO v_org_id FROM public.projects WHERE id = p_project_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF NOT public.is_org_member(auth.uid(), v_org_id) THEN RAISE EXCEPTION 'Access denied'; END IF;

  SELECT COALESCE(pb.contract_value, 0) INTO v_contract
  FROM public.project_budgets pb WHERE pb.project_id = p_project_id;
  IF NOT FOUND THEN v_contract := 0; END IF;

  SELECT COALESCE(ROUND(SUM(i.total), 2), 0) INTO v_invoiced
  FROM public.invoices i
  WHERE i.project_id = p_project_id AND i.status <> 'void';

  RETURN QUERY SELECT
    v_contract,
    v_invoiced,
    ROUND(v_contract - v_invoiced, 2),
    ROUND(COALESCE(v_invoiced * 100.0 / NULLIF(v_contract, 0), 0), 2),
    ROUND(COALESCE((v_contract - v_invoiced) * 100.0 / NULLIF(v_contract, 0), 0), 2);
END;
$$;

-- =============================================
-- 3. project_variance_summary
-- =============================================
CREATE OR REPLACE FUNCTION public.project_variance_summary(p_project_id uuid)
RETURNS TABLE (
  contract_value numeric(12,2),
  planned_labor_hours numeric(10,2),
  actual_labor_hours numeric(10,2),
  labor_hours_delta numeric(10,2),
  planned_labor_cost numeric(12,2),
  actual_labor_cost numeric(12,2),
  labor_cost_delta numeric(12,2),
  planned_material_cost numeric(12,2),
  actual_material_cost numeric(12,2),
  material_cost_delta numeric(12,2),
  planned_machine_cost numeric(12,2),
  actual_machine_cost numeric(12,2),
  machine_cost_delta numeric(12,2),
  planned_other_cost numeric(12,2),
  actual_other_cost numeric(12,2),
  other_cost_delta numeric(12,2),
  planned_total_cost numeric(12,2),
  actual_total_cost numeric(12,2),
  total_cost_delta numeric(12,2),
  planned_profit numeric(12,2),
  actual_profit numeric(12,2),
  planned_margin_percent numeric(6,2),
  actual_margin_percent numeric(6,2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  b RECORD;
  a RECORD;
  v_cv numeric(12,2);
  v_pt numeric(12,2);
BEGIN
  SELECT organization_id INTO v_org_id FROM public.projects WHERE id = p_project_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF NOT public.is_org_member(auth.uid(), v_org_id) THEN RAISE EXCEPTION 'Access denied'; END IF;

  SELECT
    COALESCE(pb.contract_value, 0),
    COALESCE(pb.planned_labor_hours, 0),
    COALESCE(pb.planned_labor_cost, 0),
    COALESCE(pb.planned_material_cost, 0),
    COALESCE(pb.planned_machine_cost, 0),
    COALESCE(pb.planned_other_cost, 0)
  INTO v_cv, b.lh, b.lc, b.mc, b.mac, b.oc
  FROM public.project_budgets pb WHERE pb.project_id = p_project_id;

  IF NOT FOUND THEN
    v_cv := 0; b.lh := 0; b.lc := 0; b.mc := 0; b.mac := 0; b.oc := 0;
  END IF;

  SELECT * INTO a FROM public.project_actual_costs(p_project_id);

  v_pt := ROUND(b.lc + b.mc + b.mac + b.oc, 2);

  RETURN QUERY SELECT
    v_cv,
    b.lh, a.actual_labor_hours, ROUND(b.lh - a.actual_labor_hours, 2),
    b.lc, a.actual_labor_cost, ROUND(b.lc - a.actual_labor_cost, 2),
    b.mc, a.actual_material_cost, ROUND(b.mc - a.actual_material_cost, 2),
    b.mac, a.actual_machine_cost, ROUND(b.mac - a.actual_machine_cost, 2),
    b.oc, a.actual_other_cost, ROUND(b.oc - a.actual_other_cost, 2),
    v_pt, a.actual_total_cost, ROUND(v_pt - a.actual_total_cost, 2),
    ROUND(v_cv - v_pt, 2),
    ROUND(v_cv - a.actual_total_cost, 2),
    ROUND(COALESCE((v_cv - v_pt) * 100.0 / NULLIF(v_cv, 0), 0), 2),
    ROUND(COALESCE((v_cv - a.actual_total_cost) * 100.0 / NULLIF(v_cv, 0), 0), 2);
END;
$$;

-- =============================================
-- 4. project_portfolio_report
-- =============================================
CREATE OR REPLACE FUNCTION public.project_portfolio_report(
  p_org_id uuid,
  p_status_filter text DEFAULT NULL
)
RETURNS TABLE (
  project_id uuid,
  job_number text,
  customer_name text,
  project_name text,
  status text,
  contract_value numeric(12,2),
  invoiced_amount numeric(12,2),
  remainder_to_invoice numeric(12,2),
  billed_percentage numeric(6,2),
  current_percent_to_bill numeric(6,2),
  planned_labor_hours numeric(10,2),
  actual_labor_hours numeric(10,2),
  labor_hours_delta numeric(10,2),
  planned_total_cost numeric(12,2),
  actual_total_cost numeric(12,2),
  total_cost_delta numeric(12,2),
  planned_profit numeric(12,2),
  actual_profit numeric(12,2),
  planned_margin_percent numeric(6,2),
  actual_margin_percent numeric(6,2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_member(auth.uid(), p_org_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.job_number,
    c.name,
    p.name,
    p.status,
    v.contract_value,
    inv.invoiced_amount,
    inv.remainder_to_invoice,
    inv.billed_percentage,
    inv.current_percent_to_bill,
    v.planned_labor_hours,
    v.actual_labor_hours,
    v.labor_hours_delta,
    v.planned_total_cost,
    v.actual_total_cost,
    v.total_cost_delta,
    v.planned_profit,
    v.actual_profit,
    v.planned_margin_percent,
    v.actual_margin_percent
  FROM public.projects p
  LEFT JOIN public.clients c ON c.id = p.client_id
  LEFT JOIN LATERAL public.project_variance_summary(p.id) v ON true
  LEFT JOIN LATERAL public.project_invoicing_summary(p.id) inv ON true
  WHERE p.organization_id = p_org_id
    AND p.is_deleted = false
    AND (p_status_filter IS NULL OR p.status = p_status_filter);
END;
$$;
