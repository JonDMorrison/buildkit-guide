
-- ============================================================
-- rpc_debug_margin_control_inputs
-- Read-only SECURITY DEFINER RPC that exposes the raw numeric
-- inputs consumed by rpc_generate_project_margin_control.
-- Purpose: diagnose why burn ratios / margins default to 0/1.
-- No writes. Security posture unchanged.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_debug_margin_control_inputs(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id       uuid;
  v_user_id      uuid;
  v_is_member    boolean;

  -- snapshot
  v_snap         public.v_project_economic_snapshot%ROWTYPE;

  -- burn index
  v_burn         public.v_project_labor_burn_index%ROWTYPE;

  -- margin projection
  v_proj         public.v_project_margin_projection%ROWTYPE;

  -- estimate
  v_estimate_id  uuid;
  v_est_total    numeric := 0;
  v_est_labor    numeric := 0;
  v_est_material numeric := 0;
  v_est_sub      numeric := 0;

  -- actuals from time_entries
  v_actual_labor numeric := 0;

BEGIN
  -- 1. Resolve caller identity
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- 2. Resolve org from project
  SELECT organization_id INTO v_org_id
  FROM public.projects
  WHERE id = p_project_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'project_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Enforce membership via canonical checker
  SELECT public.rpc_is_org_member(v_org_id) INTO v_is_member;
  IF NOT COALESCE(v_is_member, false) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- 4. Pull economic snapshot row
  SELECT * INTO v_snap
  FROM public.v_project_economic_snapshot
  WHERE project_id = p_project_id;

  -- 5. Pull burn index row
  SELECT * INTO v_burn
  FROM public.v_project_labor_burn_index
  WHERE project_id = p_project_id;

  -- 6. Pull margin projection row
  SELECT * INTO v_proj
  FROM public.v_project_margin_projection
  WHERE project_id = p_project_id;

  -- 7. Find selected estimate deterministically
  --    (status = 'approved' first, then any, order by id ASC, limit 1)
  SELECT id INTO v_estimate_id
  FROM public.estimates
  WHERE project_id = p_project_id
  ORDER BY
    CASE WHEN status = 'approved' THEN 0 ELSE 1 END,
    id ASC
  LIMIT 1;

  -- 8. Compute estimate totals from estimate_line_items
  IF v_estimate_id IS NOT NULL THEN
    SELECT
      COALESCE(SUM(amount), 0),
      COALESCE(SUM(CASE WHEN item_type = 'labor'    THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN item_type = 'material' THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN item_type IN ('subcontractor','sub') THEN amount ELSE 0 END), 0)
    INTO v_est_total, v_est_labor, v_est_material, v_est_sub
    FROM public.estimate_line_items
    WHERE estimate_id = v_estimate_id;
  END IF;

  -- 9. Actual labor cost to date
  --    Tiered fallback: project_members.cost_rate → org_memberships.hourly_cost_rate → 0
  SELECT COALESCE(SUM(
    te.duration_hours * COALESCE(pm.cost_rate, om.hourly_cost_rate, 0)
  ), 0)
  INTO v_actual_labor
  FROM public.time_entries te
  LEFT JOIN public.project_members pm
    ON pm.project_id = te.project_id AND pm.user_id = te.user_id
  LEFT JOIN public.organization_memberships om
    ON om.organization_id = v_org_id AND om.user_id = te.user_id
  WHERE te.project_id = p_project_id
    AND te.check_out_at IS NOT NULL
    AND te.duration_hours > 0;

  -- 10. Return payload
  RETURN jsonb_build_object(
    'project_id', p_project_id,
    'org_id',     v_org_id,
    'inputs', jsonb_build_object(
      'projected_revenue',                   round(COALESCE(v_snap.projected_revenue, 0)::numeric, 2),
      'contract_value_used',                 round(COALESCE(v_snap.projected_revenue, 0)::numeric, 2),
      'selected_estimate_id',                v_estimate_id,
      'estimate_total_cost',                 round(v_est_total,    2),
      'estimate_labor_cost',                 round(v_est_labor,    2),
      'estimate_material_cost',              round(v_est_material, 2),
      'estimate_sub_cost',                   round(v_est_sub,      2),
      'actual_labor_cost_to_date',           round(v_actual_labor, 2),
      'actual_material_cost_to_date',        0,
      'actual_sub_cost_to_date',             0,
      'actual_total_cost_to_date',           round(v_actual_labor, 2),
      'labor_cost_ratio_used',               round(COALESCE(v_burn.labor_cost_ratio, 0)::numeric,                         4),
      'projected_margin_at_completion_ratio_used', round(COALESCE(v_proj.projected_margin_at_completion_ratio, 0)::numeric, 4),
      -- snapshot raw actuals for cross-reference
      'snapshot_actual_labor_cost',          round(COALESCE(v_snap.actual_labor_cost,    0)::numeric, 2),
      'snapshot_actual_material_cost',       round(COALESCE(v_snap.actual_material_cost, 0)::numeric, 2),
      'snapshot_actual_total_cost',          round(COALESCE(v_snap.actual_cost,          0)::numeric, 2),
      'snapshot_realized_margin_ratio',      round(COALESCE(v_snap.realized_margin_ratio,   0)::numeric, 4),
      'snapshot_cost_to_revenue_ratio',      round(COALESCE(v_snap.cost_to_revenue_ratio,   0)::numeric, 4)
    ),
    'sources', jsonb_build_object(
      'snapshot_source',   'v_project_economic_snapshot',
      'burn_source',       'v_project_labor_burn_index',
      'margin_source',     'v_project_margin_projection',
      'estimate_source',   CASE WHEN v_estimate_id IS NOT NULL THEN 'estimates + estimate_line_items' ELSE 'no estimate found' END,
      'labor_cost_source', 'time_entries × (project_members.cost_rate OR organization_memberships.hourly_cost_rate)',
      'material_actuals',  'not_tracked (returning 0)',
      'sub_actuals',       'not_tracked (returning 0)'
    )
  );
END;
$$;

-- Grant execute to authenticated only
REVOKE ALL ON FUNCTION public.rpc_debug_margin_control_inputs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_debug_margin_control_inputs(uuid) TO authenticated;
