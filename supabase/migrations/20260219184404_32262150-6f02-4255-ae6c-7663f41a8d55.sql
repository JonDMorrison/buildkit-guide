
-- ================================================================
-- public.rpc_get_os_system_inventory()  v1.0.1
--
-- Changes vs v1.0.0:
--   • Sec 1:  Canonical engine list (rpc_whoami added; extras removed)
--   • Sec 2:  Hardened dep scan — dual-form match + match snippets (max 3)
--   • Sec 3:  Unchanged
--   • Sec 4:  Added 'flags' + 'flag_count' canonical aliases
--   • Sec 5:  Verbose suspects: [{function_name, issue, hit_count}]
--   • Sec 6:  Fixed — requires exists AND granted_to_authenticated
--   • Top:    inventory_version → "v1.0.1"
-- ================================================================

CREATE OR REPLACE FUNCTION public.rpc_get_os_system_inventory()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- ── Section 1 ─────────────────────────────────────────────────
  v_engine_names       text[] := ARRAY[
    'rpc_generate_project_margin_control',
    'rpc_get_operating_system_score',
    'rpc_get_executive_risk_summary',
    'rpc_get_executive_dashboard',
    'rpc_get_project_action_panel',
    'rpc_get_project_workflow',
    'rpc_run_ai_brain_test_runner',
    'rpc_run_ai_brain_scenario_suite',
    'rpc_run_audit_suite',
    'rpc_whoami'
  ];
  v_engine_name        text;
  v_core_engines       jsonb    := '{}'::jsonb;
  v_proc_oid           oid;
  v_sec_def            boolean;
  v_pinned_path        boolean;
  v_granted_auth       boolean;
  v_proc_exists        boolean;

  -- ── Section 2 ─────────────────────────────────────────────────
  v_caller_names       text[] := ARRAY[
    'rpc_get_executive_risk_summary',
    'rpc_get_executive_dashboard',
    'rpc_get_project_action_panel'
  ];
  v_caller             text;
  v_exec_deps          jsonb    := '{}'::jsonb;
  v_func_def           text;
  v_calls_margin       boolean;
  v_calls_os           boolean;
  v_margin_hits        jsonb;
  v_os_hits            jsonb;
  v_fn_lower           text;

  -- ── Section 3 ─────────────────────────────────────────────────
  v_wf_def             text;
  v_has_econ_preview   boolean;
  v_threshold_val      text;
  v_workflow_info      jsonb;

  -- ── Section 4 ─────────────────────────────────────────────────
  v_proj_id            uuid;
  v_margin_res         jsonb;
  v_all_flags          text[]   := ARRAY[]::text[];
  v_distinct_flags     jsonb;
  v_flag_audit         jsonb;
  v_total_proj_count   bigint;

  -- ── Section 5 ─────────────────────────────────────────────────
  v_fn_name            text;
  v_fn_def             text;
  v_fn_oid             oid;
  v_suspect_funcs      jsonb    := '[]'::jsonb;
  v_violation_count    int      := 0;
  v_jsonb_count        int;
  v_jsonb_order_count  int;
  v_array_count        int;
  v_array_order_count  int;
  v_limit_count        int;
  v_order_count        int;
  v_det_scan           jsonb;

  -- ── Section 6 ─────────────────────────────────────────────────
  v_surface            jsonb;
  v_exec_present       boolean;
  v_pm_present         boolean;
  v_wf_present         boolean;
  v_diag_present       boolean;
  v_scenario_present   boolean;
