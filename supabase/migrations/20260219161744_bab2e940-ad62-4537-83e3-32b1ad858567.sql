
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

  -- existence
  v_views   jsonb := '{}'::jsonb;
  v_funcs   jsonb := '{}'::jsonb;

  -- security
  v_sec     jsonb := '{}'::jsonb;

  -- privileges
  v_priv    jsonb := '{}'::jsonb;

  -- smoke
  v_smoke   jsonb := '{}'::jsonb;

  -- determinism
  v_determ  jsonb := '{}'::jsonb;

  -- helpers
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
    SELECT p.id, p.organization_id
      INTO v_project_id, v_org_id
      FROM projects p
      JOIN organization_memberships om
        ON om.organization_id = p.organization_id
       AND om.user_id = v_uid
     ORDER BY p.id ASC
     LIMIT 1;
  ELSE
    -- verify caller can access the supplied project
    IF NOT EXISTS (
      SELECT 1
        FROM projects p
        JOIN organization_memberships om
          ON om.organization_id = p.organization_id
         AND om.user_id = v_uid
       WHERE p.id = v_project_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'skipped', true, 'reason', 'not_authorized_for_project');
    END IF;
    IF v_org_id IS NULL THEN
      SELECT p.organization_id INTO v_org_id
        FROM projects p WHERE p.id = v_project_id;
    END IF;
  END IF;

  IF v_org_id IS NULL THEN
    SELECT om.organization_id INTO v_org_id
      FROM organization_memberships om
     WHERE om.user_id = v_uid
     ORDER BY om.organization_id ASC
     LIMIT 1;
  ELSE
    -- verify caller is member of org
    IF NOT EXISTS (
      SELECT 1 FROM organization_memberships om
       WHERE om.organization_id = v_org_id AND om.user_id = v_uid
    ) THEN
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
        'public_can_execute', v_pub_can,
        'anon_can_execute', v_anon_can,
        'authenticated_can_execute', v_auth_can
      ));
    END;
  END LOOP;

  -- ── D. Smoke Tests ──
  -- rpc_generate_project_margin_control
  IF v_project_id IS NOT NULL THEN
    BEGIN
      v_tmp := public.rpc_generate_project_margin_control(v_project_id);
      v_smoke := v_smoke || '{"rpc_generate_project_margin_control": {"success": true}}'::jsonb;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      v_smoke := v_smoke || jsonb_build_object('rpc_generate_project_margin_control', jsonb_build_object(
        'success', false, 'sqlstate', v_err_state, 'message', v_err_msg
      ));
      v_ok := false;
    END;
  ELSE
    v_smoke := v_smoke || '{"rpc_generate_project_margin_control": {"success": false, "message": "no_project_id"}}'::jsonb;
    v_ok := false;
  END IF;

  -- rpc_get_operating_system_score
  IF v_org_id IS NOT NULL THEN
    BEGIN
      v_tmp := public.rpc_get_operating_system_score(v_org_id);
      v_smoke := v_smoke || '{"rpc_get_operating_system_score": {"success": true}}'::jsonb;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      v_smoke := v_smoke || jsonb_build_object('rpc_get_operating_system_score', jsonb_build_object(
        'success', false, 'sqlstate', v_err_state, 'message', v_err_msg
      ));
      v_ok := false;
    END;
  ELSE
    v_smoke := v_smoke || '{"rpc_get_operating_system_score": {"success": false, "message": "no_org_id"}}'::jsonb;
    v_ok := false;
  END IF;

  -- rpc_get_executive_dashboard
  IF v_org_id IS NOT NULL THEN
    BEGIN
      v_tmp := public.rpc_get_executive_dashboard(v_org_id);
      v_smoke := v_smoke || '{"rpc_get_executive_dashboard": {"success": true}}'::jsonb;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      v_smoke := v_smoke || jsonb_build_object('rpc_get_executive_dashboard', jsonb_build_object(
        'success', false, 'sqlstate', v_err_state, 'message', v_err_msg
      ));
      v_ok := false;
    END;
  ELSE
    v_smoke := v_smoke || '{"rpc_get_executive_dashboard": {"success": false, "message": "no_org_id"}}'::jsonb;
    v_ok := false;
  END IF;

  -- ── E. Determinism Tests ──
  -- margin control
  IF v_project_id IS NOT NULL THEN
    BEGIN
      v_tmp  := public.rpc_generate_project_margin_control(v_project_id);
      v_tmp2 := public.rpc_generate_project_margin_control(v_project_id);
      v_bool := (v_tmp = v_tmp2);
      v_determ := v_determ || jsonb_build_object('project_margin_control_identical', v_bool);
      IF NOT v_bool THEN v_ok := false; END IF;
    EXCEPTION WHEN OTHERS THEN
      v_determ := v_determ || '{"project_margin_control_identical": false}'::jsonb;
      v_ok := false;
    END;
  ELSE
    v_determ := v_determ || '{"project_margin_control_identical": false}'::jsonb;
    v_ok := false;
  END IF;

  -- os score
  IF v_org_id IS NOT NULL THEN
    BEGIN
      v_tmp  := public.rpc_get_operating_system_score(v_org_id);
      v_tmp2 := public.rpc_get_operating_system_score(v_org_id);
      v_bool := (v_tmp = v_tmp2);
      v_determ := v_determ || jsonb_build_object('operating_system_score_identical', v_bool);
      IF NOT v_bool THEN v_ok := false; END IF;
    EXCEPTION WHEN OTHERS THEN
      v_determ := v_determ || '{"operating_system_score_identical": false}'::jsonb;
      v_ok := false;
    END;
  ELSE
    v_determ := v_determ || '{"operating_system_score_identical": false}'::jsonb;
    v_ok := false;
  END IF;

  -- ── Final return ──
  RETURN jsonb_build_object(
    'ok', v_ok,
    'project_id', v_project_id,
    'org_id', v_org_id,
    'existence', jsonb_build_object('views', v_views, 'functions', v_funcs),
    'security', v_sec,
    'privileges', v_priv,
    'smoke', v_smoke,
    'determinism', v_determ
  );
END;
$$;

-- Grants
REVOKE ALL ON FUNCTION public.rpc_run_ai_brain_test_runner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_run_ai_brain_test_runner(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_run_ai_brain_test_runner(uuid, uuid) TO authenticated;
