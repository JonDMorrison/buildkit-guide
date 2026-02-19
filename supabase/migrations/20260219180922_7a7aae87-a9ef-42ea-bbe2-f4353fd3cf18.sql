
-- ================================================================
-- public.rpc_get_os_system_inventory()  v1.0.0
--
-- System inventory RPC. SECURITY DEFINER, VOLATILE, no writes.
-- Sections:
--   1. Core Engine existence + security properties
--   2. Executive layer dependency detection (pg_get_functiondef scan)
--   3. Workflow injection layer check
--   4. Flag canonicalization audit (sample ≤50 projects, ORDER BY id ASC)
--   5. Aggregation determinism scan (heuristic, report-only)
--   6. Executive surface boolean summary
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
    'rpc_get_executive_dashboard',
    'rpc_get_executive_risk_summary',
    'rpc_get_project_action_panel',
    'rpc_get_project_workflow',
    'rpc_run_ai_brain_test_runner',
    'rpc_run_ai_brain_scenario_suite',
    'rpc_run_margin_control_edge_cases',
    'rpc_run_audit_suite',
    'rpc_exec_engine'
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
    'rpc_get_executive_dashboard',
    'rpc_get_executive_risk_summary',
    'rpc_get_project_action_panel'
  ];
  v_caller             text;
  v_exec_deps          jsonb    := '{}'::jsonb;
  v_func_def           text;
  v_calls_margin       boolean;
  v_calls_os           boolean;

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
  v_violations         int;
  v_det_scan           jsonb;

  -- ── Section 6 ─────────────────────────────────────────────────
  v_surface            jsonb;
