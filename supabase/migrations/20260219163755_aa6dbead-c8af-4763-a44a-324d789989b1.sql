
-- 1. rpc_generate_project_margin_control: use rpc_is_org_member
CREATE OR REPLACE FUNCTION public.rpc_generate_project_margin_control(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id       uuid;
  v_snap         record;
  v_omp          record;
  v_burn         record;
  v_proj         record;
  v_risk         int := 0;
  v_position     text;
  v_flags        text[] := ARRAY[]::text[];
BEGIN
  -- Validate project exists
  SELECT organization_id INTO v_org_id
  FROM projects WHERE id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501';
  END IF;

  -- Validate caller belongs to org
  IF NOT public.rpc_is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- Read views
  SELECT * INTO v_snap FROM v_project_economic_snapshot WHERE project_id = p_project_id;
  SELECT * INTO v_omp  FROM v_org_margin_performance    WHERE org_id = v_org_id;
  SELECT * INTO v_burn FROM v_project_labor_burn_index   WHERE project_id = p_project_id;
  SELECT * INTO v_proj FROM v_project_margin_projection  WHERE project_id = p_project_id;

  -- Compute risk score and collect flags
  IF v_proj.margin_declining_flag THEN
    v_risk := v_risk + 30;
    v_flags := v_flags || 'margin_declining';
  END IF;

  IF v_burn.labor_risk_flag THEN
    v_risk := v_risk + 25;
    v_flags := v_flags || 'labor_burn_high';
  END IF;

  IF v_omp.historical_margin_low_band IS NOT NULL
     AND COALESCE(v_snap.realized_margin_ratio, 0) < v_omp.historical_margin_low_band THEN
    v_risk := v_risk + 20;
    v_flags := v_flags || 'below_low_band';
  END IF;

  IF COALESCE(v_omp.completed_projects_count, 0) < 5 THEN
    v_risk := v_risk + 15;
    v_flags := v_flags || 'low_historical_data';
  END IF;

  -- Clamp
  v_risk := LEAST(GREATEST(v_risk, 0), 100);

  -- Sort flags alphabetically for determinism
  SELECT array_agg(f ORDER BY f) INTO v_flags FROM unnest(v_flags) AS f;

  -- Position
  IF v_risk > 60 THEN v_position := 'at_risk';
  ELSIF v_risk >= 30 THEN v_position := 'volatile';
  ELSE v_position := 'stable';
  END IF;

  RETURN jsonb_build_object(
    'economic_position',                     v_position,
    'executive_summary',                     CASE
                                               WHEN v_risk > 60 THEN 'Project margin is at risk. Immediate review recommended.'
                                               WHEN v_risk >= 30 THEN 'Project margin is volatile. Monitor closely.'
                                               ELSE 'Project margin is within acceptable range.'
                                             END,
    'guardrail_recommendation',              CASE WHEN v_risk >= 60 THEN 'block' ELSE 'warn' END,
    'historical_org_margin_percent',         round(COALESCE(v_omp.historical_avg_margin_ratio, 0)::numeric * 100, 2),
    'intervention_flags',                    COALESCE(to_jsonb(v_flags), '[]'::jsonb),
    'intervention_priority',                 ceil(v_risk::numeric / 20),
    'margin_trajectory',                     CASE WHEN v_proj.margin_declining_flag THEN 'declining' ELSE 'stable_or_improving' END,
    'projected_margin_at_completion_percent', round(COALESCE(v_proj.projected_margin_at_completion_ratio, 0)::numeric * 100, 2),
    'risk_score',                            v_risk
  );
END;
$$;

-- 2. rpc_get_operating_system_score: use rpc_is_org_member
CREATE OR REPLACE FUNCTION public.rpc_get_operating_system_score(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_margin_score      numeric;
  v_workflow_score     numeric;
  v_guardrail_score    numeric;
  v_automation_score   numeric;
  v_maturity           numeric;
  v_tier               text;
  v_stddev             numeric;
  v_total_projects     bigint;
  v_playbook_projects  bigint;
  v_total_entries      bigint;
  v_clean_entries      bigint;
  v_compliant_projects bigint;
  v_projects_with_wf   bigint;
BEGIN
  -- Validate membership
  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- 1. Margin consistency from org margin performance
  SELECT COALESCE(historical_margin_stddev, 0) INTO v_stddev
  FROM v_org_margin_performance WHERE org_id = p_org_id;
  v_stddev := COALESCE(v_stddev, 0);
  v_margin_score := round(GREATEST(0, LEAST(100, 100 - v_stddev * 100))::numeric, 2);

  -- 2. Workflow compliance: % of projects where all steps are 'met'
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM project_workflow_steps s
      WHERE s.project_id = pw.project_id
        AND s.organization_id = p_org_id
        AND s.status IS DISTINCT FROM 'met'
    ))
  INTO v_projects_with_wf, v_compliant_projects
  FROM (SELECT DISTINCT project_id FROM project_workflow_steps WHERE organization_id = p_org_id) pw;

  v_workflow_score := round(
    COALESCE(v_compliant_projects, 0)::numeric / nullif(COALESCE(v_projects_with_wf, 0), 0) * 100,
    2
  );
  v_workflow_score := COALESCE(v_workflow_score, 0);

  -- 3. Guardrail discipline: % of time entries not flagged
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE NOT is_flagged)
  INTO v_total_entries, v_clean_entries
  FROM time_entries WHERE organization_id = p_org_id;

  v_guardrail_score := round(
    COALESCE(v_clean_entries, 0)::numeric / nullif(COALESCE(v_total_entries, 0), 0) * 100,
    2
  );
  v_guardrail_score := COALESCE(v_guardrail_score, 100);

  -- 4. Automation: % of projects created via playbook
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE applied_playbook_id IS NOT NULL)
  INTO v_total_projects, v_playbook_projects
  FROM projects WHERE organization_id = p_org_id;

  v_automation_score := round(
    COALESCE(v_playbook_projects, 0)::numeric / nullif(COALESCE(v_total_projects, 0), 0) * 100,
    2
  );
  v_automation_score := COALESCE(v_automation_score, 0);

  -- 5. Maturity: weighted average (margin 30%, workflow 25%, guardrail 25%, automation 20%)
  v_maturity := round((
    COALESCE(v_margin_score, 0) * 0.30 +
    COALESCE(v_workflow_score, 0) * 0.25 +
    COALESCE(v_guardrail_score, 0) * 0.25 +
    COALESCE(v_automation_score, 0) * 0.20
  )::numeric, 2);

  -- Tier
  IF v_maturity > 80 THEN v_tier := 'gold';
  ELSIF v_maturity >= 60 THEN v_tier := 'silver';
  ELSE v_tier := 'bronze';
  END IF;

  RETURN jsonb_build_object(
    'automation_score',             round(v_automation_score::numeric, 2),
    'certification_tier',           v_tier,
    'guardrail_discipline_score',   round(v_guardrail_score::numeric, 2),
    'margin_consistency_score',     round(v_margin_score::numeric, 2),
    'maturity_score',               round(v_maturity::numeric, 2),
    'workflow_compliance_score',    round(v_workflow_score::numeric, 2)
  );
