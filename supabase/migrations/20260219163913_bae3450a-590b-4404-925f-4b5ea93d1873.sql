
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

  -- Wrap all rpc_is_org_member calls to catch membership_table_not_found
  BEGIN
    IF v_project_id IS NULL THEN
      SELECT p.id, p.organization_id
        INTO v_project_id, v_org_id
        FROM projects p
       WHERE public.rpc_is_org_member(p.organization_id)
       ORDER BY p.id ASC
       LIMIT 1;
    ELSE
      SELECT p.organization_id INTO v_org_id
        FROM projects p WHERE p.id = v_project_id;

      IF v_org_id IS NULL OR NOT public.rpc_is_org_member(v_org_id) THEN
        RETURN jsonb_build_object('ok', false, 'skipped', true, 'reason', 'not_authorized_for_project');
      END IF;
    END IF;

    IF v_org_id IS NULL THEN
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
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
    IF v_err_msg = 'membership_table_not_found' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'critical_error', 'membership_table_not_found',
        'hint', 'Create or map membership checker to your existing membership table.'
      );
    END IF;
    -- Re-raise if it's a different error
    RAISE;
  END;

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
