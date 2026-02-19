
-- ============================================================
-- Task A — Offender confirmed:
--   rpc_generate_project_margin_control line 8 of RETURN block:
--   'contract_value', round(COALESCE(v_snap.contract_value, 0)::numeric, 2)
--   BUT v_project_economic_snapshot has no column 'contract_value'.
--   Correct column is: projected_revenue
--
-- Task B — Patch: replace v_snap.contract_value → v_snap.projected_revenue
-- Task C — Defensive COALESCE already present, keep it
-- Task D — Security posture unchanged: SECURITY DEFINER + search_path preserved
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_generate_project_margin_control(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org_id   uuid;
  v_snap     record;
  v_omp      record;
  v_burn     record;
  v_proj     record;
  v_risk     int    := 0;
  v_position text;
  v_flags    jsonb  := '[]'::jsonb;
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
  IF v_proj.margin_declining_flag THEN
    v_risk  := v_risk + 30;
    v_flags := v_flags || to_jsonb('margin_declining'::text);
  END IF;

  --  labor_burn_exceeding_benchmark (+25)
  IF v_burn.labor_risk_flag THEN
    v_risk  := v_risk + 25;
    v_flags := v_flags || to_jsonb('labor_burn_exceeding_benchmark'::text);
  END IF;

  --  margin_declining (+20, additive guard)
  IF v_omp.historical_margin_low_band IS NOT NULL
     AND COALESCE(v_snap.realized_margin_ratio, 0) < v_omp.historical_margin_low_band THEN
    v_risk  := v_risk + 20;
    IF NOT (v_flags @> to_jsonb('margin_declining'::text)) THEN
      v_flags := v_flags || to_jsonb('margin_declining'::text);
    END IF;
  END IF;

  --  low_historical_data (+15)
  IF COALESCE(v_omp.completed_projects_count, 0) < 5 THEN
    v_risk  := v_risk + 15;
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

  -- ── 7. Economic position ─────────────────────────────────────
  IF    v_risk > 60  THEN v_position := 'at_risk';
  ELSIF v_risk >= 30 THEN v_position := 'volatile';
  ELSE                    v_position := 'stable';
  END IF;

  -- ── 8. Return ────────────────────────────────────────────────
  -- FIX: v_snap.contract_value → v_snap.projected_revenue
  --      (v_project_economic_snapshot has no contract_value column)
  RETURN jsonb_build_object(
    'economic_position',   v_position,
    'executive_summary',   CASE
                             WHEN v_risk > 60  THEN 'Project margin is at risk. Immediate review recommended.'
                             WHEN v_risk >= 30 THEN 'Project margin is volatile. Monitor closely.'
                             ELSE                   'Project margin is within acceptable range.'
                           END,
    'risk_score',          v_risk,
    'intervention_flags',  v_flags,
    'contract_value',      round(COALESCE(v_snap.projected_revenue, 0)::numeric, 2),
    'realized_margin',     round(COALESCE(v_snap.realized_margin_ratio, 0)::numeric, 2),
    'labor_burn_ratio',    round(COALESCE(v_burn.labor_cost_ratio,      0)::numeric, 2),
    'projected_margin',    round(COALESCE(v_proj.projected_margin_at_completion_ratio, 0)::numeric, 2),
    'snapshot_date',       now()::date
  );
END;
$function$;
