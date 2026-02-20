
-- ═══════════════════════════════════════════════════════════════════════════
-- public.rpc_simulate_margin_sensitivity(
--   p_project_id        uuid,
--   p_labor_delta_percent numeric   -- e.g. 10 = +10 %, −20 = −20 %
-- ) RETURNS jsonb
--
-- Pure "what-if" simulation.  No writes.  Deterministic.
--
-- Algorithm mirrors rpc_generate_project_margin_control exactly:
--   1. Pull same views (snapshot, burn index, margin projection, org perf).
--   2. Compute simulated_labor_cost = actual_labor_cost × (1 + delta/100).
--   3. Re-derive the two margin-sensitive flag conditions inline:
--        margin_declining_flag  : realized_margin_ratio < historical_avg_margin_ratio
--        low_band_flag          : realized_margin_ratio < historical_margin_low_band
--        labor_risk_flag        : labor_cost_ratio − expected_labor_ratio > 0.10
--      using simulated values, so we can score both baseline and simulation
--      identically and compare them.
--   4. Score the simulation with the same point table (+30, +25, +20, +15).
--
-- Output:
--   {
--     project_id,
--     labor_delta_percent,
--     baseline_margin_pct,    baseline_risk,   baseline_position,
--     simulated_margin_pct,   simulated_risk,  simulated_position,
--     delta_margin_pct,       delta_risk,
--     simulated_labor_cost,   baseline_labor_cost,
--     simulated_at
--   }
--
-- Security: STABLE SECURITY DEFINER, search_path pinned.
--           Membership guard via rpc_is_org_member.
--           REVOKE from public/anon.  GRANT to authenticated.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rpc_simulate_margin_sensitivity(
  p_project_id          uuid,
  p_labor_delta_percent numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- identity / org
  v_uid    uuid;
  v_org_id uuid;

  -- view rows
  v_snap   record;
  v_omp    record;
  v_burn   record;
  v_proj   record;

  -- archetype benchmark (mirrors v_project_labor_burn_index logic)
  v_expected_labor_ratio numeric := 0;

  -- baseline actuals (from views)
  v_revenue              numeric := 0;
  v_actual_labor         numeric := 0;

  -- simulated labor cost
  v_sim_labor            numeric := 0;

  -- derived margin ratios
  v_base_margin_ratio    numeric := 0;
  v_sim_margin_ratio     numeric := 0;

  -- derived labor cost ratios
  v_base_labor_ratio     numeric := 0;
  v_sim_labor_ratio      numeric := 0;

  -- flag conditions — baseline
  v_base_margin_declining  boolean := false;
  v_base_low_band          boolean := false;
  v_base_labor_risk        boolean := false;
  v_base_low_hist          boolean := false;

  -- flag conditions — simulated
  v_sim_margin_declining   boolean := false;
  v_sim_low_band           boolean := false;
  v_sim_labor_risk         boolean := false;

  -- scores
  v_base_risk              int := 0;
  v_sim_risk               int := 0;

  -- position labels
  v_base_position          text;
  v_sim_position           text;

  -- margin pct convenience
  v_base_margin_pct        numeric := 0;
  v_sim_margin_pct         numeric := 0;
BEGIN
  -- ── 1. Auth ──────────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 2. Resolve org ───────────────────────────────────────────
  SELECT organization_id INTO v_org_id
  FROM   public.projects
  WHERE  id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- ── 3. Membership guard ──────────────────────────────────────
  IF NOT public.rpc_is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 4. Pull canonical view rows ──────────────────────────────
  SELECT * INTO v_snap FROM public.v_project_economic_snapshot WHERE project_id = p_project_id;
  SELECT * INTO v_omp  FROM public.v_org_margin_performance    WHERE org_id     = v_org_id;
  SELECT * INTO v_burn FROM public.v_project_labor_burn_index  WHERE project_id = p_project_id;
  SELECT * INTO v_proj FROM public.v_project_margin_projection WHERE project_id = p_project_id;

  -- ── 5. Extract baseline actuals ──────────────────────────────
  v_revenue       := COALESCE(v_snap.projected_revenue,    0);
  v_actual_labor  := COALESCE(v_snap.actual_labor_cost,    0);

  -- Pull the archetype expected_labor_ratio directly, mirroring
  -- v_project_labor_burn_index's archetype_bench CTE.
  SELECT COALESCE(AVG(
    CASE WHEN snap2.projected_revenue > 0
      THEN snap2.actual_labor_cost / snap2.projected_revenue
      ELSE 0
    END
  ), 0)
  INTO v_expected_labor_ratio
  FROM public.v_project_economic_snapshot snap2
  JOIN public.projects p2 ON p2.id = snap2.project_id
  WHERE p2.archetype_id = (SELECT archetype_id FROM public.projects WHERE id = p_project_id)
    AND p2.status IN ('completed', 'closed')
    AND p2.archetype_id IS NOT NULL
    AND snap2.org_id = v_org_id;

  -- ── 6. Compute simulated labor cost ──────────────────────────
  v_sim_labor := ROUND(
    v_actual_labor * (1 + p_labor_delta_percent / 100.0),
    2
  );

  -- ── 7. Derive margin ratios ───────────────────────────────────
  --   realized_margin_ratio = (revenue - labor_cost) / revenue
  --   (material + sub actuals = 0, matching engine assumption)
  IF v_revenue > 0 THEN
    v_base_margin_ratio := ROUND((v_revenue - v_actual_labor) / v_revenue, 4);
    v_sim_margin_ratio  := ROUND((v_revenue - v_sim_labor)    / v_revenue, 4);
    v_base_labor_ratio  := ROUND(v_actual_labor / v_revenue, 4);
    v_sim_labor_ratio   := ROUND(v_sim_labor    / v_revenue, 4);
  END IF;

  -- Margin pct (× 100 for display)
  v_base_margin_pct := ROUND(v_base_margin_ratio * 100, 2);
  v_sim_margin_pct  := ROUND(v_sim_margin_ratio  * 100, 2);

  -- ── 8. Evaluate flag conditions (mirrors engine exactly) ──────

  -- margin_declining_flag: realized_margin_ratio < historical_avg_margin_ratio
  IF v_omp.historical_avg_margin_ratio IS NOT NULL THEN
    v_base_margin_declining := v_base_margin_ratio < v_omp.historical_avg_margin_ratio;
    v_sim_margin_declining  := v_sim_margin_ratio  < v_omp.historical_avg_margin_ratio;
  END IF;

  -- low_band: realized_margin_ratio < historical_margin_low_band
  IF v_omp.historical_margin_low_band IS NOT NULL THEN
    v_base_low_band := v_base_margin_ratio < v_omp.historical_margin_low_band;
    v_sim_low_band  := v_sim_margin_ratio  < v_omp.historical_margin_low_band;
  END IF;

  -- labor_risk_flag: labor_cost_ratio − expected_labor_ratio > 0.10
  v_base_labor_risk := (v_base_labor_ratio - v_expected_labor_ratio) > 0.10;
  v_sim_labor_risk  := (v_sim_labor_ratio  - v_expected_labor_ratio) > 0.10;

  -- low_historical_data: constant — unaffected by labor delta
  v_base_low_hist := COALESCE(v_omp.completed_projects_count, 0) < 5;

  -- ── 9. Score baseline (same point table as engine) ────────────
  --   margin_declining (+30), labor_burn (+25), low_band (+20), low_hist (+15)
  --   low_band adds flag only if margin_declining not already set (matches GUARD)
  IF v_base_margin_declining THEN v_base_risk := v_base_risk + 30; END IF;
  IF v_base_labor_risk       THEN v_base_risk := v_base_risk + 25; END IF;
  IF v_base_low_band AND NOT v_base_margin_declining
                         THEN v_base_risk := v_base_risk + 20; END IF;
  IF v_base_low_hist         THEN v_base_risk := v_base_risk + 15; END IF;
  v_base_risk := LEAST(GREATEST(v_base_risk, 0), 100);

  -- ── 10. Score simulation ─────────────────────────────────────
  IF v_sim_margin_declining  THEN v_sim_risk := v_sim_risk + 30; END IF;
  IF v_sim_labor_risk        THEN v_sim_risk := v_sim_risk + 25; END IF;
  IF v_sim_low_band AND NOT v_sim_margin_declining
                         THEN v_sim_risk := v_sim_risk + 20; END IF;
  IF v_base_low_hist         THEN v_sim_risk := v_sim_risk + 15; END IF; -- same org constant
  v_sim_risk := LEAST(GREATEST(v_sim_risk, 0), 100);

  -- ── 11. Position labels ──────────────────────────────────────
  v_base_position := CASE
    WHEN v_base_risk > 60  THEN 'at_risk'
    WHEN v_base_risk >= 30 THEN 'volatile'
    ELSE                        'stable'
  END;

  v_sim_position := CASE
    WHEN v_sim_risk > 60  THEN 'at_risk'
    WHEN v_sim_risk >= 30 THEN 'volatile'
    ELSE                       'stable'
  END;

  -- ── 12. Return ───────────────────────────────────────────────
  RETURN jsonb_build_object(
    -- identifiers
    'project_id',               p_project_id,
    'labor_delta_percent',      ROUND(p_labor_delta_percent::numeric, 2),

    -- baseline
    'baseline_margin_pct',      v_base_margin_pct,
    'baseline_risk',            v_base_risk,
    'baseline_position',        v_base_position,
    'baseline_labor_cost',      ROUND(v_actual_labor::numeric, 2),

    -- simulated
    'simulated_margin_pct',     v_sim_margin_pct,
    'simulated_risk',           v_sim_risk,
    'simulated_position',       v_sim_position,
    'simulated_labor_cost',     ROUND(v_sim_labor::numeric, 2),

    -- deltas
    'delta_margin_pct',         ROUND((v_sim_margin_pct - v_base_margin_pct)::numeric, 2),
    'delta_risk',               v_sim_risk - v_base_risk,

    -- traceability
    'revenue_used',             ROUND(v_revenue::numeric, 2),
    'scoring_notes', jsonb_build_object(
      'margin_declining_baseline',  v_base_margin_declining,
      'margin_declining_simulated', v_sim_margin_declining,
      'labor_risk_baseline',        v_base_labor_risk,
      'labor_risk_simulated',       v_sim_labor_risk,
      'low_band_baseline',          v_base_low_band,
      'low_band_simulated',         v_sim_low_band,
      'low_historical_data',        v_base_low_hist,
      'expected_labor_ratio',       ROUND(v_expected_labor_ratio::numeric, 4)
    ),

    'simulated_at',             now()
  );
END;
$$;

REVOKE ALL  ON FUNCTION public.rpc_simulate_margin_sensitivity(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_simulate_margin_sensitivity(uuid, numeric) TO authenticated;

COMMENT ON FUNCTION public.rpc_simulate_margin_sensitivity(uuid, numeric) IS
  'Pure what-if simulation. No writes. STABLE SECURITY DEFINER. search_path pinned. '
  'Mirrors rpc_generate_project_margin_control scoring exactly (point table: +30/+25/+20/+15). '
  'p_labor_delta_percent: e.g. 10 = +10%, -20 = -20% on actual_labor_cost.';
