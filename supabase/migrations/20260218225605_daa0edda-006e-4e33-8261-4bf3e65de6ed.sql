
-- 1. Fix estimate_line_items item_type CHECK to match what UI sends
ALTER TABLE public.estimate_line_items DROP CONSTRAINT IF EXISTS estimate_line_items_item_type_check;
ALTER TABLE public.estimate_line_items ADD CONSTRAINT estimate_line_items_item_type_check
  CHECK (item_type = ANY (ARRAY['labor','material','machine','other']));

-- Update any existing rows with old values
UPDATE public.estimate_line_items SET item_type = 'other' WHERE item_type NOT IN ('labor','material','machine','other');

-- 2. Add timestamps to estimate_line_items
ALTER TABLE public.estimate_line_items
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER update_estimate_line_items_updated_at
  BEFORE UPDATE ON public.estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Rebuild estimate_variance_summary with org membership rate fallback + currency mismatch
CREATE OR REPLACE FUNCTION public.estimate_variance_summary(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
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
  v_currency_mismatch_hours numeric := 0;
  v_currency_mismatch_count int := 0;
  v_missing_rates_count int := 0;
  v_org_id uuid;
  v_base_currency text;
  v_project_currency text;
BEGIN
  SELECT p.organization_id, p.currency INTO v_org_id, v_project_currency
  FROM public.projects p WHERE p.id = p_project_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  IF NOT public.has_org_membership(v_org_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT o.base_currency INTO v_base_currency
  FROM public.organizations o WHERE o.id = v_org_id;

  -- Get latest approved estimate (or latest draft if no approved)
  SELECT * INTO v_est FROM public.estimates
  WHERE project_id = p_project_id AND status = 'approved'
  ORDER BY approved_at DESC NULLS LAST, created_at DESC
  LIMIT 1;
  IF v_est IS NULL THEN
    SELECT * INTO v_est FROM public.estimates
    WHERE project_id = p_project_id AND status = 'draft'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Actual labor: closed time entries with valid hours
  -- Use tiered rate: project_members.cost_rate > org_memberships.hourly_cost_rate
  -- Only include if rates_currency matches org base_currency
  SELECT
    COALESCE(SUM(te.duration_hours), 0),
    COALESCE(SUM(
      CASE
        WHEN om.user_id IS NOT NULL AND om.rates_currency = v_base_currency
             AND COALESCE(pm.cost_rate, om.hourly_cost_rate) IS NOT NULL
             AND COALESCE(pm.cost_rate, om.hourly_cost_rate) > 0
        THEN te.duration_hours * COALESCE(pm.cost_rate, om.hourly_cost_rate)
        ELSE 0
      END
    ), 0),
    -- Missing rate hours (member exists, currency ok, but no rate)
    COALESCE(SUM(CASE
      WHEN om.user_id IS NOT NULL
       AND om.rates_currency = v_base_currency
       AND (COALESCE(pm.cost_rate, om.hourly_cost_rate) IS NULL
            OR COALESCE(pm.cost_rate, om.hourly_cost_rate) = 0)
      THEN te.duration_hours ELSE 0 END), 0),
    -- Missing rate count
    COALESCE(SUM(CASE
      WHEN om.user_id IS NOT NULL
       AND om.rates_currency = v_base_currency
       AND (COALESCE(pm.cost_rate, om.hourly_cost_rate) IS NULL
            OR COALESCE(pm.cost_rate, om.hourly_cost_rate) = 0)
      THEN 1 ELSE 0 END), 0)::int,
    -- Currency mismatch hours
    COALESCE(SUM(CASE
      WHEN om.user_id IS NOT NULL AND om.rates_currency != v_base_currency
      THEN te.duration_hours ELSE 0 END), 0),
    -- Currency mismatch count
    COALESCE(SUM(CASE
      WHEN om.user_id IS NOT NULL AND om.rates_currency != v_base_currency
      THEN 1 ELSE 0 END), 0)::int,
    -- Unassigned (no task)
    COALESCE(SUM(CASE WHEN te.task_id IS NULL THEN te.duration_hours ELSE 0 END), 0)
  INTO v_labor_hours, v_labor_cost, v_missing_rates_hours, v_missing_rates_count,
       v_currency_mismatch_hours, v_currency_mismatch_count, v_unassigned_hours
  FROM public.time_entries te
  LEFT JOIN public.project_members pm ON pm.user_id = te.user_id AND pm.project_id = te.project_id
  LEFT JOIN public.organization_memberships om ON om.organization_id = v_org_id AND om.user_id = te.user_id AND om.is_active = true
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
    AND r.review_status IN ('reviewed', 'processed');

  RETURN jsonb_build_object(
    'has_estimate', v_est IS NOT NULL,
    'estimate_id', v_est.id,
    'currency', v_project_currency,
    'planned', jsonb_build_object(
      'labor_hours', COALESCE(v_est.planned_labor_hours, 0),
      'labor_bill_amount', COALESCE(v_est.planned_labor_bill_amount, 0),
      'labor_cost_rate', COALESCE(v_est.labor_cost_rate, 0),
      'material_cost', COALESCE(v_est.planned_material_cost, 0),
      'machine_cost', COALESCE(v_est.planned_machine_cost, 0),
      'other_cost', COALESCE(v_est.planned_other_cost, 0),
      'total_cost', COALESCE(v_est.planned_total_cost, 0),
      'contract_value', COALESCE(v_est.contract_value, 0),
      'profit', COALESCE(v_est.planned_profit, 0),
      'margin_percent', COALESCE(v_est.planned_margin_percent, 0)
    ),
    'actual', jsonb_build_object(
      'labor_hours', ROUND(v_labor_hours, 2),
      'labor_cost', ROUND(v_labor_cost, 2),
      'material_cost', ROUND(v_mat_cost, 2),
      'machine_cost', ROUND(v_machine_cost, 2),
      'other_cost', ROUND(v_other_cost, 2),
      'unclassified_cost', ROUND(v_unclassified, 2),
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
      'missing_cost_rates_hours', ROUND(v_missing_rates_hours, 2),
      'missing_cost_rates_count', v_missing_rates_count,
      'unassigned_time_hours', ROUND(v_unassigned_hours, 2),
      'unclassified_receipts_amount', ROUND(v_unclassified, 2),
      'currency_mismatch_hours', ROUND(v_currency_mismatch_hours, 2),
      'currency_mismatch_count', v_currency_mismatch_count,
      'currency_mismatch_detected', v_currency_mismatch_count > 0,
      'missing_estimate', v_est IS NULL
    )
  );
END;
$$;
