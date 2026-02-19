
CREATE OR REPLACE FUNCTION public.rpc_verify_ai_brain_build(p_project_id uuid, p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exists_views jsonb := '{}'::jsonb;
  v_exists_funcs jsonb := '{}'::jsonb;
  v_security_def jsonb := '{}'::jsonb;
  v_security_sp  jsonb := '{}'::jsonb;
  v_priv_public  jsonb := '{}'::jsonb;
  v_priv_anon    jsonb := '{}'::jsonb;
  v_priv_auth    jsonb := '{}'::jsonb;
  v_smoke        jsonb := '{}'::jsonb;
  v_determinism  jsonb := '{}'::jsonb;
  v_found        boolean;
  v_oid          oid;
  v_secdef       boolean;
  v_config       text[];
  v_pinned       boolean;
  v_res1         jsonb;
  v_res2         jsonb;
  v_view_names   text[] := ARRAY['v_project_economic_snapshot','v_org_margin_performance','v_project_labor_burn_index','v_project_margin_projection'];
  v_func_names   text[] := ARRAY['rpc_generate_project_margin_control','rpc_get_operating_system_score','rpc_get_executive_dashboard'];
  v_name         text;
BEGIN
  -- Validate caller belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  -- A) View existence
  FOREACH v_name IN ARRAY v_view_names LOOP
    SELECT EXISTS(
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = v_name
    ) INTO v_found;
    v_exists_views := v_exists_views || jsonb_build_object(v_name, v_found);
  END LOOP;

  -- A) Function existence + B) Security + C) Privileges
  FOREACH v_name IN ARRAY v_func_names LOOP
    SELECT p.oid, p.prosecdef, p.proconfig
    INTO v_oid, v_secdef, v_config
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_name
    LIMIT 1;

    IF v_oid IS NULL THEN
      v_exists_funcs := v_exists_funcs || jsonb_build_object(v_name, false);
      v_security_def := v_security_def || jsonb_build_object(v_name, false);
      v_security_sp  := v_security_sp  || jsonb_build_object(v_name, false);
      v_priv_public  := v_priv_public  || jsonb_build_object(v_name, false);
      v_priv_anon    := v_priv_anon    || jsonb_build_object(v_name, false);
      v_priv_auth    := v_priv_auth    || jsonb_build_object(v_name, false);
    ELSE
      v_exists_funcs := v_exists_funcs || jsonb_build_object(v_name, true);
      v_security_def := v_security_def || jsonb_build_object(v_name, v_secdef);
      v_pinned := v_config IS NOT NULL AND EXISTS (
        SELECT 1 FROM unnest(v_config) c WHERE c ILIKE 'search_path=%public%'
      );
      v_security_sp := v_security_sp || jsonb_build_object(v_name, v_pinned);
      v_priv_public := v_priv_public || jsonb_build_object(v_name,
        has_function_privilege('public', v_oid, 'EXECUTE'));
      v_priv_anon := v_priv_anon || jsonb_build_object(v_name,
        has_function_privilege('anon', v_oid, 'EXECUTE'));
      v_priv_auth := v_priv_auth || jsonb_build_object(v_name,
        has_function_privilege('authenticated', v_oid, 'EXECUTE'));
    END IF;
    v_oid := NULL; v_secdef := NULL; v_config := NULL;
  END LOOP;

  -- D) Smoke tests
  BEGIN
    v_res1 := public.rpc_generate_project_margin_control(p_project_id);
    v_smoke := v_smoke || '{"project_margin_control_ok": true}'::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_smoke := v_smoke || '{"project_margin_control_ok": false}'::jsonb;
    v_res1 := NULL;
  END;

  BEGIN
    PERFORM public.rpc_get_operating_system_score(p_org_id);
    v_smoke := v_smoke || '{"org_score_ok": true}'::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_smoke := v_smoke || '{"org_score_ok": false}'::jsonb;
  END;

  BEGIN
    PERFORM public.rpc_get_executive_dashboard(p_org_id);
    v_smoke := v_smoke || '{"exec_dashboard_ok": true}'::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_smoke := v_smoke || '{"exec_dashboard_ok": false}'::jsonb;
  END;

  -- E) Determinism
  BEGIN
    v_res2 := public.rpc_generate_project_margin_control(p_project_id);
    v_determinism := jsonb_build_object(
      'project_margin_control_identical', v_res1 IS NOT NULL AND v_res1 = v_res2
    );
  EXCEPTION WHEN OTHERS THEN
    v_determinism := '{"project_margin_control_identical": false}'::jsonb;
  END;

  RETURN jsonb_build_object(
    'exists', jsonb_build_object('views', v_exists_views, 'functions', v_exists_funcs),
    'security', jsonb_build_object('security_definer', v_security_def, 'search_path_pinned', v_security_sp),
    'privileges', jsonb_build_object('public_execute', v_priv_public, 'anon_execute', v_priv_anon, 'authenticated_execute', v_priv_auth),
    'smoke_tests', v_smoke,
    'determinism', v_determinism
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_verify_ai_brain_build(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_verify_ai_brain_build(uuid, uuid) TO authenticated;
