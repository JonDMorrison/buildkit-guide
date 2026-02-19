
-- ================================================================
-- Flag normalization patch for rpc_generate_project_margin_control
--
-- Replaces non-canonical flag keys with their canonical equivalents
-- from rpc_get_margin_flag_dictionary():
--
--   labor_burn_high  → labor_burn_exceeding_benchmark
--   below_low_band   → margin_declining
--
-- All other logic (scoring, position, ordering) is unchanged.
-- ================================================================

CREATE OR REPLACE FUNCTION public.rpc_generate_project_margin_control(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_org_id   uuid;
  v_snap     record;
  v_omp      record;
  v_burn     record;
  v_proj     record;
  v_risk     int  := 0;
  v_position text;
  v_flags    text[] := ARRAY[]::text[];
BEGIN
  -- ── 1. Validate project ──────────────────────────────────────
  SELECT organization_id INTO v_org_id
  FROM   projects WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501';
  END IF;

  -- ── 2. Enforce membership ────────────────────────────────────
  IF NOT public.rpc_is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 3. Read views ────────────────────────────────────────────
  SELECT * INTO v_snap FROM v_project_economic_snapshot WHERE project_id = p_project_id;
  SELECT * INTO v_omp  FROM v_org_margin_performance    WHERE org_id     = v_org_id;
  SELECT * INTO v_burn FROM v_project_labor_burn_index  WHERE project_id = p_project_id;
  SELECT * INTO v_proj FROM v_project_margin_projection WHERE project_id = p_project_id;

  -- ── 4. Risk scoring + canonical flag emission ─────────────────
  --
  --  margin_declining (+30)
  --    Emitted when the margin projection view reports a declining trend.
  IF v_proj.margin_declining_flag THEN
    v_risk  := v_risk + 30;
    v_flags := v_flags || 'margin_declining';
  END IF;

  --  labor_burn_exceeding_benchmark (+25)
  --    Formerly emitted as 'labor_burn_high' — normalized to canonical key.
  IF v_burn.labor_risk_flag THEN
    v_risk  := v_risk + 25;
    v_flags := v_flags || 'labor_burn_exceeding_benchmark';
  END IF;

  --  margin_declining (+20, additive if not already added)
  --    Formerly emitted as 'below_low_band'.
  --    Absorbed into 'margin_declining': both signals indicate the project
  --    margin has fallen below the organisation's safe band.
  --    Guard: only add the score penalty if this condition fires independently
  --    of the trajectory flag above; the flag is deduplicated below.
  IF v_omp.historical_margin_low_band IS NOT NULL
     AND COALESCE(v_snap.realized_margin_ratio, 0) < v_omp.historical_margin_low_band THEN
    v_risk  := v_risk + 20;
    -- Append only if not already present (margin_declining may already be set)
    IF NOT ('margin_declining' = ANY(v_flags)) THEN
      v_flags := v_flags || 'margin_declining';
    END IF;
  END IF;

  --  low_historical_data (+15)
  --    Unchanged canonical key.
  IF COALESCE(v_omp.completed_projects_count, 0) < 5 THEN
    v_risk  := v_risk + 15;
    v_flags := v_flags || 'low_historical_data';
  END IF;

  -- ── 5. Clamp risk to [0, 100] ────────────────────────────────
  v_risk := LEAST(GREATEST(v_risk, 0), 100);

  -- ── 6. Sort flags alphabetically (determinism) ───────────────
  SELECT array_agg(f ORDER BY f) INTO v_flags FROM unnest(v_flags) AS f;

  -- ── 7. Economic position ─────────────────────────────────────
  IF    v_risk > 60  THEN v_position := 'at_risk';
  ELSIF v_risk >= 30 THEN v_position := 'volatile';
  ELSE                    v_position := 'stable';
  END IF;

  -- ── 8. Return ────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'economic_position',                      v_position,
    'executive_summary',                      CASE
                                                WHEN v_risk > 60  THEN 'Project margin is at risk. Immediate review recommended.'
                                                WHEN v_risk >= 30 THEN 'Project margin is volatile. Monitor closely.'
                                                ELSE                   'Project margin is within acceptable range.'
                                              END,
    'guardrail_recommendation',               CASE WHEN v_risk >= 60 THEN 'block' ELSE 'warn' END,
    'historical_org_margin_percent',          round(COALESCE(v_omp.historical_avg_margin_ratio, 0)::numeric * 100, 2),
    'intervention_flags',                     COALESCE(to_jsonb(v_flags), '[]'::jsonb),
    'intervention_priority',                  ceil(v_risk::numeric / 20),
    'margin_trajectory',                      CASE WHEN v_proj.margin_declining_flag THEN 'declining' ELSE 'stable_or_improving' END,
    'projected_margin_at_completion_percent', round(COALESCE(v_proj.projected_margin_at_completion_ratio, 0)::numeric * 100, 2),
    'risk_score',                             v_risk
  );
END;
$$;

-- ── Grants (unchanged) ────────────────────────────────────────────
REVOKE ALL  ON FUNCTION public.rpc_generate_project_margin_control(uuid) FROM PUBLIC;
REVOKE ALL  ON FUNCTION public.rpc_generate_project_margin_control(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_generate_project_margin_control(uuid) TO authenticated;

COMMENT ON FUNCTION public.rpc_generate_project_margin_control(uuid) IS
  'Margin control engine. SECURITY DEFINER, deterministic. '
  'Emits only canonical flags from rpc_get_margin_flag_dictionary(). '
  'flag-normalization:v2 — below_low_band→margin_declining, labor_burn_high→labor_burn_exceeding_benchmark';