BEGIN

  -- ════════════════════════════════════════════════════════════════
  -- SECTION 1: Core Engine Inventory
  -- ════════════════════════════════════════════════════════════════

  FOREACH v_engine_name IN ARRAY v_engine_names LOOP
    v_proc_oid     := NULL;
    v_sec_def      := false;
    v_pinned_path  := false;
    v_granted_auth := false;
    v_proc_exists  := false;

    SELECT p.oid,
           p.prosecdef,
           (p.proconfig IS NOT NULL AND EXISTS (
             SELECT 1 FROM unnest(p.proconfig) AS cfg
             WHERE cfg ILIKE 'search_path=%'
           ))
      INTO v_proc_oid, v_sec_def, v_pinned_path
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = v_engine_name
     ORDER BY p.oid ASC
     LIMIT 1;

    IF FOUND THEN
      v_proc_exists := true;
      BEGIN
        v_granted_auth := has_function_privilege('authenticated', v_proc_oid, 'EXECUTE');
      EXCEPTION WHEN OTHERS THEN
        v_granted_auth := false;
      END;
    END IF;

    v_core_engines := v_core_engines || jsonb_build_object(
      v_engine_name, jsonb_build_object(
        'exists',                   v_proc_exists,
        'security_definer',         COALESCE(v_sec_def,      false),
        'pinned_search_path',       COALESCE(v_pinned_path,  false),
        'granted_to_authenticated', COALESCE(v_granted_auth, false)
      )
    );
  END LOOP;

  -- ════════════════════════════════════════════════════════════════
  -- SECTION 2: Executive Layer Dependencies (v1.0.1 hardened)
  --   Dual-form match: bare name AND public.name.
  --   Returns up to 3 match snippets (80-char window) per target.
  -- ════════════════════════════════════════════════════════════════

  FOREACH v_caller IN ARRAY v_caller_names LOOP
    v_func_def     := NULL;
    v_calls_margin := false;
    v_calls_os     := false;
    v_margin_hits  := '[]'::jsonb;
    v_os_hits      := '[]'::jsonb;

    SELECT pg_get_functiondef(p.oid)
      INTO v_func_def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = v_caller
     ORDER BY p.oid ASC
     LIMIT 1;

    IF FOUND AND v_func_def IS NOT NULL THEN
      v_fn_lower := LOWER(v_func_def);

      -- margin_control: dual-form boolean
      v_calls_margin := (
        v_fn_lower LIKE '%rpc_generate_project_margin_control%'
        OR v_fn_lower LIKE '%public.rpc_generate_project_margin_control%'
      );

      -- margin_control: collect snippets (max 3, deduplicated, sorted)
      SELECT COALESCE(
               jsonb_agg(snippet ORDER BY snippet ASC) FILTER (WHERE snippet IS NOT NULL),
               '[]'::jsonb
             )
        INTO v_margin_hits
        FROM (
          SELECT DISTINCT
                 substring(v_func_def
                   FROM GREATEST(1, position(m[1] IN v_fn_lower) - 20)
                   FOR 80
                 ) AS snippet
            FROM regexp_matches(
                   v_fn_lower,
                   '(public\.rpc_generate_project_margin_control|rpc_generate_project_margin_control)',
                   'g'
                 ) AS m
           LIMIT 3
        ) hits;

      -- os_score: dual-form boolean
      v_calls_os := (
        v_fn_lower LIKE '%rpc_get_operating_system_score%'
        OR v_fn_lower LIKE '%public.rpc_get_operating_system_score%'
      );

      -- os_score: collect snippets (max 3, deduplicated, sorted)
      SELECT COALESCE(
               jsonb_agg(snippet ORDER BY snippet ASC) FILTER (WHERE snippet IS NOT NULL),
               '[]'::jsonb
             )
        INTO v_os_hits
        FROM (
          SELECT DISTINCT
                 substring(v_func_def
                   FROM GREATEST(1, position(m[1] IN v_fn_lower) - 20)
                   FOR 80
                 ) AS snippet
            FROM regexp_matches(
                   v_fn_lower,
                   '(public\.rpc_get_operating_system_score|rpc_get_operating_system_score)',
                   'g'
                 ) AS m
           LIMIT 3
        ) hits;

    END IF;

    v_exec_deps := v_exec_deps || jsonb_build_object(
      v_caller, jsonb_build_object(
        'calls_margin_control', v_calls_margin,
        'calls_os_score',       v_calls_os,
        'matches', jsonb_build_object(
          'margin_control_hits', v_margin_hits,
          'os_score_hits',       v_os_hits
        )
      )
    );
  END LOOP;

  -- ════════════════════════════════════════════════════════════════
  -- SECTION 3: Workflow Injection Layer (unchanged)
  -- ════════════════════════════════════════════════════════════════

  v_wf_def           := NULL;
  v_has_econ_preview := false;
  v_threshold_val    := 'unknown';

  SELECT pg_get_functiondef(p.oid)
    INTO v_wf_def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'rpc_get_project_workflow'
   ORDER BY p.oid ASC
   LIMIT 1;

  IF FOUND AND v_wf_def IS NOT NULL THEN
    v_has_econ_preview := (LOWER(v_wf_def) LIKE '%economic_requirements_preview%');
    v_threshold_val := COALESCE(
      (regexp_match(v_wf_def, '(?:>=?|<=?)\s*(\d+)'))[1],
      'unknown'
    );
  END IF;

  v_workflow_info := jsonb_build_object(
    'function_exists',                       (v_wf_def IS NOT NULL),
    'returns_economic_requirements_preview', v_has_econ_preview,
    'injection_threshold_parsed',            v_threshold_val
  );

  -- ════════════════════════════════════════════════════════════════
  -- SECTION 4: Flag Canonicalization Audit (v1.0.1)
  --   Adds canonical 'flags' + 'flag_count' aliases.
  -- ════════════════════════════════════════════════════════════════

  SELECT COUNT(*) INTO v_total_proj_count FROM public.projects;

  FOR v_proj_id IN
    SELECT id FROM public.projects ORDER BY id ASC LIMIT 50
  LOOP
    BEGIN
      v_margin_res := public.rpc_generate_project_margin_control(v_proj_id);
      SELECT v_all_flags || COALESCE(
               array_agg(f ORDER BY f ASC),
               ARRAY[]::text[]
             )
        INTO v_all_flags
        FROM jsonb_array_elements_text(
          COALESCE(v_margin_res -> 'intervention_flags', '[]'::jsonb)
        ) AS f;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  SELECT COALESCE(jsonb_agg(f ORDER BY f ASC), '[]'::jsonb)
    INTO v_distinct_flags
    FROM (SELECT DISTINCT f FROM unnest(v_all_flags) AS f) sub;

  v_flag_audit := jsonb_build_object(
    'total_projects_in_org', v_total_proj_count,
    'sample_size',           LEAST(50, v_total_proj_count),
    'flags',                 v_distinct_flags,
    'flag_count',            jsonb_array_length(v_distinct_flags),
    'distinct_flags',        v_distinct_flags,
    'distinct_flag_count',   jsonb_array_length(v_distinct_flags)
  );

  -- ════════════════════════════════════════════════════════════════
  -- SECTION 5: Aggregation Determinism Scan (v1.0.1 verbose)
  --   One entry per violation type per function:
  --   { function_name, issue, hit_count }
  -- ════════════════════════════════════════════════════════════════

  FOR v_fn_oid, v_fn_name IN
    SELECT p.oid, p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
     ORDER BY p.proname ASC, p.oid ASC
  LOOP
    BEGIN
      v_fn_def := pg_get_functiondef(v_fn_oid);
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    IF v_fn_def IS NULL THEN CONTINUE; END IF;

    SELECT COUNT(*) INTO v_jsonb_count
      FROM regexp_matches(v_fn_def, 'jsonb_agg\s*\(', 'gi');

    SELECT COUNT(*) INTO v_jsonb_order_count
      FROM regexp_matches(v_fn_def, 'jsonb_agg\s*\([\s\S]{0,500}?ORDER\s+BY', 'gi');

    SELECT COUNT(*) INTO v_array_count
      FROM regexp_matches(v_fn_def, 'array_agg\s*\(', 'gi');

    SELECT COUNT(*) INTO v_array_order_count
      FROM regexp_matches(v_fn_def, 'array_agg\s*\([\s\S]{0,500}?ORDER\s+BY', 'gi');

    SELECT COUNT(*) INTO v_limit_count
      FROM regexp_matches(v_fn_def, '\mLIMIT\M', 'gi');

    SELECT COUNT(*) INTO v_order_count
      FROM regexp_matches(v_fn_def, '\mORDER\M\s+\mBY\M', 'gi');

    IF v_jsonb_count > v_jsonb_order_count THEN
      v_violation_count := v_violation_count + (v_jsonb_count - v_jsonb_order_count);
      v_suspect_funcs := v_suspect_funcs || jsonb_build_array(
        jsonb_build_object(
          'function_name', v_fn_name,
          'issue',         'jsonb_agg_without_order_by',
          'hit_count',     (v_jsonb_count - v_jsonb_order_count)
        )
      );
    END IF;

    IF v_array_count > v_array_order_count THEN
      v_violation_count := v_violation_count + (v_array_count - v_array_order_count);
      v_suspect_funcs := v_suspect_funcs || jsonb_build_array(
        jsonb_build_object(
          'function_name', v_fn_name,
          'issue',         'array_agg_without_order_by',
          'hit_count',     (v_array_count - v_array_order_count)
        )
      );
    END IF;

    IF v_limit_count > 0 AND v_order_count = 0 THEN
      v_violation_count := v_violation_count + 1;
      v_suspect_funcs := v_suspect_funcs || jsonb_build_array(
        jsonb_build_object(
          'function_name', v_fn_name,
          'issue',         'limit_without_order_by',
          'hit_count',     v_limit_count
        )
      );
    END IF;

  END LOOP;

  v_det_scan := jsonb_build_object(
    'suspect_functions',  v_suspect_funcs,
    'violation_count',    v_violation_count,
    'note', 'Heuristic scan. Nested parens, CTEs, and string literals may produce false positives.'
  );

  -- ════════════════════════════════════════════════════════════════
  -- SECTION 6: Executive Surface Summary (v1.0.1 fixed)
  --   Requires BOTH exists=true AND granted_to_authenticated=true.
  -- ════════════════════════════════════════════════════════════════

  v_exec_present := (
    COALESCE((v_core_engines -> 'rpc_get_executive_risk_summary' ->> 'exists')::boolean, false)
    AND COALESCE((v_core_engines -> 'rpc_get_executive_risk_summary' ->> 'granted_to_authenticated')::boolean, false)
  );

  v_pm_present := (
    COALESCE((v_core_engines -> 'rpc_get_project_action_panel' ->> 'exists')::boolean, false)
    AND COALESCE((v_core_engines -> 'rpc_get_project_action_panel' ->> 'granted_to_authenticated')::boolean, false)
  );

  v_wf_present := (
    COALESCE((v_core_engines -> 'rpc_get_project_workflow' ->> 'exists')::boolean, false)
    AND COALESCE((v_core_engines -> 'rpc_get_project_workflow' ->> 'granted_to_authenticated')::boolean, false)
  );

  v_diag_present := (
    COALESCE((v_core_engines -> 'rpc_whoami' ->> 'exists')::boolean, false)
    AND COALESCE((v_core_engines -> 'rpc_whoami' ->> 'granted_to_authenticated')::boolean, false)
    AND COALESCE((v_core_engines -> 'rpc_run_ai_brain_test_runner' ->> 'exists')::boolean, false)
    AND COALESCE((v_core_engines -> 'rpc_run_ai_brain_test_runner' ->> 'granted_to_authenticated')::boolean, false)
  );

  v_scenario_present := (
    COALESCE((v_core_engines -> 'rpc_run_ai_brain_scenario_suite' ->> 'exists')::boolean, false)
    AND COALESCE((v_core_engines -> 'rpc_run_ai_brain_scenario_suite' ->> 'granted_to_authenticated')::boolean, false)
  );

  v_surface := jsonb_build_object(
    'executive_layer_present',    v_exec_present,
    'pm_action_layer_present',    v_pm_present,
    'workflow_injection_present', v_wf_present,
    'diagnostics_present',        v_diag_present,
    'scenario_suite_present',     v_scenario_present
  );

  -- ════════════════════════════════════════════════════════════════
  -- RETURN
  -- ════════════════════════════════════════════════════════════════

  RETURN jsonb_build_object(
    'inventory_version',              'v1.0.1',
    'core_engines',                   v_core_engines,
    'executive_layer_dependencies',   v_exec_deps,
    'workflow_injection_layer',       v_workflow_info,
    'flag_canonicalization_audit',    v_flag_audit,
    'aggregation_determinism_scan',   v_det_scan,
    'executive_surface_summary',      v_surface
  );
END;
$$;

-- ── Grants ────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.rpc_get_os_system_inventory() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_get_os_system_inventory() FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_os_system_inventory() TO authenticated;

COMMENT ON FUNCTION public.rpc_get_os_system_inventory() IS
  'OS system inventory. SECURITY DEFINER. v1.0.1. '
  'Sections: core_engines (10 engines), executive_layer_dependencies (dual-form + snippets), '
  'workflow_injection_layer, flag_canonicalization_audit (flags + flag_count), '
  'aggregation_determinism_scan (verbose per-violation entries), '
  'executive_surface_summary (exists AND granted). '
  'No writes. Authenticated only.';
