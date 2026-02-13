
-- ============================================================
-- Snapshot writer RPCs
-- ============================================================

-- 1) generate_project_financial_snapshot
CREATE OR REPLACE FUNCTION public.generate_project_financial_snapshot(
  p_project_id uuid,
  p_snapshot_date date,
  p_period text DEFAULT 'weekly'
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_status text;
  v_has_budget boolean;
  v_snapshot_id uuid;
  -- variance
  r_v record;
  -- actuals
  r_a record;
  -- invoicing
  r_i record;
  -- budget fields
  v_planned_labor_cost numeric := 0;
  v_planned_material_cost numeric := 0;
  v_planned_machine_cost numeric := 0;
  v_planned_other_cost numeric := 0;
  v_planned_total_cost numeric := 0;
  v_planned_profit numeric := 0;
  v_planned_margin_pct numeric := 0;
BEGIN
  -- Resolve org + status
  SELECT p.organization_id, p.status
  INTO v_org_id, v_status
  FROM public.projects p
  WHERE p.id = p_project_id AND p.is_deleted = false;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found or deleted: %', p_project_id;
  END IF;

  IF NOT public.has_org_membership(v_org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization';
  END IF;

  -- Get variance summary (includes planned + actual + diagnostics)
  SELECT * INTO r_v FROM public.project_variance_summary(p_project_id);

  -- Get detailed actuals (includes count fields)
  SELECT * INTO r_a FROM public.project_actual_costs(p_project_id);

  -- Get invoicing summary
  SELECT * INTO r_i FROM public.project_invoicing_summary(p_project_id);

  -- Check budget existence
  SELECT EXISTS(SELECT 1 FROM public.project_budgets WHERE project_id = p_project_id) INTO v_has_budget;

  -- Derive planned costs from variance
  v_planned_labor_cost := COALESCE(r_v.planned_labor_cost, 0);
  v_planned_material_cost := COALESCE(r_v.planned_material_cost, 0);
  v_planned_machine_cost := COALESCE(r_v.planned_machine_cost, 0);
  v_planned_other_cost := COALESCE(r_v.planned_other_cost, 0);
  v_planned_total_cost := COALESCE(r_v.planned_total_cost, 0);
  v_planned_profit := COALESCE(r_v.planned_profit, 0);
  v_planned_margin_pct := COALESCE(r_v.planned_margin_percent, 0);

  -- UPSERT
  INSERT INTO public.project_financial_snapshots (
    organization_id, project_id, snapshot_date, snapshot_period, status, has_budget,
    contract_value, planned_labor_hours, planned_labor_cost,
    planned_material_cost, planned_machine_cost, planned_other_cost, planned_total_cost,
    actual_labor_hours, actual_labor_cost, actual_material_cost,
    actual_machine_cost, actual_other_cost, actual_unclassified_cost, actual_total_cost,
    invoiced_amount_strict, remainder_to_invoice_strict, billed_percentage_strict,
    invoiced_amount_relaxed, remainder_to_invoice_relaxed, billed_percentage_relaxed,
    actual_profit, actual_margin_pct,
    planned_profit, planned_margin_pct,
    labor_hours_missing_cost_rate, labor_hours_missing_membership,
    unclassified_receipt_count, labor_entry_count_missing_cost_rate, labor_entry_count_missing_membership,
    created_by
  ) VALUES (
    v_org_id, p_project_id, p_snapshot_date, p_period, v_status, v_has_budget,
    round(COALESCE(r_v.contract_value, 0), 2),
    round(COALESCE(r_v.planned_labor_hours, 0), 2),
    round(v_planned_labor_cost, 2),
    round(v_planned_material_cost, 2),
    round(v_planned_machine_cost, 2),
    round(v_planned_other_cost, 2),
    round(v_planned_total_cost, 2),
    round(COALESCE(r_a.actual_labor_hours, 0), 2),
    round(COALESCE(r_a.actual_labor_cost, 0), 2),
    round(COALESCE(r_a.actual_material_cost, 0), 2),
    round(COALESCE(r_a.actual_machine_cost, 0), 2),
    round(COALESCE(r_a.actual_other_cost, 0), 2),
    round(COALESCE(r_a.actual_unclassified_cost, 0), 2),
    round(COALESCE(r_a.actual_total_cost, 0), 2),
    round(COALESCE(r_i.invoiced_amount_strict, 0), 2),
    round(COALESCE(r_i.remainder_strict, 0), 2),
    round(COALESCE(r_i.billed_pct_strict, 0), 2),
    round(COALESCE(r_i.invoiced_amount_relaxed, 0), 2),
    round(COALESCE(r_i.remainder_relaxed, 0), 2),
    round(COALESCE(r_i.billed_pct_relaxed, 0), 2),
    round(COALESCE(r_v.actual_profit, 0), 2),
    round(COALESCE(r_v.actual_margin_percent, 0), 2),
    round(v_planned_profit, 2),
    round(v_planned_margin_pct, 2),
    round(COALESCE(r_a.labor_hours_missing_cost_rate, 0), 2),
    round(COALESCE(r_a.labor_hours_missing_membership, 0), 2),
    COALESCE(r_a.unclassified_receipt_count, 0),
    COALESCE(r_a.labor_entry_count_missing_cost_rate, 0),
    COALESCE(r_a.labor_entry_count_missing_membership, 0),
    auth.uid()
  )
  ON CONFLICT (project_id, snapshot_date, snapshot_period) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    status = EXCLUDED.status,
    has_budget = EXCLUDED.has_budget,
    contract_value = EXCLUDED.contract_value,
    planned_labor_hours = EXCLUDED.planned_labor_hours,
    planned_labor_cost = EXCLUDED.planned_labor_cost,
    planned_material_cost = EXCLUDED.planned_material_cost,
    planned_machine_cost = EXCLUDED.planned_machine_cost,
    planned_other_cost = EXCLUDED.planned_other_cost,
    planned_total_cost = EXCLUDED.planned_total_cost,
    actual_labor_hours = EXCLUDED.actual_labor_hours,
    actual_labor_cost = EXCLUDED.actual_labor_cost,
    actual_material_cost = EXCLUDED.actual_material_cost,
    actual_machine_cost = EXCLUDED.actual_machine_cost,
    actual_other_cost = EXCLUDED.actual_other_cost,
    actual_unclassified_cost = EXCLUDED.actual_unclassified_cost,
    actual_total_cost = EXCLUDED.actual_total_cost,
    invoiced_amount_strict = EXCLUDED.invoiced_amount_strict,
    remainder_to_invoice_strict = EXCLUDED.remainder_to_invoice_strict,
    billed_percentage_strict = EXCLUDED.billed_percentage_strict,
    invoiced_amount_relaxed = EXCLUDED.invoiced_amount_relaxed,
    remainder_to_invoice_relaxed = EXCLUDED.remainder_to_invoice_relaxed,
    billed_percentage_relaxed = EXCLUDED.billed_percentage_relaxed,
    actual_profit = EXCLUDED.actual_profit,
    actual_margin_pct = EXCLUDED.actual_margin_pct,
    planned_profit = EXCLUDED.planned_profit,
    planned_margin_pct = EXCLUDED.planned_margin_pct,
    labor_hours_missing_cost_rate = EXCLUDED.labor_hours_missing_cost_rate,
    labor_hours_missing_membership = EXCLUDED.labor_hours_missing_membership,
    unclassified_receipt_count = EXCLUDED.unclassified_receipt_count,
    labor_entry_count_missing_cost_rate = EXCLUDED.labor_entry_count_missing_cost_rate,
    labor_entry_count_missing_membership = EXCLUDED.labor_entry_count_missing_membership,
    created_by = EXCLUDED.created_by
  RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END;
$$;

-- 2) generate_org_financial_snapshot
CREATE OR REPLACE FUNCTION public.generate_org_financial_snapshot(
  p_org_id uuid,
  p_snapshot_date date,
  p_period text DEFAULT 'weekly'
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot_id uuid;
  v_total_cv numeric := 0;
  v_total_planned numeric := 0;
  v_total_actual numeric := 0;
  v_total_invoiced numeric := 0;
  v_total_profit numeric := 0;
  v_weighted_margin numeric := 0;
  v_count int := 0;
  v_with_budget int := 0;
  v_missing_budget int := 0;
  v_over_budget int := 0;
  v_sum_cv_for_margin numeric := 0;
BEGIN
  IF NOT public.has_org_membership(p_org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization';
  END IF;

  -- Aggregate from project snapshots for this date+period (already written)
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE has_budget)::int,
    COUNT(*) FILTER (WHERE NOT has_budget)::int,
    COUNT(*) FILTER (WHERE has_budget AND actual_total_cost > planned_total_cost)::int,
    COALESCE(SUM(contract_value), 0),
    COALESCE(SUM(planned_total_cost), 0),
    COALESCE(SUM(actual_total_cost), 0),
    COALESCE(SUM(invoiced_amount_strict), 0),
    COALESCE(SUM(actual_profit), 0),
    COALESCE(SUM(CASE WHEN contract_value > 0 THEN contract_value ELSE 0 END), 0)
  INTO
    v_count, v_with_budget, v_missing_budget, v_over_budget,
    v_total_cv, v_total_planned, v_total_actual, v_total_invoiced,
    v_total_profit, v_sum_cv_for_margin
  FROM public.project_financial_snapshots
  WHERE organization_id = p_org_id
    AND snapshot_date = p_snapshot_date
    AND snapshot_period = p_period;

  -- Weighted margin: sum(actual_profit) / sum(contract_value) * 100 where cv > 0
  IF v_sum_cv_for_margin > 0 THEN
    v_weighted_margin := round((v_total_profit / v_sum_cv_for_margin) * 100, 2);
  END IF;

  INSERT INTO public.org_financial_snapshots (
    organization_id, snapshot_date, snapshot_period,
    total_contract_value, total_planned_cost, total_actual_cost,
    total_invoiced_strict, total_profit_actual, weighted_margin_pct_actual,
    projects_count, projects_with_budget_count, projects_missing_budget_count, projects_over_budget_count
  ) VALUES (
    p_org_id, p_snapshot_date, p_period,
    round(v_total_cv, 2), round(v_total_planned, 2), round(v_total_actual, 2),
    round(v_total_invoiced, 2), round(v_total_profit, 2), v_weighted_margin,
    v_count, v_with_budget, v_missing_budget, v_over_budget
  )
  ON CONFLICT (organization_id, snapshot_date, snapshot_period) DO UPDATE SET
    total_contract_value = EXCLUDED.total_contract_value,
    total_planned_cost = EXCLUDED.total_planned_cost,
    total_actual_cost = EXCLUDED.total_actual_cost,
    total_invoiced_strict = EXCLUDED.total_invoiced_strict,
    total_profit_actual = EXCLUDED.total_profit_actual,
    weighted_margin_pct_actual = EXCLUDED.weighted_margin_pct_actual,
    projects_count = EXCLUDED.projects_count,
    projects_with_budget_count = EXCLUDED.projects_with_budget_count,
    projects_missing_budget_count = EXCLUDED.projects_missing_budget_count,
    projects_over_budget_count = EXCLUDED.projects_over_budget_count
  RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END;
$$;

-- 3) generate_weekly_snapshots_for_org
CREATE OR REPLACE FUNCTION public.generate_weekly_snapshots_for_org(
  p_org_id uuid,
  p_snapshot_date date DEFAULT current_date
)
RETURNS json
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_project record;
  v_count int := 0;
  v_org_snapshot_id uuid;
BEGIN
  IF NOT public.has_org_membership(p_org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization';
  END IF;

  -- Require admin or PM role at org level
  v_caller_role := public.org_role(p_org_id);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'owner', 'pm', 'hr') THEN
    RAISE EXCEPTION 'Access denied: admin or PM role required to generate snapshots';
  END IF;

  -- Iterate non-deleted projects
  FOR v_project IN
    SELECT p.id
    FROM public.projects p
    WHERE p.organization_id = p_org_id AND p.is_deleted = false
    ORDER BY p.name
  LOOP
    PERFORM public.generate_project_financial_snapshot(v_project.id, p_snapshot_date, 'weekly');
    v_count := v_count + 1;
  END LOOP;

  -- Generate org aggregate
  v_org_snapshot_id := public.generate_org_financial_snapshot(p_org_id, p_snapshot_date, 'weekly');

  RETURN json_build_object(
    'projects_snapshotted', v_count,
    'org_snapshot', true,
    'org_snapshot_id', v_org_snapshot_id,
    'snapshot_date', p_snapshot_date
  );
END;
$$;
