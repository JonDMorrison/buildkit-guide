
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. public.rpc_is_project_active(p_project_id uuid) → boolean
--
-- Single source of truth for "active" project status.
-- Active = is_deleted IS NOT TRUE
--          AND status NOT IN ('completed','archived','deleted','cancelled','didnt_get')
--
-- SECURITY DEFINER so callers don't need direct projects access.
-- No writes. search_path pinned. Membership NOT checked here — the caller
-- is responsible for membership checks; this helper only evaluates status.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rpc_is_project_active(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active boolean;
BEGIN
  SELECT (
    is_deleted IS NOT TRUE
    AND status NOT IN ('completed', 'archived', 'deleted', 'cancelled', 'didnt_get')
  )
  INTO v_active
  FROM public.projects
  WHERE id = p_project_id;

  -- Project not found → treat as inactive
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN COALESCE(v_active, false);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_is_project_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_is_project_active(uuid) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Update rpc_get_executive_risk_summary
--    Replace inline status filter with rpc_is_project_active.
--    All existing fields preserved exactly.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rpc_get_executive_risk_summary(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid                   uuid;
  v_proj                  record;
  v_margin_result         jsonb;
  v_risk_score            int;
  v_economic_position     text;
  v_executive_summary     text;
  v_margin_pct            numeric;
  v_intervention_flags    jsonb;
  v_sorted_flags          jsonb;

  v_active_count          int     := 0;
  v_at_risk_count         int     := 0;
  v_volatile_count        int     := 0;
  v_stable_count          int     := 0;
  v_margin_sum            numeric := 0;
  v_margin_count          int     := 0;
  v_avg_margin            numeric := 0;

  v_all_projects          jsonb   := '[]'::jsonb;
  v_top_risk              jsonb   := '[]'::jsonb;
  v_cause_agg             jsonb   := '[]'::jsonb;
  v_os_score              jsonb;
  v_dict                  jsonb;

  v_proj_revenue          numeric;
  v_total_revenue         numeric := 0;
  v_high_risk_revenue     numeric := 0;
  v_top3_revenue          numeric := 0;
  v_revenue_exposed_high_risk_percent numeric := 0;
  v_top_3_risky_revenue_percent       numeric := 0;

  v_risk_trend            numeric := 0;
  v_margin_trend          numeric := 0;
BEGIN
  -- ── 1. Auth ──────────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 2. Load dictionary once ───────────────────────────────────
  v_dict := public.rpc_get_margin_flag_dictionary();

  -- ── 3. Temp table for cause counting ─────────────────────────
  CREATE TEMP TABLE IF NOT EXISTS _exec_risk_causes (cause text) ON COMMIT DROP;
  TRUNCATE _exec_risk_causes;

  -- ── 4. Iterate active projects ───────────────────────────────
  --  Active-status definition delegated to rpc_is_project_active:
  --    is_deleted IS NOT TRUE
  --    AND status NOT IN ('completed','archived','deleted','cancelled','didnt_get')
  --  Ordered deterministically by id ASC.
  FOR v_proj IN
    SELECT id, name
    FROM   public.projects
    WHERE  organization_id = p_org_id
    AND    public.rpc_is_project_active(id)
    ORDER  BY id ASC
  LOOP
    v_active_count := v_active_count + 1;

    BEGIN
      v_margin_result := public.rpc_generate_project_margin_control(v_proj.id);
    EXCEPTION WHEN OTHERS THEN
      v_margin_result := NULL;
    END;

    v_risk_score         := COALESCE((v_margin_result->>'risk_score')::int,  0);
    v_economic_position  := COALESCE(v_margin_result->>'economic_position',  'unknown');
    v_executive_summary  := COALESCE(v_margin_result->>'executive_summary',  '');
    v_margin_pct         := (v_margin_result->>'projected_margin_at_completion_percent')::numeric;
    v_proj_revenue       := COALESCE((v_margin_result->>'contract_value')::numeric, 0);
    v_intervention_flags := COALESCE(v_margin_result->'intervention_flags', '[]'::jsonb);

    SELECT COALESCE(jsonb_agg(f ORDER BY f ASC), '[]'::jsonb)
      INTO v_sorted_flags
      FROM jsonb_array_elements_text(v_intervention_flags) AS f;

    CASE v_economic_position
      WHEN 'at_risk'  THEN v_at_risk_count  := v_at_risk_count  + 1;
      WHEN 'volatile' THEN v_volatile_count := v_volatile_count + 1;
      WHEN 'stable'   THEN v_stable_count   := v_stable_count   + 1;
      ELSE NULL;
    END CASE;

    IF v_margin_pct IS NOT NULL THEN
      v_margin_sum   := v_margin_sum   + v_margin_pct;
      v_margin_count := v_margin_count + 1;
    END IF;

    v_total_revenue := v_total_revenue + v_proj_revenue;
    IF v_risk_score >= 60 THEN
      v_high_risk_revenue := v_high_risk_revenue + v_proj_revenue;
    END IF;

    v_all_projects := v_all_projects || jsonb_build_object(
      'project_id',        v_proj.id,
      'project_name',      v_proj.name,
      'risk_score',        v_risk_score,
      'economic_position', v_economic_position,
      'executive_summary', v_executive_summary,
      'projected_revenue', v_proj_revenue
    );

    INSERT INTO _exec_risk_causes (cause)
    SELECT f FROM jsonb_array_elements_text(v_sorted_flags) AS f;

  END LOOP;

  -- ── 5. Average margin ────────────────────────────────────────
  IF v_margin_count > 0 THEN
    v_avg_margin := ROUND(v_margin_sum / v_margin_count, 2);
  END IF;

  -- ── 6. Top 3 risk projects ───────────────────────────────────
  SELECT COALESCE(
    jsonb_agg(r ORDER BY (r->>'risk_score')::int DESC, r->>'project_id' ASC),
    '[]'::jsonb
  )
  INTO v_top_risk
  FROM (
    SELECT value AS r
    FROM   jsonb_array_elements(v_all_projects)
    ORDER  BY (value->>'risk_score')::int DESC, value->>'project_id' ASC
    LIMIT  3
  ) sub;

  -- ── 6b. Revenue exposure metrics ─────────────────────────────
  IF v_total_revenue > 0 THEN
    v_revenue_exposed_high_risk_percent :=
      ROUND((v_high_risk_revenue / v_total_revenue) * 100, 2);

    SELECT COALESCE(SUM((r->>'projected_revenue')::numeric), 0)
      INTO v_top3_revenue
      FROM jsonb_array_elements(v_top_risk) AS r;

    v_top_3_risky_revenue_percent :=
      ROUND((v_top3_revenue / v_total_revenue) * 100, 2);
  END IF;

  -- ── 6c. Trend fields from project_margin_snapshots ───────────
  WITH active_projects AS (
    SELECT id AS project_id
    FROM   public.projects
    WHERE  organization_id = p_org_id
    AND    public.rpc_is_project_active(id)
  ),
  snaps AS (
    SELECT
      pms.project_id,
      pms.snapshot_date,
      pms.risk_score,
      pms.projected_margin_ratio,
      ROW_NUMBER() OVER (PARTITION BY pms.project_id ORDER BY pms.snapshot_date ASC,  pms.project_id ASC) AS rn_first,
      ROW_NUMBER() OVER (PARTITION BY pms.project_id ORDER BY pms.snapshot_date DESC, pms.project_id ASC) AS rn_last,
      COUNT(*)     OVER (PARTITION BY pms.project_id)                                                     AS snap_count
    FROM   public.project_margin_snapshots pms
    JOIN   active_projects ap ON ap.project_id = pms.project_id
    WHERE  pms.snapshot_date >= current_date - 30
  ),
  deltas AS (
    SELECT
      project_id,
      MAX(risk_score)             FILTER (WHERE rn_last  = 1) -
      MAX(risk_score)             FILTER (WHERE rn_first = 1)   AS risk_delta,
      MAX(projected_margin_ratio) FILTER (WHERE rn_last  = 1) -
      MAX(projected_margin_ratio) FILTER (WHERE rn_first = 1)   AS margin_delta
    FROM   snaps
    WHERE  snap_count >= 2
    GROUP  BY project_id
  )
  SELECT
    ROUND(COALESCE(AVG(risk_delta),   0), 2),
    ROUND(COALESCE(AVG(margin_delta), 0), 2)
  INTO v_risk_trend, v_margin_trend
  FROM deltas;

  -- ── 7. Top 5 causes ──────────────────────────────────────────
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'cause',    sub.cause,
        'label',    COALESCE(v_dict->sub.cause->>'label',    sub.cause),
        'count',    sub.cnt,
        'severity', COALESCE(v_dict->sub.cause->>'severity', 'medium')
      )
      ORDER BY sub.cnt DESC, sub.cause ASC
    ),
    '[]'::jsonb
  )
  INTO v_cause_agg
  FROM (
    SELECT cause, COUNT(*) AS cnt
    FROM   _exec_risk_causes
    GROUP  BY cause
    ORDER  BY cnt DESC, cause ASC
    LIMIT  5
  ) sub;

  -- ── 8. OS score ──────────────────────────────────────────────
  BEGIN
    v_os_score := public.rpc_get_operating_system_score(p_org_id);
  EXCEPTION WHEN OTHERS THEN
    v_os_score := jsonb_build_object('error', SQLERRM);
  END;

  -- ── 9. Return ────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'org_id',                                     p_org_id,
    'projects_active_count',                      v_active_count,
    'at_risk_count',                              v_at_risk_count,
    'volatile_count',                             v_volatile_count,
    'stable_count',                               v_stable_count,
    'avg_projected_margin_at_completion_percent', v_avg_margin,
    'top_risk_projects',                          v_top_risk,
    'top_causes',                                 v_cause_agg,
    'os_score',                                   v_os_score,
    'revenue_exposed_high_risk_percent',          v_revenue_exposed_high_risk_percent,
    'top_3_risky_revenue_percent',                v_top_3_risky_revenue_percent,
    'risk_trend_last_30_days',                    v_risk_trend,
    'margin_trend_last_30_days',                  v_margin_trend
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_executive_risk_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_executive_risk_summary(uuid) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Update rpc_get_executive_dashboard
--    Replace status NOT IN (...) with rpc_is_project_active.
--    All existing fields preserved exactly.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rpc_get_executive_dashboard(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_os_score   jsonb;
  v_at_risk    bigint;
  v_volatile   bigint;
  v_avg_margin numeric;
  v_top3       jsonb;
BEGIN
  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  v_os_score := public.rpc_get_operating_system_score(p_org_id);

  WITH controls AS (
    SELECT
      p.id AS project_id,
      p.name AS project_name,
      public.rpc_generate_project_margin_control(p.id) AS ctrl
    FROM public.projects p
    WHERE p.organization_id = p_org_id
      AND public.rpc_is_project_active(p.id)
  ),
  ranked AS (
    SELECT
      project_id,
      project_name,
      ctrl,
      (ctrl->>'risk_score')::int AS risk_score
    FROM controls
    ORDER BY (ctrl->>'risk_score')::int DESC, project_id ASC
  )
  SELECT
    COALESCE(COUNT(*) FILTER (WHERE (ctrl->>'economic_position') = 'at_risk'),  0),
    COALESCE(COUNT(*) FILTER (WHERE (ctrl->>'economic_position') = 'volatile'), 0),
    ROUND(COALESCE(AVG((ctrl->>'projected_margin_at_completion_percent')::numeric), 0)::numeric, 2),
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'economic_position', r2.ctrl->>'economic_position',
          'project_id',        r2.project_id,
          'project_name',      r2.project_name,
          'risk_score',        r2.risk_score
        ) ORDER BY r2.risk_score DESC, r2.project_id ASC
      ) FROM (SELECT * FROM ranked LIMIT 3) r2),
      '[]'::jsonb
    )
  INTO v_at_risk, v_volatile, v_avg_margin, v_top3
  FROM ranked;

  RETURN jsonb_build_object(
    'active_projects_at_risk',      COALESCE(v_at_risk,    0),
    'active_projects_volatile',     COALESCE(v_volatile,   0),
    'avg_projected_margin_percent', ROUND(COALESCE(v_avg_margin, 0)::numeric, 2),
    'os_score',                     v_os_score,
    'top_risk_projects',            COALESCE(v_top3, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_executive_dashboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_executive_dashboard(uuid) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Update rpc_run_ai_brain_scenario_suite
--    Replace inline status filters with rpc_is_project_active.
--    Scenario E (closed) remains its own deliberate query — it specifically
--    NEEDS non-active projects and uses the inverse of rpc_is_project_active.
--    Scenario F (active control) uses rpc_is_project_active.
--    All other scenario queries were already unrestricted by status; kept as-is.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rpc_run_ai_brain_scenario_suite(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_member boolean := false;
  v_scenarios jsonb := '[]'::jsonb;
  v_project_id uuid;
  v_label text;
  v_margin_result jsonb;
  v_error_state text;
  v_error_msg text;
  v_all_ok boolean := true;

  v_pid_no_estimate       uuid;
  v_pid_no_time_entries   uuid;
  v_pid_zero_revenue      uuid;
  v_pid_has_change_orders uuid;
  v_pid_closed            uuid;
  v_pid_active            uuid;
BEGIN
  -- ── 1. Membership guard ────────────────────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = p_org_id
      AND user_id = v_uid
      AND is_active = true
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Not authorized for org %', p_org_id
      USING ERRCODE = '42501';
  END IF;

  -- ── 2. Deterministic project selection (ORDER BY id ASC) ───────

  -- Scenario A: no estimate (any project state)
  SELECT p.id INTO v_pid_no_estimate
  FROM public.projects p
  WHERE p.organization_id = p_org_id
    AND NOT EXISTS (SELECT 1 FROM estimates e WHERE e.project_id = p.id)
  ORDER BY p.id ASC
  LIMIT 1;

  -- Scenario B: estimate exists but no time entries (any project state)
  SELECT p.id INTO v_pid_no_time_entries
  FROM public.projects p
  WHERE p.organization_id = p_org_id
    AND EXISTS     (SELECT 1 FROM estimates e    WHERE e.project_id  = p.id)
    AND NOT EXISTS (SELECT 1 FROM time_entries te WHERE te.project_id = p.id)
    AND p.id IS DISTINCT FROM v_pid_no_estimate
  ORDER BY p.id ASC
  LIMIT 1;

  -- Scenario C: time entries exist but projected_revenue is 0 or null (any project state)
  SELECT p.id INTO v_pid_zero_revenue
  FROM public.projects p
  WHERE p.organization_id = p_org_id
    AND EXISTS (SELECT 1 FROM time_entries te WHERE te.project_id = p.id)
    AND p.id IS DISTINCT FROM v_pid_no_estimate
    AND p.id IS DISTINCT FROM v_pid_no_time_entries
    AND NOT EXISTS (
      SELECT 1 FROM estimates e WHERE e.project_id = p.id AND e.contract_value > 0
    )
  ORDER BY p.id ASC
  LIMIT 1;

  -- Scenario D: has at least one approved change order (any project state)
  SELECT p.id INTO v_pid_has_change_orders
  FROM public.projects p
  WHERE p.organization_id = p_org_id
    AND EXISTS (
      SELECT 1 FROM change_orders co
      WHERE co.project_id = p.id AND co.status = 'approved'
    )
    AND p.id IS DISTINCT FROM v_pid_no_estimate
    AND p.id IS DISTINCT FROM v_pid_no_time_entries
    AND p.id IS DISTINCT FROM v_pid_zero_revenue
  ORDER BY p.id ASC
  LIMIT 1;

  -- Scenario E: a deliberately NON-active (terminal) project.
  -- Intentionally uses NOT rpc_is_project_active — this tests the engine
  -- on a closed/completed project to verify graceful handling.
  SELECT p.id INTO v_pid_closed
  FROM public.projects p
  WHERE p.organization_id = p_org_id
    AND NOT public.rpc_is_project_active(p.id)
    AND p.id IS DISTINCT FROM v_pid_no_estimate
    AND p.id IS DISTINCT FROM v_pid_no_time_entries
    AND p.id IS DISTINCT FROM v_pid_zero_revenue
    AND p.id IS DISTINCT FROM v_pid_has_change_orders
  ORDER BY p.id ASC
  LIMIT 1;

  -- Scenario F: active control — delegates active definition to rpc_is_project_active
  SELECT p.id INTO v_pid_active
  FROM public.projects p
  WHERE p.organization_id = p_org_id
    AND public.rpc_is_project_active(p.id)
    AND p.id IS DISTINCT FROM v_pid_no_estimate
    AND p.id IS DISTINCT FROM v_pid_no_time_entries
    AND p.id IS DISTINCT FROM v_pid_zero_revenue
    AND p.id IS DISTINCT FROM v_pid_has_change_orders
    AND p.id IS DISTINCT FROM v_pid_closed
  ORDER BY p.id ASC
  LIMIT 1;

  -- ── 3. Run margin control for each non-null scenario ───────────
  FOR v_project_id, v_label IN
    SELECT pid, lbl FROM (VALUES
      (v_pid_no_estimate,       'no_estimate'),
      (v_pid_no_time_entries,   'estimate_no_time_entries'),
      (v_pid_zero_revenue,      'zero_projected_revenue'),
      (v_pid_has_change_orders, 'has_approved_change_orders'),
      (v_pid_closed,            'completed_or_closed'),
      (v_pid_active,            'active_control')
    ) AS t(pid, lbl)
    WHERE pid IS NOT NULL
    ORDER BY lbl ASC
  LOOP
    BEGIN
      v_margin_result := public.rpc_generate_project_margin_control(v_project_id);

      v_scenarios := v_scenarios || jsonb_build_object(
        'scenario',   v_label,
        'project_id', v_project_id,
        'success',    true,
        'ok',         COALESCE((v_margin_result->>'ok')::boolean, true),
        'payload',    v_margin_result,
        'error',      NULL
      );

      IF NOT COALESCE((v_margin_result->>'ok')::boolean, true) THEN
        v_all_ok := false;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_error_state := SQLSTATE;
      v_error_msg   := SQLERRM;
      v_all_ok := false;

      v_scenarios := v_scenarios || jsonb_build_object(
        'scenario',   v_label,
        'project_id', v_project_id,
        'success',    false,
        'ok',         false,
        'payload',    NULL,
        'error',      jsonb_build_object('sqlstate', v_error_state, 'message', v_error_msg)
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok',        v_all_ok,
    'org_id',    p_org_id,
    'scenarios', v_scenarios
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_run_ai_brain_scenario_suite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_run_ai_brain_scenario_suite(uuid) TO authenticated;
