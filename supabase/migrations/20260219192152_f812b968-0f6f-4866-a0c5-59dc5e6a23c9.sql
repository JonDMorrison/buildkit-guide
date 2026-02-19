
-- ============================================================
-- Migration: Fix intervention_flags — pure JSONB end-to-end
-- ============================================================
-- Found offenders in rpc_generate_project_margin_control:
--   Line 15:  v_flags text[] := ARRAY[]::text[];          ← OFFENDER
--   Line 42:  v_flags := v_flags || 'margin_declining';   ← text[] append
--   Line 49:  v_flags := v_flags || 'labor_burn_exceeding_benchmark'; ← text[] append
--   Line 62:  IF NOT ('margin_declining' = ANY(v_flags))  ← ANY() on text[]
--   Line 63:  v_flags := v_flags || 'margin_declining';   ← text[] append
--   Line 71:  v_flags := v_flags || 'low_historical_data';← text[] append
--   Line 78:  SELECT array_agg(f ORDER BY f) INTO v_flags  ← array_agg → text[]
--             FROM unnest(v_flags) AS f;
--   Return:   'intervention_flags', v_flags               ← text[] serialized
-- No helper functions call; all offenders are in the main function body.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_generate_project_margin_control(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_org_id   uuid;
  v_snap     record;
  v_omp      record;
  v_burn     record;
  v_proj     record;
  v_risk     int    := 0;
  v_position text;
  v_flags    jsonb  := '[]'::jsonb;   -- PATCHED: was text[] := ARRAY[]::text[]
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
    v_flags := v_flags || to_jsonb('margin_declining'::text);  -- PATCHED
  END IF;

  --  labor_burn_exceeding_benchmark (+25)
  --    Formerly emitted as 'labor_burn_high' — normalized to canonical key.
  IF v_burn.labor_risk_flag THEN
    v_risk  := v_risk + 25;
    v_flags := v_flags || to_jsonb('labor_burn_exceeding_benchmark'::text);  -- PATCHED
  END IF;

  --  margin_declining (+20, additive if not already added)
  --    Formerly emitted as 'below_low_band'.
  --    Absorbed into 'margin_declining': both signals indicate the project
  --    margin has fallen below the organisation's safe band.
  IF v_omp.historical_margin_low_band IS NOT NULL
     AND COALESCE(v_snap.realized_margin_ratio, 0) < v_omp.historical_margin_low_band THEN
    v_risk  := v_risk + 20;
    -- PATCHED: was 'margin_declining' = ANY(v_flags) on text[]
    -- Now uses JSONB containment: check if flag already present
    IF NOT (v_flags @> to_jsonb('margin_declining'::text)) THEN
      v_flags := v_flags || to_jsonb('margin_declining'::text);
    END IF;
  END IF;

  --  low_historical_data (+15)
  --    Unchanged canonical key.
  IF COALESCE(v_omp.completed_projects_count, 0) < 5 THEN
    v_risk  := v_risk + 15;
    v_flags := v_flags || to_jsonb('low_historical_data'::text);  -- PATCHED
  END IF;

  -- ── 5. Clamp risk to [0, 100] ────────────────────────────────
  v_risk := LEAST(GREATEST(v_risk, 0), 100);

  -- ── 6. Deduplicate + sort flags deterministically (JSONB) ────
  -- PATCHED: was array_agg(f ORDER BY f) ... unnest(v_flags) on text[]
  SELECT COALESCE(jsonb_agg(x ORDER BY x), '[]'::jsonb)
    INTO v_flags
    FROM (SELECT DISTINCT jsonb_array_elements_text(v_flags) AS x) s;

  -- ── 6b. Regression guard ─────────────────────────────────────
  IF jsonb_typeof(v_flags) <> 'array' THEN
    RAISE EXCEPTION 'flags_not_json_array';
  END IF;

  -- ── 7. Economic position ─────────────────────────────────────
  IF    v_risk > 60  THEN v_position := 'at_risk';
  ELSIF v_risk >= 30 THEN v_position := 'volatile';
  ELSE                    v_position := 'stable';
  END IF;

  -- ── 8. Return ────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'economic_position',   v_position,
    'executive_summary',   CASE
                             WHEN v_risk > 60  THEN 'Project margin is at risk. Immediate review recommended.'
                             WHEN v_risk >= 30 THEN 'Project margin is volatile. Monitor closely.'
                             ELSE                   'Project margin is within acceptable range.'
                           END,
    'risk_score',          v_risk,
    'intervention_flags',  v_flags,   -- PATCHED: pure jsonb, no ::text[] cast
    'contract_value',      round(COALESCE(v_snap.contract_value,        0)::numeric, 2),
    'realized_margin',     round(COALESCE(v_snap.realized_margin_ratio, 0)::numeric, 2),
    'labor_burn_ratio',    round(COALESCE(v_burn.labor_burn_ratio,      0)::numeric, 2),
    'projected_margin',    round(COALESCE(v_proj.projected_margin_ratio,0)::numeric, 2),
    'snapshot_date',       now()::date
  );
END;
$$;
