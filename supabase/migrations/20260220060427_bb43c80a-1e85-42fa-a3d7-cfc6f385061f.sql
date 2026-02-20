
-- ═══════════════════════════════════════════════════════════════════════════
-- public.rpc_scan_economic_data_integrity(p_org_id uuid) → jsonb
--
-- Scans all active projects for structural data integrity problems that
-- produce silent bad numbers in financial reporting.
--
-- Checks (deterministic, read-only):
--   1. zero_projected_revenue     — projected_revenue = 0 (no estimate / CO)
--   2. no_selected_estimate       — no approved estimate linked to project
--   3. unrated_labor              — time entries exist but no cost rate on worker
--   4. negative_margin_no_co      — projected margin < 0 AND no approved COs
--
-- Output:
--   { issues: [{ project_id, project_name, issue_key, severity }],
--     issue_count: N,
--     scanned_at: timestamptz }
--
-- Security: STABLE SECURITY DEFINER, search_path pinned.
--           Caller must be an org member (rpc_is_org_member).
--           REVOKE from public/anon; GRANT to authenticated.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rpc_scan_economic_data_integrity(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid         uuid;
  v_issues      jsonb := '[]'::jsonb;
  v_proj        RECORD;
  v_issue_count int   := 0;

  -- per-project accumulators
  v_snap_revenue        numeric;
  v_approved_est_count  int;
  v_unrated_hours       numeric;
  v_time_entry_count    int;
  v_approved_co_count   int;
  v_margin_pct          numeric;
BEGIN
  -- ── 1. Auth ──────────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 2. Iterate active projects (same contract as executive RPCs) ──
  FOR v_proj IN
    SELECT id, name
    FROM   public.projects
    WHERE  organization_id = p_org_id
      AND  is_deleted       = false
      AND  public.rpc_is_project_active(id) = true
    ORDER  BY id ASC
  LOOP

    -- ── Check 1: zero_projected_revenue ──────────────────────
    SELECT COALESCE(snap.projected_revenue, 0)
      INTO v_snap_revenue
      FROM public.v_project_economic_snapshot snap
     WHERE snap.project_id = v_proj.id;

    IF NOT FOUND THEN
      v_snap_revenue := 0;
    END IF;

    IF v_snap_revenue = 0 THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'project_id',   v_proj.id,
        'project_name', v_proj.name,
        'issue_key',    'zero_projected_revenue',
        'severity',     'high'
      ));
      v_issue_count := v_issue_count + 1;
    END IF;

    -- ── Check 2: no_selected_estimate ────────────────────────
    SELECT COUNT(*) INTO v_approved_est_count
      FROM public.estimates
     WHERE project_id = v_proj.id
       AND status = 'approved';

    IF v_approved_est_count = 0 THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'project_id',   v_proj.id,
        'project_name', v_proj.name,
        'issue_key',    'no_selected_estimate',
        'severity',     'high'
      ));
      v_issue_count := v_issue_count + 1;
    END IF;

    -- ── Check 3: unrated_labor ────────────────────────────────
    -- Time entries exist but the worker has neither a project-member cost
    -- rate nor an org-membership hourly cost rate (→ rate resolves to 0).
    SELECT
      COUNT(*)                                                         AS total_te,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(pm.cost_rate, om.hourly_cost_rate, 0) = 0
          THEN te.duration_hours
          ELSE 0
        END
      ), 0)                                                            AS unrated_hrs
    INTO v_time_entry_count, v_unrated_hours
    FROM public.time_entries te
    LEFT JOIN public.project_members pm
      ON pm.project_id = te.project_id AND pm.user_id = te.user_id
    LEFT JOIN public.organization_memberships om
      ON om.organization_id = te.organization_id AND om.user_id = te.user_id
    WHERE te.project_id     = v_proj.id
      AND te.status         IN ('approved', 'locked', 'posted')
      AND te.check_out_at   IS NOT NULL
      AND te.duration_hours > 0;

    IF v_time_entry_count > 0 AND v_unrated_hours > 0 THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'project_id',   v_proj.id,
        'project_name', v_proj.name,
        'issue_key',    'unrated_labor',
        'severity',     'medium',
        'detail',       jsonb_build_object(
          'unrated_hours', ROUND(v_unrated_hours::numeric, 2)
        )
      ));
      v_issue_count := v_issue_count + 1;
    END IF;

    -- ── Check 4: negative_margin_no_co ───────────────────────
    -- Projected margin is negative but there are no approved change orders
    -- to explain it (silent cost overrun, not a CO-funded change).
    SELECT
      (COALESCE(snap.realized_margin_ratio, 0)) * 100
    INTO v_margin_pct
    FROM public.v_project_economic_snapshot snap
    WHERE snap.project_id = v_proj.id;

    IF v_margin_pct IS NOT NULL AND v_margin_pct < 0 THEN
      SELECT COUNT(*) INTO v_approved_co_count
        FROM public.change_orders
       WHERE project_id = v_proj.id
         AND status IN ('approved', 'completed');

      IF v_approved_co_count = 0 THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object(
          'project_id',   v_proj.id,
          'project_name', v_proj.name,
          'issue_key',    'negative_margin_no_co',
          'severity',     'high',
          'detail',       jsonb_build_object(
            'margin_pct', ROUND(v_margin_pct::numeric, 2)
          )
        ));
        v_issue_count := v_issue_count + 1;
      END IF;
    END IF;

  END LOOP;

  -- ── 3. Sort issues deterministically ──────────────────────────
  -- Order: severity (high first), then issue_key ASC, then project_id ASC
  SELECT COALESCE(
    jsonb_agg(
      iss
      ORDER BY
        CASE iss->>'severity' WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC,
        (iss->>'issue_key')   ASC,
        (iss->>'project_id')  ASC
    ),
    '[]'::jsonb
  )
  INTO v_issues
  FROM jsonb_array_elements(v_issues) AS iss;

  -- ── 4. Return ─────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'issues',      v_issues,
    'issue_count', v_issue_count,
    'scanned_at',  now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_scan_economic_data_integrity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_scan_economic_data_integrity(uuid) TO authenticated;

