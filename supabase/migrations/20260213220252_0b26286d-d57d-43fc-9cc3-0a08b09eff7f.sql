
-- Drop functions whose return types changed
DROP FUNCTION IF EXISTS public.project_actual_costs(uuid);
DROP FUNCTION IF EXISTS public.project_variance_summary(uuid);
DROP FUNCTION IF EXISTS public.project_invoicing_summary(uuid);
DROP FUNCTION IF EXISTS public.project_invoicing_summary(uuid, boolean, boolean);
DROP FUNCTION IF EXISTS public.project_portfolio_report(uuid, text);
DROP FUNCTION IF EXISTS public.project_portfolio_report(uuid, text, int, int, date, date);

-- ============================================================
-- A) project_invoicing_summary
-- ============================================================
CREATE OR REPLACE FUNCTION public.project_invoicing_summary(
  p_project_id uuid,
  p_include_drafts boolean default false,
  p_include_scheduled boolean default true
)
RETURNS TABLE (
  contract_value numeric,
  invoiced_amount_strict numeric,
  invoiced_amount_relaxed numeric,
  remainder_strict numeric,
  remainder_relaxed numeric,
  billed_pct_strict numeric,
  billed_pct_relaxed numeric,
  invoice_count_strict int,
  invoice_count_relaxed int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_cv numeric;
  v_strict numeric;
  v_relaxed numeric;
  v_cnt_strict int;
  v_cnt_relaxed int;
BEGIN
  SELECT p.organization_id INTO v_org_id
  FROM public.projects p WHERE p.id = p_project_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found: %', p_project_id;
  END IF;
  IF NOT public.has_org_membership(v_org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization';
  END IF;

  SELECT COALESCE(b.contract_value, 0) INTO v_cv
  FROM public.project_budgets b WHERE b.project_id = p_project_id;
  IF v_cv IS NULL THEN v_cv := 0; END IF;

  SELECT COALESCE(SUM(i.total), 0), COUNT(*)::int
  INTO v_strict, v_cnt_strict
  FROM public.invoices i
  WHERE i.project_id = p_project_id
    AND i.status IN ('sent', 'paid', 'overdue');

  SELECT COALESCE(SUM(i.total), 0), COUNT(*)::int
  INTO v_relaxed, v_cnt_relaxed
  FROM public.invoices i
  WHERE i.project_id = p_project_id
    AND i.status != 'void'
    AND (p_include_drafts OR i.status != 'draft');

  RETURN QUERY SELECT
    round(v_cv, 2),
    round(v_strict, 2),
    round(v_relaxed, 2),
    round(v_cv - v_strict, 2),
    round(v_cv - v_relaxed, 2),
    round(CASE WHEN v_cv > 0 THEN (v_strict / v_cv) * 100 ELSE 0 END, 2),
    round(CASE WHEN v_cv > 0 THEN (v_relaxed / v_cv) * 100 ELSE 0 END, 2),
    v_cnt_strict,
    v_cnt_relaxed;
END;
$$;

-- ============================================================
-- B+C) project_actual_costs — with diagnostics
-- ============================================================
CREATE OR REPLACE FUNCTION public.project_actual_costs(p_project_id uuid)
RETURNS TABLE (
  actual_labor_hours numeric,
  actual_labor_cost numeric,
  actual_material_cost numeric,
  actual_machine_cost numeric,
  actual_other_cost numeric,
  actual_total_cost numeric,
  labor_hours_missing_cost_rate numeric,
  labor_hours_missing_membership numeric,
  labor_entry_count_missing_cost_rate int,
  labor_entry_count_missing_membership int,
  actual_unclassified_cost numeric,
  unclassified_receipt_count int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_labor_hours numeric := 0;
  v_labor_cost numeric := 0;
  v_material numeric := 0;
  v_machine numeric := 0;
  v_other numeric := 0;
  v_hrs_no_rate numeric := 0;
  v_hrs_no_member numeric := 0;
  v_cnt_no_rate int := 0;
  v_cnt_no_member int := 0;
  v_unclassified numeric := 0;
  v_unclassified_cnt int := 0;
BEGIN
  SELECT p.organization_id INTO v_org_id
  FROM public.projects p WHERE p.id = p_project_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found: %', p_project_id;
  END IF;
  IF NOT public.has_org_membership(v_org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization';
  END IF;

  SELECT
    COALESCE(SUM(te.duration_hours), 0),
    COALESCE(SUM(te.duration_hours * COALESCE(pm.cost_rate, 0)), 0),
    COALESCE(SUM(CASE WHEN pm.user_id IS NOT NULL AND COALESCE(pm.cost_rate, 0) = 0 THEN te.duration_hours ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN pm.user_id IS NULL THEN te.duration_hours ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN pm.user_id IS NOT NULL AND COALESCE(pm.cost_rate, 0) = 0 THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN pm.user_id IS NULL THEN 1 ELSE 0 END), 0)::int
  INTO v_labor_hours, v_labor_cost, v_hrs_no_rate, v_hrs_no_member, v_cnt_no_rate, v_cnt_no_member
  FROM public.time_entries te
  LEFT JOIN public.project_members pm ON pm.project_id = te.project_id AND pm.user_id = te.user_id
  WHERE te.project_id = p_project_id
    AND te.status = 'closed'
    AND te.duration_hours IS NOT NULL;

  SELECT
    COALESCE(SUM(CASE WHEN r.cost_type = 'material' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type = 'machine' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type = 'other' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type NOT IN ('material','machine','other') OR r.cost_type IS NULL THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type NOT IN ('material','machine','other') OR r.cost_type IS NULL THEN 1 ELSE 0 END), 0)::int
  INTO v_material, v_machine, v_other, v_unclassified, v_unclassified_cnt
  FROM public.receipts r
  WHERE r.project_id = p_project_id AND r.status != 'rejected';

  RETURN QUERY SELECT
    round(v_labor_hours, 2), round(v_labor_cost, 2),
    round(v_material, 2), round(v_machine, 2), round(v_other, 2),
    round(v_labor_cost + v_material + v_machine + v_other + v_unclassified, 2),
    round(v_hrs_no_rate, 2), round(v_hrs_no_member, 2),
    v_cnt_no_rate, v_cnt_no_member,
    round(v_unclassified, 2), v_unclassified_cnt;
END;
$$;

-- ============================================================
-- D) project_variance_summary — uses updated project_actual_costs
-- ============================================================
CREATE OR REPLACE FUNCTION public.project_variance_summary(p_project_id uuid)
RETURNS TABLE (
  contract_value numeric,
  planned_labor_hours numeric, actual_labor_hours numeric, labor_hours_delta numeric,
  planned_labor_cost numeric, actual_labor_cost numeric, labor_cost_delta numeric,
  planned_material_cost numeric, actual_material_cost numeric, material_cost_delta numeric,
  planned_machine_cost numeric, actual_machine_cost numeric, machine_cost_delta numeric,
  planned_other_cost numeric, actual_other_cost numeric, other_cost_delta numeric,
  planned_total_cost numeric, actual_total_cost numeric, total_cost_delta numeric,
  planned_profit numeric, actual_profit numeric,
  planned_margin_percent numeric, actual_margin_percent numeric,
  labor_hours_missing_cost_rate numeric,
  labor_hours_missing_membership numeric,
  actual_unclassified_cost numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_cv numeric := 0; v_plh numeric := 0; v_plc numeric := 0;
  v_pmc numeric := 0; v_pmac numeric := 0; v_poc numeric := 0;
  a_lh numeric; a_lc numeric; a_mc numeric; a_mac numeric; a_oc numeric; a_tc numeric;
  a_hrs_no_rate numeric; a_hrs_no_member numeric; a_unclass numeric;
  a_cnt_no_rate int; a_cnt_no_member int; a_unclass_cnt int;
  v_ptc numeric; v_pp numeric; v_ap numeric;
BEGIN
  SELECT p.organization_id INTO v_org_id FROM public.projects p WHERE p.id = p_project_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Project not found: %', p_project_id; END IF;
  IF NOT public.has_org_membership(v_org_id) THEN RAISE EXCEPTION 'Access denied'; END IF;

  SELECT COALESCE(b.contract_value,0), COALESCE(b.planned_labor_hours,0),
         COALESCE(b.planned_labor_cost,0), COALESCE(b.planned_material_cost,0),
         COALESCE(b.planned_machine_cost,0), COALESCE(b.planned_other_cost,0)
  INTO v_cv, v_plh, v_plc, v_pmc, v_pmac, v_poc
  FROM public.project_budgets b WHERE b.project_id = p_project_id;

  v_ptc := v_plc + v_pmc + v_pmac + v_poc;
  v_pp := v_cv - v_ptc;

  SELECT ac.actual_labor_hours, ac.actual_labor_cost,
         ac.actual_material_cost, ac.actual_machine_cost,
         ac.actual_other_cost, ac.actual_total_cost,
         ac.labor_hours_missing_cost_rate, ac.labor_hours_missing_membership,
         ac.actual_unclassified_cost
  INTO a_lh, a_lc, a_mc, a_mac, a_oc, a_tc,
       a_hrs_no_rate, a_hrs_no_member, a_unclass
  FROM public.project_actual_costs(p_project_id) ac;

  v_ap := v_cv - a_tc;

  RETURN QUERY SELECT
    round(v_cv,2), round(v_plh,2), round(a_lh,2), round(v_plh - a_lh,2),
    round(v_plc,2), round(a_lc,2), round(v_plc - a_lc,2),
    round(v_pmc,2), round(a_mc,2), round(v_pmc - a_mc,2),
    round(v_pmac,2), round(a_mac,2), round(v_pmac - a_mac,2),
    round(v_poc,2), round(a_oc,2), round(v_poc - a_oc,2),
    round(v_ptc,2), round(a_tc,2), round(v_ptc - a_tc,2),
    round(v_pp,2), round(v_ap,2),
    round(CASE WHEN v_cv > 0 THEN (v_pp/v_cv)*100 ELSE 0 END, 2),
    round(CASE WHEN v_cv > 0 THEN (v_ap/v_cv)*100 ELSE 0 END, 2),
    round(a_hrs_no_rate,2), round(a_hrs_no_member,2), round(a_unclass,2);
END;
$$;

-- ============================================================
-- E) project_portfolio_report — pagination, date filters, diagnostics
-- ============================================================
CREATE OR REPLACE FUNCTION public.project_portfolio_report(
  p_org_id uuid,
  p_status_filter text default null,
  p_limit int default 200,
  p_offset int default 0,
  p_start_date date default null,
  p_end_date date default null
)
RETURNS TABLE (
  project_id uuid, job_number text, customer_name text, project_name text, status text,
  contract_value numeric,
  invoiced_amount numeric, invoiced_amount_strict numeric, invoiced_amount_relaxed numeric,
  remainder_to_invoice numeric, billed_percentage numeric, current_percent_to_bill numeric,
  planned_labor_hours numeric, actual_labor_hours numeric, labor_hours_delta numeric,
  planned_total_cost numeric, actual_total_cost numeric, total_cost_delta numeric,
  planned_profit numeric, actual_profit numeric,
  planned_margin_percent numeric, actual_margin_percent numeric,
  labor_hours_missing_cost_rate numeric, labor_hours_missing_membership numeric,
  actual_unclassified_cost numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT public.has_org_membership(p_org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.job_number::text,
    c.name::text,
    p.name::text,
    p.status::text,
    round(COALESCE(b.contract_value,0),2),
    round(COALESCE(inv.invoiced_amount_strict,0),2),
    round(COALESCE(inv.invoiced_amount_strict,0),2),
    round(COALESCE(inv.invoiced_amount_relaxed,0),2),
    round(COALESCE(b.contract_value,0) - COALESCE(inv.invoiced_amount_strict,0),2),
    round(CASE WHEN COALESCE(b.contract_value,0)>0
               THEN (COALESCE(inv.invoiced_amount_strict,0)/b.contract_value)*100 ELSE 0 END,2),
    round(COALESCE(b.planned_billable_amount,0),2),
    round(COALESCE(b.planned_labor_hours,0),2),
    round(COALESCE(ac.actual_labor_hours,0),2),
    round(COALESCE(b.planned_labor_hours,0) - COALESCE(ac.actual_labor_hours,0),2),
    round(COALESCE(b.planned_labor_cost,0)+COALESCE(b.planned_material_cost,0)
          +COALESCE(b.planned_machine_cost,0)+COALESCE(b.planned_other_cost,0),2),
    round(COALESCE(ac.actual_total_cost,0),2),
    round((COALESCE(b.planned_labor_cost,0)+COALESCE(b.planned_material_cost,0)
          +COALESCE(b.planned_machine_cost,0)+COALESCE(b.planned_other_cost,0))
          - COALESCE(ac.actual_total_cost,0),2),
    round(COALESCE(b.contract_value,0)
          -(COALESCE(b.planned_labor_cost,0)+COALESCE(b.planned_material_cost,0)
            +COALESCE(b.planned_machine_cost,0)+COALESCE(b.planned_other_cost,0)),2),
    round(COALESCE(b.contract_value,0)-COALESCE(ac.actual_total_cost,0),2),
    round(CASE WHEN COALESCE(b.contract_value,0)>0
               THEN ((COALESCE(b.contract_value,0)
                     -(COALESCE(b.planned_labor_cost,0)+COALESCE(b.planned_material_cost,0)
                       +COALESCE(b.planned_machine_cost,0)+COALESCE(b.planned_other_cost,0)))
                     /b.contract_value)*100 ELSE 0 END,2),
    round(CASE WHEN COALESCE(b.contract_value,0)>0
               THEN ((COALESCE(b.contract_value,0)-COALESCE(ac.actual_total_cost,0))
                     /b.contract_value)*100 ELSE 0 END,2),
    round(COALESCE(ac.labor_hours_missing_cost_rate,0),2),
    round(COALESCE(ac.labor_hours_missing_membership,0),2),
    round(COALESCE(ac.actual_unclassified_cost,0),2)
  FROM public.projects p
  LEFT JOIN public.clients c ON c.id = p.client_id
  LEFT JOIN public.project_budgets b ON b.project_id = p.id
  LEFT JOIN LATERAL public.project_actual_costs(p.id) ac ON true
  LEFT JOIN LATERAL public.project_invoicing_summary(p.id) inv ON true
  WHERE p.organization_id = p_org_id
    AND p.is_deleted = false
    AND (p_status_filter IS NULL OR p.status = p_status_filter)
    AND (p_start_date IS NULL OR p.start_date >= p_start_date)
    AND (p_end_date IS NULL OR p.end_date <= p_end_date)
  ORDER BY p.name
  LIMIT p_limit OFFSET p_offset;
END;
$$;
