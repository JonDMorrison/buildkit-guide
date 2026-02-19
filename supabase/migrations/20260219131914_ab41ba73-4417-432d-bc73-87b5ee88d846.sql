
-- =============================================================
-- rpc_get_project_profit_risk
-- Deterministic profit projection + risk scoring
-- SECURITY DEFINER, org-scoped via has_project_access
-- =============================================================

CREATE OR REPLACE FUNCTION public.rpc_get_project_profit_risk(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project record;
  v_rollup jsonb;
  v_estimate record;
  v_has_approved_estimate boolean := false;
  v_workflow_phase text := null;
  v_burn_rate numeric := null;
  v_remaining_days numeric := null;
  v_projected_final_labor_hours numeric := null;
  v_projected_final_cost numeric := null;
  v_projected_margin numeric := null;
  v_expected_revenue numeric := null;
  v_risk_score int := 0;
  v_risk_level text;
  v_drivers jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  -- ── Auth & access ──
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT has_project_access(p_project_id, ARRAY['admin','pm','worker','accounting']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- ── Load project ──
  SELECT id, organization_id, currency, start_date, end_date, status
    INTO v_project
    FROM projects
   WHERE id = p_project_id AND is_deleted = false;

  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501';
  END IF;

  -- ── Get cost rollup (reuse canonical RPC internally) ──
  v_rollup := rpc_get_project_cost_rollup(p_project_id);

  -- ── Get estimate: prefer latest approved, fallback to latest draft ──
  SELECT id, contract_value, planned_total_cost, planned_labor_hours,
         planned_labor_bill_rate, planned_labor_bill_amount,
         planned_material_cost, planned_machine_cost, planned_other_cost,
         planned_margin_percent, planned_profit, status, currency
    INTO v_estimate
    FROM estimates
   WHERE project_id = p_project_id
     AND status = 'approved'
   ORDER BY approved_at DESC NULLS LAST, created_at DESC
   LIMIT 1;

  IF v_estimate.id IS NOT NULL THEN
    v_has_approved_estimate := true;
  ELSE
    -- Fallback to latest draft
    SELECT id, contract_value, planned_total_cost, planned_labor_hours,
           planned_labor_bill_rate, planned_labor_bill_amount,
           planned_material_cost, planned_machine_cost, planned_other_cost,
           planned_margin_percent, planned_profit, status, currency
      INTO v_estimate
      FROM estimates
     WHERE project_id = p_project_id
     ORDER BY created_at DESC
     LIMIT 1;
  END IF;

  -- ── Expected revenue = contract_value from estimate (or null) ──
  IF v_estimate.id IS NOT NULL THEN
    v_expected_revenue := v_estimate.contract_value;
  END IF;

  -- ── Workflow phase (if exists) ──
  SELECT current_phase INTO v_workflow_phase
    FROM project_workflows
   WHERE project_id = p_project_id;

  -- ── Burn rate: labor hours per day over last 14 days of activity ──
  -- Uses distinct calendar days with closed entries
  DECLARE
    v_burn_days int;
    v_burn_hours numeric;
  BEGIN
    SELECT COUNT(DISTINCT (te.check_in_at::date)),
           COALESCE(SUM(te.duration_hours), 0)
      INTO v_burn_days, v_burn_hours
      FROM time_entries te
     WHERE te.project_id = p_project_id
       AND te.status = 'closed'
       AND te.check_out_at IS NOT NULL
       AND te.duration_hours IS NOT NULL
       AND te.duration_hours > 0
       AND te.check_in_at >= (now() - interval '14 days');

    IF v_burn_days >= 2 THEN
      v_burn_rate := ROUND((v_burn_hours / v_burn_days)::numeric, 4);
    END IF;
  END;

  -- ── Projected final labor hours ──
  IF v_burn_rate IS NOT NULL AND v_project.end_date IS NOT NULL AND v_project.end_date::date > CURRENT_DATE THEN
    v_remaining_days := (v_project.end_date::date - CURRENT_DATE)::numeric;
    v_projected_final_labor_hours := GREATEST(
      (v_rollup->>'actual_labor_hours')::numeric,
      (v_rollup->>'actual_labor_hours')::numeric + (v_burn_rate * v_remaining_days)
    );
  END IF;

  -- ── Projected final cost ──
  -- Heuristic: if we can project labor hours and have an estimate cost rate, project remaining labor cost
  -- Add current non-labor actuals as-is (materials/machine/other already incurred)
  IF v_projected_final_labor_hours IS NOT NULL AND v_estimate.id IS NOT NULL AND v_estimate.planned_labor_hours > 0 THEN
    DECLARE
      v_avg_labor_cost_rate numeric;
      v_projected_remaining_labor_cost numeric;
      v_remaining_labor_hours numeric;
    BEGIN
      -- Average labor cost rate from estimate
      v_avg_labor_cost_rate := ROUND((v_estimate.planned_total_cost - v_estimate.planned_material_cost - v_estimate.planned_machine_cost - v_estimate.planned_other_cost) / NULLIF(v_estimate.planned_labor_hours, 0), 2);
      
      IF v_avg_labor_cost_rate IS NOT NULL AND v_avg_labor_cost_rate > 0 THEN
        v_remaining_labor_hours := GREATEST(0, v_projected_final_labor_hours - (v_rollup->>'actual_labor_hours')::numeric);
        v_projected_remaining_labor_cost := ROUND(v_remaining_labor_hours * v_avg_labor_cost_rate, 2);
        v_projected_final_cost := ROUND(
          (v_rollup->>'actual_total_cost')::numeric + v_projected_remaining_labor_cost, 2
        );
      END IF;
    END;
  END IF;

  -- If no projection possible, fallback: projected = actual (conservative)
  IF v_projected_final_cost IS NULL AND v_estimate.id IS NOT NULL THEN
    v_projected_final_cost := NULL; -- explicitly null = insufficient data
  END IF;

  -- ── Projected margin ──
  IF v_projected_final_cost IS NOT NULL AND v_expected_revenue IS NOT NULL AND v_expected_revenue > 0 THEN
    v_projected_margin := ROUND(((v_expected_revenue - v_projected_final_cost) / v_expected_revenue * 100)::numeric, 2);
  END IF;

  -- ══════════════════════════════════════════════
  -- RISK SCORE (0-100, deterministic, additive)
  -- ══════════════════════════════════════════════

  -- Driver 1: Cost overrun projection (+30)
  IF v_projected_final_cost IS NOT NULL AND v_estimate.id IS NOT NULL AND v_estimate.planned_total_cost > 0 THEN
    IF v_projected_final_cost > (v_estimate.planned_total_cost * 1.10) THEN
      v_risk_score := v_risk_score + 30;
      v_drivers := v_drivers || jsonb_build_object(
        'key', 'cost_overrun_projected',
        'label', 'Projected cost exceeds estimate by >10%',
        'severity', 'high',
        'evidence', format('Projected $%s vs Estimate $%s (+%s%%)',
          ROUND(v_projected_final_cost, 2),
          ROUND(v_estimate.planned_total_cost, 2),
          ROUND(((v_projected_final_cost - v_estimate.planned_total_cost) / v_estimate.planned_total_cost * 100)::numeric, 1)
        )
      );
    END IF;
  END IF;

  -- Driver 2: Unrated labor hours (+20)
  IF (v_rollup->>'unrated_labor_hours')::numeric > 0 THEN
    v_risk_score := v_risk_score + 20;
    v_drivers := v_drivers || jsonb_build_object(
      'key', 'unrated_labor',
      'label', 'Unrated labor hours detected',
      'severity', 'medium',
      'evidence', format('%s hours across %s entries have no cost rate',
        (v_rollup->>'unrated_labor_hours'),
        (v_rollup->>'unrated_labor_entries_count')
      )
    );
  END IF;

  -- Driver 3: Missing reviewed receipts (+15)
  IF (v_rollup->'flags'->>'missing_receipts')::boolean THEN
    v_risk_score := v_risk_score + 15;
    v_drivers := v_drivers || jsonb_build_object(
      'key', 'missing_receipts',
      'label', 'Unreviewed receipts exist',
      'severity', 'medium',
      'evidence', 'Some receipts pending review — material costs may be incomplete'
    );
  END IF;

  -- Driver 4: No approved estimate (+15)
  IF NOT v_has_approved_estimate THEN
    v_risk_score := v_risk_score + 15;
    v_drivers := v_drivers || jsonb_build_object(
      'key', 'no_approved_estimate',
      'label', 'No approved estimate exists',
      'severity', 'medium',
      'evidence', CASE
        WHEN v_estimate.id IS NOT NULL THEN format('Using draft estimate %s as fallback', v_estimate.id::text)
        ELSE 'No estimate found for this project'
      END
    );
  END IF;

  -- Driver 5: Early-phase invoicing (+10)
  IF v_workflow_phase IS NOT NULL
     AND v_workflow_phase IN ('setup', 'estimating', 'scope')
     AND (v_rollup->>'invoiced_total')::numeric > 0 THEN
    v_risk_score := v_risk_score + 10;
    v_drivers := v_drivers || jsonb_build_object(
      'key', 'early_phase_invoicing',
      'label', 'Invoices sent during early project phase',
      'severity', 'low',
      'evidence', format('Phase: %s, Invoiced: $%s', v_workflow_phase, (v_rollup->>'invoiced_total'))
    );
  END IF;

  -- Clamp
  v_risk_score := LEAST(100, v_risk_score);

  -- Risk level
  IF v_risk_score >= 50 THEN
    v_risk_level := 'high';
  ELSIF v_risk_score >= 25 THEN
    v_risk_level := 'medium';
  ELSE
    v_risk_level := 'low';
  END IF;

  -- ── Build result ──
  v_result := jsonb_build_object(
    'project_id', p_project_id,
    'currency', v_project.currency,
    'expected_revenue', v_expected_revenue,
    'estimate_total_cost', CASE WHEN v_estimate.id IS NOT NULL THEN ROUND(v_estimate.planned_total_cost::numeric, 2) ELSE NULL END,
    'estimate_labor_hours', CASE WHEN v_estimate.id IS NOT NULL THEN ROUND(v_estimate.planned_labor_hours::numeric, 2) ELSE NULL END,
    'actual_total_cost', (v_rollup->>'actual_total_cost')::numeric,
    'actual_labor_hours', (v_rollup->>'actual_labor_hours')::numeric,
    'burn_rate_hours_per_day', v_burn_rate,
    'projected_final_labor_hours', CASE WHEN v_projected_final_labor_hours IS NOT NULL THEN ROUND(v_projected_final_labor_hours, 2) ELSE NULL END,
    'projected_final_cost', v_projected_final_cost,
    'projected_margin', v_projected_margin,
    'risk_score', v_risk_score,
    'risk_level', v_risk_level,
    'drivers', v_drivers,
    'flags', v_rollup->'flags',
    'workflow_phase', v_workflow_phase,
    'estimate_status', CASE WHEN v_estimate.id IS NOT NULL THEN v_estimate.status ELSE NULL END,
    'has_approved_estimate', v_has_approved_estimate,
    'data_completeness_score', (v_rollup->>'data_completeness_score')::numeric
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.rpc_get_project_profit_risk(uuid) TO authenticated;
