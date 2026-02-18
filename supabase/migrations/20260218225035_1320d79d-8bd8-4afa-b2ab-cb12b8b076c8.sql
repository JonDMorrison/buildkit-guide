
-- Must drop and recreate due to changed return type
DROP FUNCTION IF EXISTS public.project_actual_costs(uuid);

CREATE FUNCTION public.project_actual_costs(p_project_id uuid)
RETURNS TABLE(
  actual_labor_hours numeric,
  actual_labor_cost numeric,
  actual_material_cost numeric,
  actual_machine_cost numeric,
  actual_other_cost numeric,
  actual_total_cost numeric,
  labor_hours_missing_cost_rate numeric,
  labor_hours_missing_membership numeric,
  labor_entry_count_missing_cost_rate integer,
  labor_entry_count_missing_membership integer,
  actual_unclassified_cost numeric,
  unclassified_receipt_count integer,
  labor_hours_currency_mismatch numeric,
  labor_entry_count_currency_mismatch integer,
  project_currency text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_base_currency text;
  v_project_currency text;
  v_labor_hours numeric := 0;
  v_labor_cost numeric := 0;
  v_material numeric := 0;
  v_machine numeric := 0;
  v_other numeric := 0;
  v_hrs_no_rate numeric := 0;
  v_hrs_no_member numeric := 0;
  v_cnt_no_rate int := 0;
  v_cnt_no_member int := 0;
  v_hrs_currency_mm numeric := 0;
  v_cnt_currency_mm int := 0;
  v_unclassified numeric := 0;
  v_unclassified_cnt int := 0;
BEGIN
  SELECT p.organization_id, p.currency INTO v_org_id, v_project_currency
  FROM public.projects p WHERE p.id = p_project_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found: %', p_project_id;
  END IF;
  IF NOT public.has_org_membership(v_org_id) THEN
    RAISE EXCEPTION 'forbidden: not a member of this organization'
      USING ERRCODE = '42501';
  END IF;

  SELECT o.base_currency INTO v_base_currency
  FROM public.organizations o WHERE o.id = v_org_id;

  SELECT
    COALESCE(SUM(te.duration_hours), 0),
    COALESCE(SUM(
      CASE WHEN om.rates_currency = v_base_currency
           THEN te.duration_hours * COALESCE(pm.cost_rate, om.hourly_cost_rate, 0)
           ELSE 0 END
    ), 0),
    COALESCE(SUM(CASE
      WHEN pm.user_id IS NOT NULL
       AND om.rates_currency = v_base_currency
       AND COALESCE(pm.cost_rate, om.hourly_cost_rate, 0) = 0
      THEN te.duration_hours ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN pm.user_id IS NULL AND om.user_id IS NULL THEN te.duration_hours ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN pm.user_id IS NOT NULL
       AND om.rates_currency = v_base_currency
       AND COALESCE(pm.cost_rate, om.hourly_cost_rate, 0) = 0
      THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN pm.user_id IS NULL AND om.user_id IS NULL THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE
      WHEN om.user_id IS NOT NULL AND om.rates_currency != v_base_currency
      THEN te.duration_hours ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN om.user_id IS NOT NULL AND om.rates_currency != v_base_currency
      THEN 1 ELSE 0 END), 0)::int
  INTO v_labor_hours, v_labor_cost, v_hrs_no_rate, v_hrs_no_member,
       v_cnt_no_rate, v_cnt_no_member, v_hrs_currency_mm, v_cnt_currency_mm
  FROM public.time_entries te
  LEFT JOIN public.project_members pm ON pm.project_id = te.project_id AND pm.user_id = te.user_id
  LEFT JOIN public.organization_memberships om ON om.organization_id = v_org_id AND om.user_id = te.user_id AND om.is_active = true
  WHERE te.project_id = p_project_id
    AND te.status = 'closed'
    AND te.check_out_at IS NOT NULL
    AND te.duration_hours IS NOT NULL
    AND te.duration_hours > 0;

  SELECT
    COALESCE(SUM(CASE WHEN r.cost_type = 'material' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type = 'machine' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type = 'other' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type NOT IN ('material','machine','other') OR r.cost_type IS NULL THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type NOT IN ('material','machine','other') OR r.cost_type IS NULL THEN 1 ELSE 0 END), 0)::int
  INTO v_material, v_machine, v_other, v_unclassified, v_unclassified_cnt
  FROM public.receipts r
  WHERE r.project_id = p_project_id
    AND r.review_status IN ('reviewed', 'processed');

  RETURN QUERY SELECT
    round(v_labor_hours, 2), round(v_labor_cost, 2),
    round(v_material, 2), round(v_machine, 2), round(v_other, 2),
    round(v_labor_cost + v_material + v_machine + v_other + v_unclassified, 2),
    round(v_hrs_no_rate, 2), round(v_hrs_no_member, 2),
    v_cnt_no_rate, v_cnt_no_member,
    round(v_unclassified, 2), v_unclassified_cnt,
    round(v_hrs_currency_mm, 2), v_cnt_currency_mm,
    v_project_currency;
END;
$$;