END;
$$;

-- 3. rpc_get_executive_dashboard: use rpc_is_org_member
CREATE OR REPLACE FUNCTION public.rpc_get_executive_dashboard(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_os_score        jsonb;
  v_at_risk         bigint;
  v_volatile        bigint;
  v_avg_margin      numeric;
  v_top3            jsonb;
BEGIN
  -- Validate membership
  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- OS score
  v_os_score := public.rpc_get_operating_system_score(p_org_id);

  -- Aggregate from margin control per active project
  WITH controls AS (
    SELECT
      p.id AS project_id,
      p.name AS project_name,
      public.rpc_generate_project_margin_control(p.id) AS ctrl
    FROM projects p
    WHERE p.organization_id = p_org_id
      AND p.status NOT IN ('completed', 'closed', 'cancelled')
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
    COALESCE(COUNT(*) FILTER (WHERE (ctrl->>'economic_position') = 'at_risk'), 0),
    COALESCE(COUNT(*) FILTER (WHERE (ctrl->>'economic_position') = 'volatile'), 0),
    round(COALESCE(AVG((ctrl->>'projected_margin_at_completion_percent')::numeric), 0)::numeric, 2),
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'economic_position', r2.ctrl->>'economic_position',
          'project_id', r2.project_id,
          'project_name', r2.project_name,
          'risk_score', r2.risk_score
        ) ORDER BY r2.risk_score DESC, r2.project_id ASC
      ) FROM (SELECT * FROM ranked LIMIT 3) r2),
      '[]'::jsonb
    )
  INTO v_at_risk, v_volatile, v_avg_margin, v_top3
  FROM ranked;

  RETURN jsonb_build_object(
    'active_projects_at_risk',           COALESCE(v_at_risk, 0),
    'active_projects_volatile',          COALESCE(v_volatile, 0),
    'avg_projected_margin_percent',      round(COALESCE(v_avg_margin, 0)::numeric, 2),
    'os_score',                          v_os_score,
    'top_risk_projects',                 COALESCE(v_top3, '[]'::jsonb)
  );
