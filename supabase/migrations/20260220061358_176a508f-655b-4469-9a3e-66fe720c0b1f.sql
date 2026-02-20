
-- ═══════════════════════════════════════════════════════════════════════════
-- rpc_generate_project_margin_control  (risk-decomposition:v1)
--
-- Changes from previous version:
--   1. Restore 'projected_margin_at_completion_percent' key in RETURN
--      (= projected_margin_at_completion_ratio × 100, rounded 2 dp).
--      All downstream callers (executive risk summary, action panel, etc.)
--      read this key.  It was present in earlier migrations and must remain.
--
--   2. Add v_components_sum mismatch guard (advisory, no exception):
--        v_components_sum = margin_pressure + labor_burn_pressure
--                         + volatility_pressure + data_uncertainty_pressure
--        risk_components_mismatch = abs(v_components_sum - v_risk) > 1.5
--      Exposed as 'risk_components_mismatch' boolean in the return object.
--
-- Nothing else changes:
--   • Scoring logic, thresholds, flags — verbatim.
--   • Component tracker assignments — verbatim.
--   • SECURITY DEFINER, SET search_path, grants — unchanged.
--   • No writes. STABLE.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_generate_project_margin_control(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_org_id    uuid;
  v_snap      record;
  v_omp       record;
  v_burn      record;
  v_proj      record;
  v_risk      int    := 0;
  v_position  text;
  v_flags     jsonb  := '[]'::jsonb;

  -- Risk component trackers (shadow each scoring block; no effect on v_risk)
  v_margin_pressure           int := 0;
  v_labor_burn_pressure       int := 0;
  v_volatility_pressure       int := 0;
  v_data_uncertainty_pressure int := 0;

  -- Mismatch guard (advisory)
  v_components_sum            numeric := 0;
  v_risk_components_mismatch  boolean := false;

  -- Dictionary validation
  v_flag_key  text;
  v_key_found boolean;
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
  --      Component trackers shadow each scoring block exactly.
  --      !! Do NOT change point values or conditions here !!

  --  margin_declining (+30)
  IF v_proj.margin_declining_flag THEN
    v_risk            := v_risk + 30;
    v_margin_pressure := v_margin_pressure + 30;
    v_flags := v_flags || to_jsonb('margin_declining'::text);
  END IF;

  --  labor_burn_exceeding_benchmark (+25)
  IF v_burn.labor_risk_flag THEN
    v_risk                := v_risk + 25;
    v_labor_burn_pressure := v_labor_burn_pressure + 25;
    v_flags := v_flags || to_jsonb('labor_burn_exceeding_benchmark'::text);
  END IF;

  --  below low-band margin (+20, additive guard)
  IF v_omp.historical_margin_low_band IS NOT NULL
     AND COALESCE(v_snap.realized_margin_ratio, 0) < v_omp.historical_margin_low_band THEN
    v_risk                := v_risk + 20;
    v_volatility_pressure := v_volatility_pressure + 20;
    IF NOT (v_flags @> to_jsonb('margin_declining'::text)) THEN
      v_flags := v_flags || to_jsonb('margin_declining'::text);
    END IF;
  END IF;

  --  low_historical_data (+15)
  IF COALESCE(v_omp.completed_projects_count, 0) < 5 THEN
    v_risk                      := v_risk + 15;
    v_data_uncertainty_pressure := v_data_uncertainty_pressure + 15;
    v_flags := v_flags || to_jsonb('low_historical_data'::text);
  END IF;

  -- ── 5. Clamp risk to [0, 100] ────────────────────────────────
  v_risk := LEAST(GREATEST(v_risk, 0), 100);

  -- ── 6. Deduplicate + sort flags deterministically (JSONB) ────
  SELECT COALESCE(jsonb_agg(x ORDER BY x), '[]'::jsonb)
    INTO v_flags
    FROM (SELECT DISTINCT jsonb_array_elements_text(v_flags) AS x) s;

  -- ── 6b. Regression guard ─────────────────────────────────────
  IF jsonb_typeof(v_flags) <> 'array' THEN
    RAISE EXCEPTION 'flags_not_json_array';
  END IF;

  -- ── 6c. Dictionary validation ─────────────────────────────────
  FOR v_flag_key IN
    SELECT jsonb_array_elements_text(v_flags)
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.economic_flag_dictionary WHERE key = v_flag_key
    ) INTO v_key_found;

    IF NOT v_key_found THEN
      RAISE EXCEPTION 'unknown_economic_flag: key "%" is not registered in economic_flag_dictionary', v_flag_key
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- ── 7. Economic position ─────────────────────────────────────
  IF    v_risk > 60  THEN v_position := 'at_risk';
  ELSIF v_risk >= 30 THEN v_position := 'volatile';
  ELSE                    v_position := 'stable';
  END IF;

  -- ── 7b. Components mismatch guard (advisory) ─────────────────
  --   Sum the four pressure components (pre-clamp raw integers).
  --   Compare against post-clamp v_risk.
  --   Mismatch threshold: 1.5 pts (tolerates rounding artefacts).
  --   No exception is raised; the flag is informational.
  v_components_sum := v_margin_pressure
                    + v_labor_burn_pressure
                    + v_volatility_pressure
                    + v_data_uncertainty_pressure;

  v_risk_components_mismatch := ABS(v_components_sum - v_risk) > 1.5;

  -- ── 8. Return ────────────────────────────────────────────────
  --   Keys in alphabetical order for determinism.
  RETURN jsonb_build_object(
    'contract_value',                        ROUND(COALESCE(v_snap.projected_revenue,                         0)::numeric, 2),
    'economic_position',                     v_position,
    'executive_summary',                     CASE
                                               WHEN v_risk > 60  THEN 'Project margin is at risk. Immediate review recommended.'
                                               WHEN v_risk >= 30 THEN 'Project margin is volatile. Monitor closely.'
                                               ELSE                   'Project margin is within acceptable range.'
                                             END,
    'intervention_flags',                    v_flags,
    'labor_burn_ratio',                      ROUND(COALESCE(v_burn.labor_cost_ratio,                          0)::numeric, 2),
    'projected_margin',                      ROUND(COALESCE(v_proj.projected_margin_at_completion_ratio,       0)::numeric, 2),
    'projected_margin_at_completion_percent',ROUND(COALESCE(v_proj.projected_margin_at_completion_ratio,       0)::numeric * 100, 2),
    'realized_margin',                       ROUND(COALESCE(v_snap.realized_margin_ratio,                      0)::numeric, 2),
    'risk_components',                       jsonb_build_object(
                                               'data_uncertainty_pressure', ROUND(v_data_uncertainty_pressure::numeric, 2),
                                               'labor_burn_pressure',       ROUND(v_labor_burn_pressure::numeric,       2),
                                               'margin_pressure',           ROUND(v_margin_pressure::numeric,           2),
                                               'volatility_pressure',       ROUND(v_volatility_pressure::numeric,       2)
                                             ),
    'risk_components_mismatch',              v_risk_components_mismatch,
    'risk_score',                            v_risk,
    'snapshot_date',                         now()::date
  );
END;
$$;

-- Grants unchanged
REVOKE ALL  ON FUNCTION public.rpc_generate_project_margin_control(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_generate_project_margin_control(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_generate_project_margin_control(uuid) TO authenticator;

COMMENT ON FUNCTION public.rpc_generate_project_margin_control(uuid) IS
  'Margin control engine. STABLE SECURITY DEFINER. search_path pinned. '
  'risk-decomposition:v1 — risk_components exposes the four pressure contributors; '
  'risk_components_mismatch (boolean, advisory) flags when abs(component_sum - risk_score) > 1.5. '
  'projected_margin_at_completion_percent restored for downstream callers. No writes.';