COMMENT ON FUNCTION public.rpc_scan_economic_data_integrity(uuid) IS
  'Read-only structural integrity scanner for active projects. '
  'Detects: zero_projected_revenue, no_selected_estimate, unrated_labor, negative_margin_no_co. '
  'STABLE SECURITY DEFINER. search_path pinned. Deterministic output (severity→key→project_id sort).';


-- ═══════════════════════════════════════════════════════════════════════════
-- Append data_integrity key to rpc_get_executive_risk_summary
-- All existing output keys preserved verbatim — one new key appended.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rpc_get_executive_risk_summary(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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
  v_flag_text             text;
  v_cause_agg             jsonb   := '[]'::jsonb;
  v_os_score              jsonb;

  v_dict                  jsonb;

  v_proj_revenue          numeric;
  v_total_revenue         numeric := 0;
  v_high_risk_revenue     numeric := 0;
  v_top3_revenue          numeric := 0;

  v_revenue_exposed_high_risk_percent numeric := 0;
  v_top_3_risky_revenue_percent       numeric := 0;

  -- Data integrity (new)
  v_data_integrity        jsonb   := NULL;
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
  FOR v_proj IN
    SELECT id, name
    FROM   public.projects
    WHERE  organization_id = p_org_id
    AND    is_deleted       = false
    AND    status NOT IN ('completed', 'closed', 'cancelled')
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
    SELECT f
    FROM   jsonb_array_elements_text(v_sorted_flags) AS f;

  END LOOP;

  -- ── 5. Average margin ─────────────────────────────────────────
  IF v_margin_count > 0 THEN
    v_avg_margin := ROUND(v_margin_sum / v_margin_count, 2);
  END IF;

  -- ── 6. Top 3 risk projects ────────────────────────────────────
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

  -- ── 6b. Revenue exposure ──────────────────────────────────────
  IF v_total_revenue > 0 THEN
    v_revenue_exposed_high_risk_percent :=
      ROUND((v_high_risk_revenue / v_total_revenue) * 100, 2);

    SELECT COALESCE(SUM((r->>'projected_revenue')::numeric), 0)
      INTO v_top3_revenue
      FROM jsonb_array_elements(v_top_risk) AS r;

    v_top_3_risky_revenue_percent :=
      ROUND((v_top3_revenue / v_total_revenue) * 100, 2);
  END IF;

  -- ── 7. Top 5 causes ───────────────────────────────────────────
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

  -- ── 8. OS score ───────────────────────────────────────────────
  BEGIN
    v_os_score := public.rpc_get_operating_system_score(p_org_id);
  EXCEPTION WHEN OTHERS THEN
    v_os_score := jsonb_build_object('error', SQLERRM);
  END;

  -- ── 9. Data integrity scan ────────────────────────────────────
  BEGIN
    v_data_integrity := public.rpc_scan_economic_data_integrity(p_org_id);
  EXCEPTION WHEN OTHERS THEN
    v_data_integrity := jsonb_build_object(
      'error',       SQLERRM,
      'issues',      '[]'::jsonb,
      'issue_count', 0
    );
  END;

  -- ── 10. Return ────────────────────────────────────────────────
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
    -- new key — zero-cost to existing callers (additive)
    'data_integrity',                             v_data_integrity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_executive_risk_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_executive_risk_summary(uuid) TO authenticated;
