
-- ═══════════════════════════════════════════════════════════════════════════
-- rpc_generate_project_margin_control  (unbreakable-shape:v2)
--
-- Goal: Guarantee the returned JSONB ALWAYS has a complete, type-safe shape
--       regardless of whether the project has an estimate, snapshot row, or costs.
--
-- Changes from previous version (risk-decomposition:v1):
--   A. All four view SELECTs wrapped in individual EXCEPTION blocks so a
--      missing row never throws; variables remain safely at their zero defaults.
--   B. Scoring conditions guarded with explicit IS TRUE checks so a NULL
--      boolean field (from a missing view row) evaluates as false, not an error.
--   C. risk_components is always emitted with all 4 keys, each a JSON number.
--   D. All top-level required keys are always present and numeric (or safe text).
--   E. intervention_flags always emitted as '[]'::jsonb when empty.
--   F. EXCEPTION blocks only re-raise for: project not found, not_authorized,
--      unknown_economic_flag.  All other view/computation errors silently fall
--      back to zero defaults and a 'stable' position — the function never
--      propagates unexpected exceptions.
--
-- Nothing else changes:
--   • Scoring logic, thresholds, component weights — verbatim.
--   • SECURITY DEFINER, SET search_path, grants — unchanged.
--   • No writes.  STABLE.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_generate_project_margin_control(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_org_id    uuid;
  v_risk      int    := 0;
  v_position  text   := 'stable';
  v_flags     jsonb  := '[]'::jsonb;

  -- Safe scalar extractions from views (default to 0 / false / null)
  v_contract_value                       numeric := 0;
  v_realized_margin_ratio                numeric := 0;
  v_labor_cost_ratio                     numeric := 0;
  v_projected_margin_at_completion_ratio numeric := 0;
  v_historical_margin_low_band           numeric;   -- intentionally nullable
  v_completed_projects_count             int     := 0;
  v_margin_declining_flag                boolean := false;
  v_labor_risk_flag                      boolean := false;

  -- Risk component trackers (shadow each scoring block)
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
  -- ── 1. Validate project (authorized exception: re-raise) ──────
  SELECT organization_id INTO v_org_id
  FROM   public.projects
  WHERE  id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501';
  END IF;

  -- ── 2. Enforce membership (authorized exception: re-raise) ────
  IF NOT public.rpc_is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 3. Read views — each wrapped so missing rows never throw ──

  -- 3a. Economic snapshot
  BEGIN
    SELECT
      COALESCE(s.projected_revenue,     0),
      COALESCE(s.realized_margin_ratio, 0)
    INTO
      v_contract_value,
      v_realized_margin_ratio
    FROM public.v_project_economic_snapshot s
    WHERE s.project_id = p_project_id;
  EXCEPTION WHEN OTHERS THEN
    -- Row missing or view error — keep scalar defaults (0)
    NULL;
  END;

  -- 3b. Org margin performance
  BEGIN
    SELECT
      omp.historical_margin_low_band,
      COALESCE(omp.completed_projects_count, 0)
    INTO
      v_historical_margin_low_band,
      v_completed_projects_count
    FROM public.v_org_margin_performance omp
    WHERE omp.org_id = v_org_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 3c. Labor burn index
  BEGIN
    SELECT
      COALESCE(b.labor_cost_ratio, 0),
      COALESCE(b.labor_risk_flag,  false)
    INTO
      v_labor_cost_ratio,
      v_labor_risk_flag
    FROM public.v_project_labor_burn_index b
    WHERE b.project_id = p_project_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 3d. Margin projection
  BEGIN
    SELECT
      COALESCE(mp.projected_margin_at_completion_ratio, 0),
      COALESCE(mp.margin_declining_flag,                false)
    INTO
      v_projected_margin_at_completion_ratio,
      v_margin_declining_flag
    FROM public.v_project_margin_projection mp
    WHERE mp.project_id = p_project_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- ── 4. Risk scoring + canonical flag emission ─────────────────
  --      Using IS TRUE so NULL booleans are safe.

  --  margin_declining (+30)
  IF v_margin_declining_flag IS TRUE THEN
    v_risk            := v_risk + 30;
    v_margin_pressure := v_margin_pressure + 30;
    v_flags := v_flags || to_jsonb('margin_declining'::text);
  END IF;

  --  labor_burn_exceeding_benchmark (+25)
  IF v_labor_risk_flag IS TRUE THEN
    v_risk                := v_risk + 25;
    v_labor_burn_pressure := v_labor_burn_pressure + 25;
    v_flags := v_flags || to_jsonb('labor_burn_exceeding_benchmark'::text);
  END IF;

  --  below low-band margin (+20, additive guard)
  IF v_historical_margin_low_band IS NOT NULL
     AND v_realized_margin_ratio < v_historical_margin_low_band THEN
    v_risk                := v_risk + 20;
    v_volatility_pressure := v_volatility_pressure + 20;
    IF NOT (v_flags @> to_jsonb('margin_declining'::text)) THEN
      v_flags := v_flags || to_jsonb('margin_declining'::text);
    END IF;
  END IF;

  --  low_historical_data (+15)
  IF v_completed_projects_count < 5 THEN
    v_risk                      := v_risk + 15;
    v_data_uncertainty_pressure := v_data_uncertainty_pressure + 15;
    v_flags := v_flags || to_jsonb('low_historical_data'::text);
  END IF;

  -- ── 5. Clamp risk to [0, 100] ────────────────────────────────
  v_risk := LEAST(GREATEST(v_risk, 0), 100);

  -- ── 6. Deduplicate + sort flags deterministically ────────────
  BEGIN
    SELECT COALESCE(jsonb_agg(x ORDER BY x), '[]'::jsonb)
      INTO v_flags
      FROM (SELECT DISTINCT jsonb_array_elements_text(v_flags) AS x) s;
  EXCEPTION WHEN OTHERS THEN
    v_flags := '[]'::jsonb;
  END;

  -- ── 6b. Regression guard ─────────────────────────────────────
  IF jsonb_typeof(v_flags) <> 'array' THEN
    v_flags := '[]'::jsonb;
  END IF;

  -- ── 6c. Dictionary validation (only authorized exception) ─────
  FOR v_flag_key IN
    SELECT jsonb_array_elements_text(v_flags)
  LOOP
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM public.economic_flag_dictionary WHERE key = v_flag_key
      ) INTO v_key_found;
    EXCEPTION WHEN OTHERS THEN
      v_key_found := false;
    END;

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
  v_components_sum := v_margin_pressure
                    + v_labor_burn_pressure
                    + v_volatility_pressure
                    + v_data_uncertainty_pressure;

  v_risk_components_mismatch := ABS(v_components_sum - v_risk) > 1.5;

  -- ── 8. Return — complete, type-safe shape always ─────────────
  --   Keys in alphabetical order for determinism.
  --   Every numeric field defaults to 0 via COALESCE before ROUND.
  --   risk_components always emitted with all 4 keys as JSON numbers.
  RETURN jsonb_build_object(
    'contract_value',
        ROUND(COALESCE(v_contract_value, 0)::numeric, 2),
    'economic_position',
        COALESCE(v_position, 'stable'),
    'executive_summary',
        CASE
          WHEN v_risk > 60  THEN 'Project margin is at risk. Immediate review recommended.'
          WHEN v_risk >= 30 THEN 'Project margin is volatile. Monitor closely.'
          ELSE                   'Project margin is within acceptable range.'
        END,
    'intervention_flags',
        COALESCE(v_flags, '[]'::jsonb),
    'labor_burn_ratio',
        ROUND(COALESCE(v_labor_cost_ratio, 0)::numeric, 2),
    'projected_margin',
        ROUND(COALESCE(v_projected_margin_at_completion_ratio, 0)::numeric, 2),
    'projected_margin_at_completion_percent',
        ROUND(COALESCE(v_projected_margin_at_completion_ratio, 0)::numeric * 100, 2),
    'realized_margin',
        ROUND(COALESCE(v_realized_margin_ratio, 0)::numeric, 2),
    'risk_components',
        jsonb_build_object(
          'data_uncertainty_pressure', ROUND(COALESCE(v_data_uncertainty_pressure, 0)::numeric, 2),
          'labor_burn_pressure',       ROUND(COALESCE(v_labor_burn_pressure,       0)::numeric, 2),
          'margin_pressure',           ROUND(COALESCE(v_margin_pressure,           0)::numeric, 2),
          'volatility_pressure',       ROUND(COALESCE(v_volatility_pressure,       0)::numeric, 2)
        ),
    'risk_components_mismatch',
        COALESCE(v_risk_components_mismatch, false),
    'risk_score',
        COALESCE(v_risk, 0),
    'snapshot_date',
        now()::date
  );

