
-- =============================================================
-- rpc_suggest_change_order_from_risk
-- Deterministic CO suggestion based on profit risk data.
-- Does NOT create records — returns suggestion payload only.
-- =============================================================

CREATE OR REPLACE FUNCTION public.rpc_suggest_change_order_from_risk(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_risk jsonb;
  v_risk_score int;
  v_estimate_total numeric;
  v_actual_total numeric;
  v_projected_final numeric;
  v_overage numeric;
  v_overage_pct numeric;
  v_threshold numeric;
  v_currency text;
  v_project_name text;

  -- Breakdown from rollup
  v_labor_overage numeric := 0;
  v_material_actual numeric := 0;
  v_machine_actual numeric := 0;
  v_other_actual numeric := 0;
  v_est_labor_cost numeric := 0;
  v_est_material numeric := 0;
  v_est_machine numeric := 0;
  v_est_other numeric := 0;

  v_result jsonb;
BEGIN
  -- Auth + access check
  IF NOT has_project_access(p_project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Get profit risk data (reuses the deterministic RPC)
  v_risk := rpc_get_project_profit_risk(p_project_id);

  v_risk_score := COALESCE((v_risk->>'risk_score')::int, 0);
  v_estimate_total := (v_risk->>'estimate_total_cost')::numeric;
  v_actual_total := (v_risk->>'actual_total_cost')::numeric;
  v_projected_final := (v_risk->>'projected_final_cost')::numeric;
  v_currency := COALESCE(v_risk->>'currency', 'CAD');

  -- Get org-level overage threshold from guardrails (default 0.10 = 10%)
  SELECT COALESCE(g.threshold_numeric, 0.10) INTO v_threshold
  FROM organization_guardrails g
  JOIN projects p ON p.organization_id = g.organization_id
  WHERE p.id = p_project_id
    AND g.key = 'overage_risk_threshold'
  LIMIT 1;

  v_threshold := COALESCE(v_threshold, 0.10);

  -- Decision: suggest only if risk_score >= 70 OR projected overrun exceeds threshold
  IF v_estimate_total IS NULL OR v_estimate_total <= 0 THEN
    RETURN jsonb_build_object('suggest', false, 'reason', 'No estimate available for comparison');
  END IF;

  -- Use projected if available, else actual
  v_overage := COALESCE(v_projected_final, v_actual_total) - v_estimate_total;
  v_overage_pct := ROUND((v_overage / v_estimate_total)::numeric, 4);

  IF v_risk_score < 70 AND v_overage_pct <= v_threshold THEN
    RETURN jsonb_build_object(
      'suggest', false,
      'reason', format('Risk score %s < 70 and overage %s%% <= threshold %s%%',
        v_risk_score, ROUND(v_overage_pct * 100, 1), ROUND(v_threshold * 100, 1)),
      'risk_score', v_risk_score,
      'overage_pct', ROUND(v_overage_pct * 100, 2)
    );
  END IF;

  -- Get project name
  SELECT name INTO v_project_name FROM projects WHERE id = p_project_id;

  -- Fetch estimate breakdown for the estimate used in risk calc
  DECLARE
    v_est record;
  BEGIN
    -- Use same logic as profit risk: approved first, then draft
    SELECT * INTO v_est FROM estimates
    WHERE project_id = p_project_id AND status = 'approved'
    ORDER BY updated_at DESC LIMIT 1;

    IF v_est IS NULL THEN
      SELECT * INTO v_est FROM estimates
      WHERE project_id = p_project_id
      ORDER BY updated_at DESC LIMIT 1;
    END IF;

    IF v_est IS NOT NULL THEN
      v_est_material := COALESCE(v_est.planned_material_cost, 0);
      v_est_machine := COALESCE(v_est.planned_machine_cost, 0);
      v_est_other := COALESCE(v_est.planned_other_cost, 0);
      v_est_labor_cost := COALESCE(v_est.planned_total_cost, 0) - v_est_material - v_est_machine - v_est_other;
    END IF;
  END;

  -- Fetch actual breakdown from rollup flags
  DECLARE
    v_rollup jsonb;
  BEGIN
    v_rollup := rpc_get_project_cost_rollup(p_project_id);
    v_material_actual := COALESCE((v_rollup->>'actual_material_cost')::numeric, 0);
    v_machine_actual := COALESCE((v_rollup->>'actual_machine_cost')::numeric, 0);
    v_other_actual := COALESCE((v_rollup->>'actual_other_cost')::numeric, 0);
  END;

  -- Compute per-category overages (only positive = overrun)
  v_labor_overage := GREATEST(0, ROUND(COALESCE(v_actual_total - v_material_actual - v_machine_actual - v_other_actual, 0) - v_est_labor_cost, 2));

  v_result := jsonb_build_object(
    'suggest', true,
    'title', format('Change Order — Cost Overrun on %s', COALESCE(v_project_name, 'Project')),
    'reason', format(
      'Projected/actual costs exceed estimate by %s%% ($%s). Risk score: %s/100.',
      ROUND(v_overage_pct * 100, 1),
      ROUND(v_overage, 2),
      v_risk_score
    ),
    'suggested_amount', ROUND(GREATEST(0, v_overage), 2),
    'currency', v_currency,
    'breakdown', jsonb_build_object(
      'labor', GREATEST(0, v_labor_overage),
      'material', GREATEST(0, ROUND(v_material_actual - v_est_material, 2)),
      'machine', GREATEST(0, ROUND(v_machine_actual - v_est_machine, 2)),
      'other', GREATEST(0, ROUND(v_other_actual - v_est_other, 2))
    ),
    'evidence', jsonb_build_object(
      'estimate_total_cost', v_estimate_total,
      'actual_total_cost', v_actual_total,
      'projected_final_cost', v_projected_final,
      'overage_amount', ROUND(v_overage, 2),
      'overage_pct', ROUND(v_overage_pct * 100, 2),
      'risk_score', v_risk_score,
      'risk_level', v_risk->>'risk_level',
      'drivers', v_risk->'drivers',
      'threshold_pct', ROUND(v_threshold * 100, 1)
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_suggest_change_order_from_risk(uuid) TO authenticated;