END;
$$;

-- 4. rpc_run_ai_brain_test_runner: use rpc_is_org_member instead of direct table joins
CREATE OR REPLACE FUNCTION public.rpc_run_ai_brain_test_runner(
  p_project_id uuid DEFAULT NULL,
  p_org_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_id uuid := p_project_id;
  v_org_id     uuid := p_org_id;
  v_uid        uuid := auth.uid();

  v_views   jsonb := '{}'::jsonb;
  v_funcs   jsonb := '{}'::jsonb;
  v_sec     jsonb := '{}'::jsonb;
  v_priv    jsonb := '{}'::jsonb;
  v_smoke   jsonb := '{}'::jsonb;
  v_determ  jsonb := '{}'::jsonb;

  v_tmp     jsonb;
  v_tmp2    jsonb;
  v_ok      boolean := true;
  v_bool    boolean;
  v_rec     record;
  v_err_state text;
  v_err_msg   text;

  v_view_names  text[] := ARRAY[
    'v_project_economic_snapshot',
    'v_org_margin_performance',
    'v_project_labor_burn_index',
    'v_project_margin_projection'
  ];
  v_func_names  text[] := ARRAY[
    'rpc_generate_project_margin_control',
    'rpc_get_operating_system_score',
    'rpc_get_executive_dashboard'
  ];
  v_name text;
BEGIN
  -- ── 0. Resolve IDs deterministically ──
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'skipped', true, 'reason', 'no_authenticated_user');
  END IF;

  IF v_project_id IS NULL THEN
    -- Find first accessible project: project whose org the caller is a member of
    SELECT p.id, p.organization_id
      INTO v_project_id, v_org_id
      FROM projects p
     WHERE public.rpc_is_org_member(p.organization_id)
     ORDER BY p.id ASC
     LIMIT 1;
  ELSE
    -- Resolve org from project
    SELECT p.organization_id INTO v_org_id
      FROM projects p WHERE p.id = v_project_id;

    IF v_org_id IS NULL OR NOT public.rpc_is_org_member(v_org_id) THEN
      RETURN jsonb_build_object('ok', false, 'skipped', true, 'reason', 'not_authorized_for_project');
    END IF;
  END IF;

  IF v_org_id IS NULL THEN
    -- Find first org the caller is a member of
    SELECT om.organization_id INTO v_org_id
      FROM organization_memberships om
     WHERE om.user_id = v_uid AND om.is_active = true
     ORDER BY om.organization_id ASC
     LIMIT 1;
  ELSE
    IF NOT public.rpc_is_org_member(v_org_id) THEN
      RETURN jsonb_build_object('ok', false, 'skipped', true, 'reason', 'not_authorized_for_org');
    END IF;
  END IF;

  IF v_project_id IS NULL AND v_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'skipped', true, 'reason', 'no_accessible_project_or_org');
  END IF;

  -- ── A. Existence ──
  FOREACH v_name IN ARRAY v_view_names LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v_name AND c.relkind IN ('v','m')
    ) INTO v_bool;
    v_views := v_views || jsonb_build_object(v_name, v_bool);
    IF NOT v_bool THEN v_ok := false; END IF;
  END LOOP;

  FOREACH v_name IN ARRAY v_func_names LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_name
    ) INTO v_bool;
    v_funcs := v_funcs || jsonb_build_object(v_name, v_bool);
    IF NOT v_bool THEN v_ok := false; END IF;
  END LOOP;

  -- ── B. Security ──
  FOREACH v_name IN ARRAY v_func_names LOOP
    SELECT INTO v_rec
      p.prosecdef,
      p.proconfig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_name
    LIMIT 1;

    IF v_rec IS NULL THEN
      v_sec := v_sec || jsonb_build_object(v_name, jsonb_build_object(
        'security_definer', false, 'search_path_pinned', false
      ));
      v_ok := false;
    ELSE
      v_bool := COALESCE(v_rec.prosecdef, false);
      IF NOT v_bool THEN v_ok := false; END IF;

      DECLARE
        v_pinned boolean := false;
        v_cfg text;
      BEGIN
        IF v_rec.proconfig IS NOT NULL THEN
          FOREACH v_cfg IN ARRAY v_rec.proconfig LOOP
            IF v_cfg ILIKE 'search_path=%' THEN v_pinned := true; END IF;
          END LOOP;
        END IF;
        IF NOT v_pinned THEN v_ok := false; END IF;
        v_sec := v_sec || jsonb_build_object(v_name, jsonb_build_object(
          'security_definer', v_bool,
          'search_path_pinned', v_pinned
        ));
      END;
    END IF;
  END LOOP;

  -- ── C. Privileges ──
  FOREACH v_name IN ARRAY v_func_names LOOP
    DECLARE
      v_pub_can  boolean := false;
      v_anon_can boolean := false;
      v_auth_can boolean := false;
      v_oid oid;
    BEGIN
      SELECT p.oid INTO v_oid
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = v_name
       LIMIT 1;

      IF v_oid IS NOT NULL THEN
        v_pub_can  := has_function_privilege('public', v_oid, 'EXECUTE');
        v_anon_can := has_function_privilege('anon', v_oid, 'EXECUTE');
        v_auth_can := has_function_privilege('authenticated', v_oid, 'EXECUTE');
      END IF;

      IF v_pub_can OR v_anon_can THEN v_ok := false; END IF;

      v_priv := v_priv || jsonb_build_object(v_name, jsonb_build_object(
        'anon_can_execute', v_anon_can,
        'authenticated_can_execute', v_auth_can,
        'public_can_execute', v_pub_can
      ));
    END;
  END LOOP;

  -- ── D. Smoke Tests (enhanced error detail) ──
  -- rpc_generate_project_margin_control
  IF v_project_id IS NOT NULL THEN
    BEGIN
      v_tmp := public.rpc_generate_project_margin_control(v_project_id);
      v_smoke := v_smoke || jsonb_build_object('rpc_generate_project_margin_control', jsonb_build_object('success', true));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      v_smoke := v_smoke || jsonb_build_object('rpc_generate_project_margin_control', jsonb_build_object(
        'success', false,
        'sqlstate', v_err_state,
        'message_text', v_err_msg,
        'which_rpc_failed', 'rpc_generate_project_margin_control'
      ));
      v_ok := false;
    END;
  ELSE
    v_smoke := v_smoke || jsonb_build_object('rpc_generate_project_margin_control', jsonb_build_object(
      'success', false, 'message_text', 'no_project_id', 'which_rpc_failed', 'rpc_generate_project_margin_control'
    ));
    v_ok := false;
  END IF;

  -- rpc_get_operating_system_score
  IF v_org_id IS NOT NULL THEN
    BEGIN
      v_tmp := public.rpc_get_operating_system_score(v_org_id);
      v_smoke := v_smoke || jsonb_build_object('rpc_get_operating_system_score', jsonb_build_object('success', true));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      v_smoke := v_smoke || jsonb_build_object('rpc_get_operating_system_score', jsonb_build_object(
        'success', false,
        'sqlstate', v_err_state,
        'message_text', v_err_msg,
        'which_rpc_failed', 'rpc_get_operating_system_score'
      ));
      v_ok := false;
    END;
  ELSE
    v_smoke := v_smoke || jsonb_build_object('rpc_get_operating_system_score', jsonb_build_object(
      'success', false, 'message_text', 'no_org_id', 'which_rpc_failed', 'rpc_get_operating_system_score'
    ));
    v_ok := false;
  END IF;

  -- rpc_get_executive_dashboard
  IF v_org_id IS NOT NULL THEN
    BEGIN
      v_tmp := public.rpc_get_executive_dashboard(v_org_id);
      v_smoke := v_smoke || jsonb_build_object('rpc_get_executive_dashboard', jsonb_build_object('success', true));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      v_smoke := v_smoke || jsonb_build_object('rpc_get_executive_dashboard', jsonb_build_object(
        'success', false,
        'sqlstate', v_err_state,
        'message_text', v_err_msg,
        'which_rpc_failed', 'rpc_get_executive_dashboard'
      ));
      v_ok := false;
    END;
  ELSE
    v_smoke := v_smoke || jsonb_build_object('rpc_get_executive_dashboard', jsonb_build_object(
      'success', false, 'message_text', 'no_org_id', 'which_rpc_failed', 'rpc_get_executive_dashboard'
    ));
    v_ok := false;
  END IF;

  -- ── E. Determinism Tests (enhanced: include outputs on mismatch) ──
  -- margin control
  IF v_project_id IS NOT NULL THEN
    BEGIN
      v_tmp  := public.rpc_generate_project_margin_control(v_project_id);
      v_tmp2 := public.rpc_generate_project_margin_control(v_project_id);
      v_bool := (v_tmp = v_tmp2);
      IF v_bool THEN
        v_determ := v_determ || jsonb_build_object('project_margin_control_identical', true);
      ELSE
        v_determ := v_determ || jsonb_build_object('project_margin_control_identical', false,
          'project_margin_control_call_1', v_tmp,
          'project_margin_control_call_2', v_tmp2
        );
        v_ok := false;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      v_determ := v_determ || jsonb_build_object(
        'project_margin_control_identical', false,
        'project_margin_control_error', jsonb_build_object('sqlstate', v_err_state, 'message_text', v_err_msg)
      );
      v_ok := false;
    END;
  ELSE
    v_determ := v_determ || jsonb_build_object('project_margin_control_identical', false);
    v_ok := false;
  END IF;

  -- os score
  IF v_org_id IS NOT NULL THEN
    BEGIN
      v_tmp  := public.rpc_get_operating_system_score(v_org_id);
      v_tmp2 := public.rpc_get_operating_system_score(v_org_id);
      v_bool := (v_tmp = v_tmp2);
      IF v_bool THEN
        v_determ := v_determ || jsonb_build_object('operating_system_score_identical', true);
      ELSE
        v_determ := v_determ || jsonb_build_object('operating_system_score_identical', false,
          'operating_system_score_call_1', v_tmp,
          'operating_system_score_call_2', v_tmp2
        );
        v_ok := false;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      v_determ := v_determ || jsonb_build_object(
        'operating_system_score_identical', false,
        'operating_system_score_error', jsonb_build_object('sqlstate', v_err_state, 'message_text', v_err_msg)
      );
      v_ok := false;
    END;
  ELSE
    v_determ := v_determ || jsonb_build_object('operating_system_score_identical', false);
    v_ok := false;
  END IF;

  -- ── Final return ──
  RETURN jsonb_build_object(
    'determinism', v_determ,
    'existence', jsonb_build_object('functions', v_funcs, 'views', v_views),
    'ok', v_ok,
    'org_id', v_org_id,
    'privileges', v_priv,
    'project_id', v_project_id,
    'security', v_sec,
    'smoke', v_smoke
  );
END;
$$;