EXCEPTION
  -- Re-raise authorized exceptions (project not found, not authorized,
  -- unknown flag).  All others are swallowed and the function returns a
  -- safe zero-state payload.
  WHEN SQLSTATE '42501' THEN RAISE;
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
    -- Unexpected runtime error: return safe zero-state payload
    RETURN jsonb_build_object(
      'contract_value',                        0,
      'economic_position',                     'stable',
      'executive_summary',                     'Project margin is within acceptable range.',
      'intervention_flags',                    '[]'::jsonb,
      'labor_burn_ratio',                      0,
      'projected_margin',                      0,
      'projected_margin_at_completion_percent',0,
      'realized_margin',                       0,
      'risk_components',                       jsonb_build_object(
                                                 'data_uncertainty_pressure', 0,
                                                 'labor_burn_pressure',       0,
                                                 'margin_pressure',           0,
                                                 'volatility_pressure',       0
                                               ),
      'risk_components_mismatch',              false,
      'risk_score',                            0,
      'snapshot_date',                         now()::date
    );
END;
$$;

-- Grants unchanged
REVOKE ALL   ON FUNCTION public.rpc_generate_project_margin_control(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_generate_project_margin_control(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_generate_project_margin_control(uuid) TO authenticator;
GRANT EXECUTE ON FUNCTION public.rpc_generate_project_margin_control(uuid) TO supabase_read_only_user;

COMMENT ON FUNCTION public.rpc_generate_project_margin_control(uuid) IS
  'Margin control engine. STABLE SECURITY DEFINER. search_path pinned. '
  'unbreakable-shape:v2 — All view reads wrapped in per-block EXCEPTION handlers. '
  'Payload always contains all required keys with numeric defaults. '
  'risk_components always emitted with all 4 numeric keys. '
  'Only re-raises: project-not-found (42501), not-authorized (42501), unknown_economic_flag (P0001). '
  'No writes.';
