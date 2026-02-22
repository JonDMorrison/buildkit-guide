
-- 1. Register the flag in the dictionary
INSERT INTO public.economic_flag_dictionary (key, label, severity, description, default_action_key)
VALUES (
  'labor_feed_missing',
  'Labor Feed Missing',
  'high',
  'Project has an approved estimate with expected labor costs but zero time entries recorded. Economic position cannot be reliably determined.',
  'review_time_entries'
)
ON CONFLICT (key) DO NOTHING;

-- 2. Patch rpc_generate_project_margin_control with labor feed credibility gate
CREATE OR REPLACE FUNCTION public.rpc_generate_project_margin_control(p_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  -- Labor feed credibility gate
  v_actual_labor_cost  numeric := 0;
  v_has_estimate       boolean := false;
  v_labor_row_count    bigint  := 0;
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
      COALESCE(s.realized_margin_ratio, 0),
      COALESCE(s.actual_labor_cost,     0)
    INTO
      v_contract_value,
      v_realized_margin_ratio,
      v_actual_labor_cost
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

  -- ── 3e. Labor feed credibility gate inputs ────────────────────
  --   Check if project has an approved estimate (meaning labor is expected)
  --   and count actual valid time entry rows.
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM public.estimates e
      WHERE e.project_id = p_project_id
        AND e.status = 'approved'
        AND e.planned_total_cost > 0
    ) INTO v_has_estimate;
  EXCEPTION WHEN OTHERS THEN
    v_has_estimate := false;
  END;

  BEGIN
    SELECT count(*) INTO v_labor_row_count
    FROM public.time_entries te
    WHERE te.project_id = p_project_id
      AND public.is_valid_time_entry(te.*) = true;
  EXCEPTION WHEN OTHERS THEN
    v_labor_row_count := 0;
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

  -- ── 4b. Labor feed credibility gate (+20) ─────────────────────
  --   If an approved estimate exists (labor expected) but zero valid
  --   time entries are recorded, the economic position is unreliable.
  --   Uplift: +20 to data_uncertainty_pressure (documented, deterministic).
  IF v_has_estimate IS TRUE AND v_labor_row_count = 0 THEN
    v_risk                      := v_risk + 20;
    v_data_uncertainty_pressure := v_data_uncertainty_pressure + 20;
    v_flags := v_flags || to_jsonb('labor_feed_missing'::text);
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

  -- ── 7b. Labor feed override: cannot claim stable with no labor data ──
  IF v_has_estimate IS TRUE AND v_labor_row_count = 0 AND v_position = 'stable' THEN
    v_position := 'unknown';
  END IF;

  -- ── 7c. Components mismatch guard (advisory) ─────────────────
  v_components_sum := v_margin_pressure
                    + v_labor_burn_pressure
                    + v_volatility_pressure
                    + v_data_uncertainty_pressure;

  v_risk_components_mismatch := ABS(v_components_sum - v_risk) > 1.5;

  -- ── 8. Return — complete, type-safe shape always ─────────────
  RETURN jsonb_build_object(
    'contract_value',
        ROUND(COALESCE(v_contract_value, 0)::numeric, 2),
    'economic_position',
        COALESCE(v_position, 'stable'),
    'executive_summary',
        CASE
          WHEN v_position = 'unknown' THEN 'Labor data missing — economic position cannot be determined. Review time entries.'
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
  WHEN SQLSTATE '42501' THEN RAISE;
  WHEN SQLSTATE 'P0001' THEN RAISE;
  WHEN OTHERS THEN
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
$function$;