BEGIN

  -- ════════════════════════════════════════════════════════════════
  -- SECTION 1: Core Engine Inventory
  --   For each named function: exists, security_definer,
  --   pinned_search_path, granted_to_authenticated.
  --   Uses pg_proc + pg_namespace. LIMIT 1 handles overloads.
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
     ORDER BY p.oid ASC   -- deterministic when multiple overloads exist
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
  -- SECTION 2: Executive Layer Dependencies
  --   For each executive/pm-layer caller: does its body text
  --   reference rpc_generate_project_margin_control or
  --   rpc_get_operating_system_score?
  --   Detection via pg_get_functiondef ILIKE text search.
  -- ════════════════════════════════════════════════════════════════

  FOREACH v_caller IN ARRAY v_caller_names LOOP
    v_func_def     := NULL;
    v_calls_margin := false;
    v_calls_os     := false;

    SELECT pg_get_functiondef(p.oid)
      INTO v_func_def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = v_caller
     ORDER BY p.oid ASC
     LIMIT 1;

    IF FOUND AND v_func_def IS NOT NULL THEN
      v_calls_margin := (LOWER(v_func_def) LIKE '%rpc_generate_project_margin_control%');
      v_calls_os     := (LOWER(v_func_def) LIKE '%rpc_get_operating_system_score%');
    END IF;

    v_exec_deps := v_exec_deps || jsonb_build_object(
      v_caller, jsonb_build_object(
        'calls_margin_control', v_calls_margin,
        'calls_os_score',       v_calls_os
      )
    );
  END LOOP;

  -- ════════════════════════════════════════════════════════════════
  -- SECTION 3: Workflow Injection Layer
  --   Confirm rpc_get_project_workflow returns
  --   economic_requirements_preview, and attempt to parse the
  --   numeric threshold used for injection.
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
    -- Parse first numeric threshold from a comparison operator
    -- (e.g. "> 70", ">= 60"). Returns NULL if not found → 'unknown'.
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
  -- SECTION 4: Flag Canonicalization Audit
  --   Sample first 50 projects (ORDER BY id ASC — deterministic).
  --   Call margin control engine for each; collect all emitted flags.
  --   Return deduplicated sorted list. Reveals vocabulary drift.
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
      NULL; -- skip; do not abort the inventory
    END;
  END LOOP;

  -- Deduplicate + sort
  SELECT COALESCE(jsonb_agg(f ORDER BY f ASC), '[]'::jsonb)
    INTO v_distinct_flags
    FROM (SELECT DISTINCT f FROM unnest(v_all_flags) AS f) sub;

  v_flag_audit := jsonb_build_object(
    'total_projects_in_org', v_total_proj_count,
    'sample_size',           LEAST(50, v_total_proj_count),
    'distinct_flags',        v_distinct_flags,
    'distinct_flag_count',   jsonb_array_length(v_distinct_flags)
  );

  -- ════════════════════════════════════════════════════════════════
  -- SECTION 5: Aggregation Determinism Scan
  --   Scans pg_get_functiondef text for all public-schema functions.
  --   Heuristics:
  --     • jsonb_agg without nearby ORDER BY  → unordered_jsonb_agg
  --     • array_agg without nearby ORDER BY  → unordered_array_agg
  --     • LIMIT with no ORDER BY anywhere    → limit_without_order_by
  --   "Nearby" = within 500 chars in the function source (covers
  --   most real call patterns; nested parens/strings may skew count).
  --   Reports only; does not block or alter anything.
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

    -- Count jsonb_agg calls
    SELECT COUNT(*) INTO v_jsonb_count
      FROM regexp_matches(v_fn_def, 'jsonb_agg\s*\(', 'gi');

    -- Count jsonb_agg calls with ORDER BY within 500 chars (cross-newline via [\s\S])
    SELECT COUNT(*) INTO v_jsonb_order_count
      FROM regexp_matches(v_fn_def, 'jsonb_agg\s*\([\s\S]{0,500}?ORDER\s+BY', 'gi');

    -- Count array_agg calls
    SELECT COUNT(*) INTO v_array_count
      FROM regexp_matches(v_fn_def, 'array_agg\s*\(', 'gi');

    -- Count array_agg calls with ORDER BY within 500 chars
    SELECT COUNT(*) INTO v_array_order_count
      FROM regexp_matches(v_fn_def, 'array_agg\s*\([\s\S]{0,500}?ORDER\s+BY', 'gi');

    -- Count LIMIT and ORDER BY occurrences
    SELECT COUNT(*) INTO v_limit_count
      FROM regexp_matches(v_fn_def, '\mLIMIT\M', 'gi');

    SELECT COUNT(*) INTO v_order_count
      FROM regexp_matches(v_fn_def, '\mORDER\M\s+\mBY\M', 'gi');

    v_violations := 0;

    IF v_jsonb_count > v_jsonb_order_count THEN
      v_violations := v_violations + (v_jsonb_count - v_jsonb_order_count);
    END IF;
    IF v_array_count > v_array_order_count THEN
      v_violations := v_violations + (v_array_count - v_array_order_count);
    END IF;
    IF v_limit_count > 0 AND v_order_count = 0 THEN
      v_violations := v_violations + 1;
    END IF;

    IF v_violations > 0 THEN
      v_violation_count := v_violation_count + v_violations;
      v_suspect_funcs := v_suspect_funcs || jsonb_build_array(
        jsonb_build_object(
          'function',               v_fn_name,
          'unordered_jsonb_agg',    GREATEST(0, v_jsonb_count    - v_jsonb_order_count),
          'unordered_array_agg',    GREATEST(0, v_array_count    - v_array_order_count),
          'limit_without_order_by', CASE WHEN v_limit_count > 0 AND v_order_count = 0
                                         THEN v_limit_count ELSE 0 END
        )
      );
    END IF;
  END LOOP;

  v_det_scan := jsonb_build_object(
    'suspect_functions',     v_suspect_funcs,
    'total_violation_count', v_violation_count,
    'note', 'Heuristic scan. Nested parens, CTEs, and string literals may produce false positives.'
  );

  -- ════════════════════════════════════════════════════════════════
  -- SECTION 6: Executive Surface Boolean Summary
  --   Derived entirely from section 1 existence checks.
  -- ════════════════════════════════════════════════════════════════

  v_surface := jsonb_build_object(
    'executive_layer_present',    COALESCE((v_core_engines -> 'rpc_get_executive_risk_summary' ->> 'exists')::boolean,       false),
    'pm_action_layer_present',    COALESCE((v_core_engines -> 'rpc_get_project_action_panel'  ->> 'exists')::boolean,       false),
    'workflow_injection_present', COALESCE((v_core_engines -> 'rpc_get_project_workflow'       ->> 'exists')::boolean,       false),
    'diagnostics_present',        COALESCE((v_core_engines -> 'rpc_run_audit_suite'            ->> 'exists')::boolean,       false),
    'scenario_suite_present',     COALESCE((v_core_engines -> 'rpc_run_ai_brain_scenario_suite'->> 'exists')::boolean,       false)
  );

  -- ════════════════════════════════════════════════════════════════
  -- RETURN
  -- ════════════════════════════════════════════════════════════════

  RETURN jsonb_build_object(
    'inventory_version',              '1.0.0',
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
REVOKE ALL  ON FUNCTION public.rpc_get_os_system_inventory() FROM PUBLIC;
REVOKE ALL  ON FUNCTION public.rpc_get_os_system_inventory() FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_os_system_inventory() TO authenticated;

COMMENT ON FUNCTION public.rpc_get_os_system_inventory() IS
  'OS system inventory. SECURITY DEFINER. v1.0.0. '
  'Sections: core_engines, executive_layer_dependencies, '
  'workflow_injection_layer, flag_canonicalization_audit, '
  'aggregation_determinism_scan, executive_surface_summary. '
  'No writes. Authenticated only.';
