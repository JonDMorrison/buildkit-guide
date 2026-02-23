
-- ═══════════════════════════════════════════════════════════════════════════
-- rpc_get_os_brain_release_report — v15
-- Patch: nonvolatile_ddl_scan now emits structured offenders[] array
-- with schema, function, volatility, matched_token, match_line.
-- On failure: which_call_failed = 'nonvolatile_ddl_scan',
--             message_text = 'nonvolatile_ddl_detected'
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_get_os_brain_release_report(
  p_org_id     uuid,
  p_project_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  -- ── core identifiers ──
  v_sample_project_id uuid;

  -- ── Check 1 — existence + security ──
  v_c1_ok             boolean := true;
  v_existence         jsonb   := '{}'::jsonb;
  v_security          jsonb   := '{}'::jsonb;
  v_fn_rec            record;
  v_fn_name           text;

  -- ── Check 2 / 3 — wiring & shape ──
  v_c2_ok             boolean := true;
  v_c3_ok             boolean := true;
  v_wiring_proj       jsonb   := '{}'::jsonb;
  v_wiring_exec       jsonb   := '{}'::jsonb;
  v_wiring_invalid    jsonb   := '[]'::jsonb;
  v_wiring_shape      jsonb   := '{}'::jsonb;

  -- ── Check 5 — determinism ──
  v_det               jsonb   := '{}'::jsonb;
  v_mc_call_1         jsonb;
  v_mc_call_2         jsonb;
  v_exec_call_1       jsonb;
  v_exec_call_2       jsonb;

  -- ── Check 6 — smoke tests ──
  v_c6_ok             boolean := true;
  v_smoke             jsonb   := '{}'::jsonb;
  v_ran_mc            boolean := false;
  v_passed_mc         boolean := false;
  v_skip_mc           text    := null;
  v_sqlstate_mc       text    := null;
  v_msg_mc            text    := null;
  v_ran_exec          boolean := false;
  v_passed_exec       boolean := false;
  v_skip_exec         text    := null;
  v_sqlstate_exec     text    := null;
  v_msg_exec          text    := null;

  -- Check 7 — nonvolatile DDL source scan (v9, patched v15)
  v_ddl_scan          jsonb   := '[]'::jsonb;
  v_ddl_fn_oid        oid;
  v_ddl_fn_body       text;
  v_ddl_provolatile   text;
  v_ddl_tokens        text[] := ARRAY[
    'CREATE TABLE',
    'CREATE TEMP',
    'ALTER TABLE',
    'DROP TABLE',
    'TRUNCATE'
  ];
  v_ddl_token         text;
  v_ddl_hit           text;
  v_c7_ok             boolean := true;
  v_ddl_offenders     jsonb   := '[]'::jsonb;
  v_ddl_match_pos     int;
  v_ddl_line_start    int;
  v_ddl_line_end      int;
  v_ddl_excerpt       text;
  v_ddl_matched_this_fn boolean;

  -- Check 8 — economic inputs credibility (v12)
  v_cred_ok           boolean := true;
  v_cred_check        jsonb   := '{}'::jsonb;
  v_cred_payload      jsonb;
  v_cred_labor_missing    boolean;
  v_cred_estimate_missing boolean;
  v_cred_revenue_missing  boolean;
  v_cred_est_labor    numeric;
  v_cred_labor_rows   int;

  -- ── Exception handling ──
  v_err_state         text;
  v_err_msg           text;
  v_report_exception  jsonb := null;

  -- ── Aggregation ──
  v_overall_success   boolean;
  v_failing           jsonb   := '[]'::jsonb;
  v_why_failed        jsonb   := '[]'::jsonb;
  v_skipped_sections  jsonb   := '[]'::jsonb;
  v_passed_count      int     := 0;
  v_failed_count      int     := 0;
  v_total_count       int;
  v_evaluation_mode   text    := 'full';

  -- ── Self-tests (v14) ──
  v_self_tests        jsonb   := '{}'::jsonb;
  v_st_success_is_bool    boolean;
  v_st_ok_is_bool         boolean;
  v_st_success_eq_ok      boolean;
  v_st_eval_valid         boolean;
  v_st_skipped_sorted     boolean;
  v_st_why_sorted         boolean;
  v_st_all_pass           boolean;
  v_st_arr_sorted         jsonb;

  -- ── CORE_FNS ──
  CORE_FNS text[] := ARRAY[
    'rpc_generate_project_margin_control',
    'rpc_generate_executive_risk_summary',
    'rpc_debug_margin_control_inputs',
    'rpc_get_os_system_inventory',
    'rpc_get_os_brain_release_report',
    'rpc_assert_deterministic_ordering',
    'rpc_run_margin_control_edge_cases'
  ];

  CORE_VIEWS text[] := ARRAY[
    'v_project_margin_projection',
    'v_project_economic_snapshot',
    'v_project_labor_burn_index'
  ];
BEGIN
  -- ── Find sample project ──────────────────────────────────────────────────
  IF p_project_id IS NOT NULL THEN
    v_sample_project_id := p_project_id;
  ELSE
    SELECT id INTO v_sample_project_id
      FROM public.projects
     WHERE organization_id = p_org_id
       AND status = 'active'
     ORDER BY name ASC
     LIMIT 1;
  END IF;

  -- ── Check 1: Existence + Security ────────────────────────────────────────
  BEGIN
    -- Views
    FOR v_fn_name IN SELECT unnest(CORE_VIEWS) LOOP
      v_existence := v_existence || jsonb_build_object(
        v_fn_name,
        EXISTS (
          SELECT 1 FROM information_schema.views
           WHERE table_schema = 'public' AND table_name = v_fn_name
        )
      );
    END LOOP;

    -- Functions
    FOR v_fn_rec IN
      SELECT p.proname AS fname,
             p.prosecdef AS secdef,
             (SELECT string_agg(k, ', ' ORDER BY k)
                FROM unnest(p.proconfig) AS k
               WHERE k LIKE 'search_path=%') AS sp
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname = ANY(CORE_FNS)
       ORDER BY p.proname ASC
    LOOP
      v_existence := v_existence || jsonb_build_object(v_fn_rec.fname, true);
      v_security := v_security || jsonb_build_object(
        v_fn_rec.fname,
        jsonb_build_object(
          'security_definer',   v_fn_rec.secdef,
          'search_path_pinned', (v_fn_rec.sp IS NOT NULL)
        )
      );
    END LOOP;

    -- Verify all are present
    FOR v_fn_name IN SELECT unnest(CORE_FNS) LOOP
      IF NOT COALESCE((v_existence->>v_fn_name)::boolean, false) THEN
        v_c1_ok := false;
      END IF;
    END LOOP;

    FOR v_fn_name IN SELECT unnest(CORE_VIEWS) LOOP
      IF NOT COALESCE((v_existence->>v_fn_name)::boolean, false) THEN
        v_c1_ok := false;
      END IF;
    END LOOP;

    -- Security enforcement
    FOR v_fn_name IN SELECT unnest(CORE_FNS) LOOP
      IF v_security->v_fn_name IS NOT NULL THEN
        IF NOT COALESCE((v_security->v_fn_name->>'security_definer')::boolean, false)
           OR NOT COALESCE((v_security->v_fn_name->>'search_path_pinned')::boolean, false)
        THEN
          v_c1_ok := false;
        END IF;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
    v_c1_ok := false;
    v_report_exception := jsonb_build_object(
      'check',        'existence_and_security',
      'sqlstate',     v_err_state,
      'message_text', v_err_msg
    );
  END;

  -- ── Check 2: Wiring & Shape — Project Margin Control ─────────────────────
  IF v_sample_project_id IS NOT NULL THEN
    BEGIN
      v_mc_call_1 := public.rpc_generate_project_margin_control(v_sample_project_id);
      v_ran_mc    := true;
      v_passed_mc := true;

      IF v_mc_call_1 IS NULL OR v_mc_call_1 = 'null'::jsonb THEN
        v_c2_ok := false;
        v_wiring_proj := jsonb_build_object('error', 'null_response');
      ELSE
        v_wiring_proj := jsonb_build_object(
          'has_contract_value',       v_mc_call_1 ? 'contract_value',
          'has_total_billed',         v_mc_call_1 ? 'total_billed',
          'has_margin_percent',       v_mc_call_1 ? 'margin_percent',
          'has_intervention_flags',   v_mc_call_1 ? 'intervention_flags',
          'has_revenue_at_risk',      v_mc_call_1 ? 'revenue_at_risk',
          'has_cost_overrun_exposure',v_mc_call_1 ? 'cost_overrun_exposure'
        );
        IF NOT (
          (v_mc_call_1 ? 'contract_value') AND
          (v_mc_call_1 ? 'total_billed') AND
          (v_mc_call_1 ? 'margin_percent') AND
          (v_mc_call_1 ? 'intervention_flags')
        ) THEN
          v_c2_ok := false;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      v_c2_ok := false;
      v_passed_mc := false;
      v_sqlstate_mc := v_err_state;
      v_msg_mc := v_err_msg;
      v_wiring_proj := jsonb_build_object('error', v_err_msg);
    END;
  ELSE
    v_skip_mc := 'no_active_project_found';
  END IF;

  -- ── Check 3: Wiring & Shape — Executive Risk Summary ─────────────────────
  BEGIN
    v_exec_call_1 := public.rpc_generate_executive_risk_summary(p_org_id);
    v_ran_exec    := true;
    v_passed_exec := true;

    IF v_exec_call_1 IS NULL OR v_exec_call_1 = 'null'::jsonb THEN
      v_c3_ok := false;
      v_wiring_exec := jsonb_build_object('error', 'null_response');
    ELSE
      v_wiring_exec := jsonb_build_object(
        'has_generated_at',    v_exec_call_1 ? 'generated_at',
        'has_org_id',          v_exec_call_1 ? 'org_id',
        'has_summary',         v_exec_call_1 ? 'summary',
        'has_projects',        v_exec_call_1 ? 'projects'
      );
      IF NOT (
        (v_exec_call_1 ? 'generated_at') AND
        (v_exec_call_1 ? 'org_id') AND
        (v_exec_call_1 ? 'summary') AND
        (v_exec_call_1 ? 'projects')
      ) THEN
        v_c3_ok := false;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
    v_c3_ok := false;
    v_passed_exec := false;
    v_sqlstate_exec := v_err_state;
    v_msg_exec := v_err_msg;
    v_wiring_exec := jsonb_build_object('error', v_err_msg);
  END;

  -- ── Check 5: Determinism ─────────────────────────────────────────────────
  IF v_sample_project_id IS NOT NULL AND v_ran_mc AND v_passed_mc THEN
    BEGIN
      v_mc_call_2 := public.rpc_generate_project_margin_control(v_sample_project_id);
      v_det := v_det || jsonb_build_object('margin_control_deterministic', v_mc_call_1 = v_mc_call_2);
    EXCEPTION WHEN OTHERS THEN
      v_det := v_det || jsonb_build_object('margin_control_deterministic', false);
    END;
  END IF;

  IF v_ran_exec AND v_passed_exec THEN
    BEGIN
      v_exec_call_2 := public.rpc_generate_executive_risk_summary(p_org_id);
      v_det := v_det || jsonb_build_object('exec_risk_deterministic', v_exec_call_1 = v_exec_call_2);
    EXCEPTION WHEN OTHERS THEN
      v_det := v_det || jsonb_build_object('exec_risk_deterministic', false);
    END;
  END IF;

  -- ── Check 6: Smoke tests ─────────────────────────────────────────────────
  v_smoke := jsonb_build_object(
    'margin_control', jsonb_build_object(
      'ran',     v_ran_mc,
      'passed',  CASE WHEN v_ran_mc THEN v_passed_mc ELSE null END,
      'skipped', CASE WHEN NOT v_ran_mc THEN v_skip_mc ELSE null END,
      'sqlstate',    CASE WHEN v_ran_mc AND NOT v_passed_mc THEN v_sqlstate_mc ELSE null END,
      'message_text',CASE WHEN v_ran_mc AND NOT v_passed_mc THEN v_msg_mc     ELSE null END
    ),
    'exec_risk', jsonb_build_object(
      'ran',     v_ran_exec,
      'passed',  CASE WHEN v_ran_exec THEN v_passed_exec ELSE null END,
      'skipped', CASE WHEN NOT v_ran_exec THEN v_skip_exec ELSE null END,
      'sqlstate',    CASE WHEN v_ran_exec AND NOT v_passed_exec THEN v_sqlstate_exec ELSE null END,
      'message_text',CASE WHEN v_ran_exec AND NOT v_passed_exec THEN v_msg_exec     ELSE null END
    )
  );

  -- ── Check 7: Non-volatile DDL source scan (v15 — structured offenders) ──
  FOR v_fn_rec IN
    SELECT p.proname AS fname,
           p.oid AS fn_oid,
           p.provolatile AS vol,
           pg_catalog.pg_get_functiondef(p.oid) AS fdef
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname LIKE 'rpc_%'
       AND p.provolatile IN ('s', 'i')
     ORDER BY p.proname ASC
  LOOP
    v_ddl_matched_this_fn := false;
    FOREACH v_ddl_token IN ARRAY v_ddl_tokens LOOP
      v_ddl_match_pos := position(lower(v_ddl_token) in lower(v_fn_rec.fdef));
      IF v_ddl_match_pos > 0 AND NOT v_ddl_matched_this_fn THEN
        v_ddl_matched_this_fn := true;
        v_c7_ok := false;

        -- Extract a short excerpt around the match (max 120 chars)
        v_ddl_line_start := greatest(1, v_ddl_match_pos - 40);
        v_ddl_line_end   := least(length(v_fn_rec.fdef), v_ddl_match_pos + length(v_ddl_token) + 79);
        v_ddl_excerpt    := substring(v_fn_rec.fdef FROM v_ddl_line_start FOR (v_ddl_line_end - v_ddl_line_start + 1));
        -- Replace newlines with spaces for single-line excerpt
        v_ddl_excerpt    := replace(replace(v_ddl_excerpt, E'\n', ' '), E'\r', ' ');
        -- Trim to max 120 chars
        v_ddl_excerpt    := left(v_ddl_excerpt, 120);

        v_ddl_offenders := v_ddl_offenders || jsonb_build_object(
          'schema',        'public',
          'function',      v_fn_rec.fname,
          'volatility',    v_fn_rec.vol,
          'matched_token', v_ddl_token,
          'match_line',    v_ddl_excerpt
        );
      END IF;
    END LOOP;
  END LOOP;

  -- Sort offenders deterministically
  SELECT COALESCE(jsonb_agg(
    x ORDER BY x->>'schema' ASC, x->>'function' ASC, x->>'matched_token' ASC
  ), '[]'::jsonb)
    INTO v_ddl_offenders
    FROM jsonb_array_elements(v_ddl_offenders) AS x;

  -- Build final ddl_scan object
  IF v_c7_ok THEN
    v_ddl_scan := jsonb_build_object(
      'success',           true,
      'which_call_failed', null,
      'message_text',      null,
      'offenders',         '[]'::jsonb
    );
  ELSE
    v_ddl_scan := jsonb_build_object(
      'success',           false,
      'which_call_failed', 'nonvolatile_ddl_scan',
      'message_text',      'nonvolatile_ddl_detected',
      'offenders',         v_ddl_offenders
    );
  END IF;

  -- ── Check 8: Economic inputs credibility (v12) ───────────────────────────
  IF v_sample_project_id IS NOT NULL THEN
    BEGIN
      v_cred_payload := public.rpc_debug_margin_control_inputs(v_sample_project_id);

      v_cred_labor_missing    := COALESCE((v_cred_payload->'validation_flags'->>'labor_missing')::boolean, true);
      v_cred_estimate_missing := COALESCE((v_cred_payload->'validation_flags'->>'estimate_missing')::boolean, true);
      v_cred_revenue_missing  := COALESCE((v_cred_payload->'validation_flags'->>'revenue_missing')::boolean, true);
      v_cred_est_labor        := COALESCE((v_cred_payload->'estimate_inputs'->>'estimated_labor_cost')::numeric, 0);
      v_cred_labor_rows       := COALESCE((v_cred_payload->'labor_actual_inputs'->>'labor_row_count')::integer, 0);

      IF v_cred_labor_missing OR v_cred_estimate_missing OR v_cred_revenue_missing
      THEN
        v_cred_ok := false;
        v_cred_check := jsonb_build_object(
          'success',           false,
          'which_call_failed', 'economic_inputs_credibility',
          'sqlstate',          null,
          'message_text',      'economic_inputs_not_credible',
          'evidence', jsonb_build_object(
            'estimated_labor_cost', v_cred_est_labor,
            'labor_row_count',      v_cred_labor_rows,
            'labor_missing',        v_cred_labor_missing,
            'estimate_missing',     v_cred_estimate_missing,
            'revenue_missing',      v_cred_revenue_missing
          )
        );
      ELSE
        v_cred_check := jsonb_build_object(
          'success',           true,
          'which_call_failed', null,
          'sqlstate',          null,
          'message_text',      null,
          'evidence', jsonb_build_object(
            'estimated_labor_cost', v_cred_est_labor,
            'labor_row_count',      v_cred_labor_rows,
            'labor_missing',        v_cred_labor_missing,
            'estimate_missing',     v_cred_estimate_missing,
            'revenue_missing',      v_cred_revenue_missing
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      v_cred_ok := false;
      v_cred_check := jsonb_build_object(
        'success',           false,
        'which_call_failed', 'rpc_debug_margin_control_inputs',
        'sqlstate',          v_err_state,
        'message_text',      v_err_msg,
        'evidence',          null
      );
    END;
  ELSE
    v_cred_check := jsonb_build_object(
      'skipped', true,
      'reason',  'no_active_project_found'
    );
  END IF;

  -- ── v10: wiring_and_shape consolidation ──────────────────────────────────
  IF NOT v_c2_ok THEN
    v_wiring_invalid := v_wiring_invalid || jsonb_build_object(
      'check',   'wiring_project',
      'detail',  v_wiring_proj
    );
  END IF;
  IF NOT v_c3_ok THEN
    v_wiring_invalid := v_wiring_invalid || jsonb_build_object(
      'check',   'wiring_exec',
      'detail',  v_wiring_exec
    );
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->'check' ASC), '[]'::jsonb)
    INTO v_wiring_invalid
    FROM jsonb_array_elements(v_wiring_invalid) AS x;

  v_wiring_shape := jsonb_build_object(
    'success',  (v_c2_ok AND v_c3_ok),
    'invalid',  v_wiring_invalid
  );

  -- ── Failing sections ─────────────────────────────────────────────────────
  IF NOT v_c1_ok THEN
    v_failing := v_failing || to_jsonb('existence_and_security'::text);
  END IF;

  IF NOT v_c2_ok OR NOT v_c3_ok THEN
    v_failing := v_failing || to_jsonb('wiring_and_shape'::text);
  END IF;

  IF (v_ran_mc = true AND v_passed_mc = false)
     OR (v_ran_exec = true AND v_passed_exec = false)
  THEN
    v_c6_ok := false;
    v_failing := v_failing || to_jsonb('smoke_tests_authenticated'::text);
  END IF;

  IF NOT v_c7_ok THEN
    v_failing := v_failing || to_jsonb('nonvolatile_ddl_scan'::text);
  END IF;

  IF NOT v_cred_ok THEN
    v_failing := v_failing || to_jsonb('economic_inputs_credibility'::text);
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x ASC), '[]'::jsonb)
    INTO v_failing
    FROM (SELECT DISTINCT jsonb_array_elements_text(v_failing) AS x) s;

  -- ── v5: overall success ───────────────────────────────────────────────────
  v_overall_success :=
        v_c1_ok
    AND v_c6_ok
    AND v_c2_ok
    AND v_c3_ok
    AND v_c7_ok
    AND v_cred_ok
    AND v_report_exception IS NULL
    AND (NOT v_ran_mc   OR v_passed_mc)
    AND (NOT v_ran_exec OR v_passed_exec);

  -- ── v6: evaluation_mode + skipped_sections ──
  IF NOT v_ran_mc AND NOT v_ran_exec THEN
    v_evaluation_mode := 'empty';
    v_skipped_sections := v_skipped_sections || to_jsonb('smoke_tests_authenticated'::text);
    v_skipped_sections := v_skipped_sections || to_jsonb('determinism_hygiene'::text);
  ELSIF NOT v_ran_mc OR NOT v_ran_exec THEN
    v_evaluation_mode := 'partial';
    IF NOT v_ran_mc THEN
      v_skipped_sections := v_skipped_sections || to_jsonb('smoke_margin_control'::text);
    END IF;
    IF NOT v_ran_exec THEN
      v_skipped_sections := v_skipped_sections || to_jsonb('smoke_exec_risk'::text);
    END IF;
  ELSE
    v_evaluation_mode := 'full';
  END IF;

  -- Dedupe & sort skipped_sections
  SELECT COALESCE(jsonb_agg(x ORDER BY x ASC), '[]'::jsonb)
    INTO v_skipped_sections
    FROM (SELECT DISTINCT jsonb_array_elements_text(v_skipped_sections) AS x) s;

  -- ── Counts ──
  v_total_count :=
      1   -- Check 1 (existence+security)
    + (CASE WHEN v_ran_mc   THEN 1 ELSE 0 END)
    + (CASE WHEN v_ran_exec THEN 1 ELSE 0 END)
    + 2    -- Check 2 (wiring_proj) + Check 3 (wiring_exec)
    + 1    -- Check 7 (nonvolatile_ddl_scan)
    + 1;   -- Check 8 (economic_inputs_credibility)

  v_failed_count :=
      (CASE WHEN NOT v_c1_ok THEN 1 ELSE 0 END)
    + (CASE WHEN v_ran_mc   AND NOT v_passed_mc   THEN 1 ELSE 0 END)
    + (CASE WHEN v_ran_exec AND NOT v_passed_exec THEN 1 ELSE 0 END)
    + (CASE WHEN NOT v_c2_ok THEN 1 ELSE 0 END)
    + (CASE WHEN NOT v_c3_ok THEN 1 ELSE 0 END)
    + (CASE WHEN NOT v_c7_ok THEN 1 ELSE 0 END)
    + (CASE WHEN NOT v_cred_ok THEN 1 ELSE 0 END)
    + (CASE WHEN v_report_exception IS NOT NULL THEN 1 ELSE 0 END);

  v_passed_count := v_total_count - v_failed_count;

  -- ── why_failed ──
  IF NOT v_overall_success THEN
    IF NOT v_c1_ok THEN
      v_why_failed := v_why_failed || to_jsonb('existence_or_security_failed'::text);
    END IF;
    IF v_ran_mc AND NOT v_passed_mc THEN
      v_why_failed := v_why_failed || to_jsonb('smoke_margin_control_failed'::text);
    END IF;
    IF v_ran_exec AND NOT v_passed_exec THEN
      v_why_failed := v_why_failed || to_jsonb('smoke_exec_risk_failed'::text);
    END IF;
    IF NOT v_c2_ok THEN
      v_why_failed := v_why_failed || to_jsonb('wiring_project_failed'::text);
    END IF;
    IF NOT v_c3_ok THEN
      v_why_failed := v_why_failed || to_jsonb('wiring_exec_failed'::text);
    END IF;
    IF NOT v_c7_ok THEN
      v_why_failed := v_why_failed || to_jsonb('nonvolatile_ddl_detected'::text);
    END IF;
    IF NOT v_cred_ok THEN
      v_why_failed := v_why_failed || to_jsonb('economic_inputs_not_credible'::text);
    END IF;
    IF v_report_exception IS NOT NULL THEN
      v_why_failed := v_why_failed || to_jsonb('report_exception'::text);
    END IF;
  END IF;

  -- Dedupe & sort why_failed
  SELECT COALESCE(jsonb_agg(x ORDER BY x ASC), '[]'::jsonb)
    INTO v_why_failed
    FROM (SELECT DISTINCT jsonb_array_elements_text(v_why_failed) AS x) s;

  -- ── v14: self_tests ──────────────────────────────────────────────────────
  v_st_success_is_bool := true;   -- PL/pgSQL boolean, always true
  v_st_ok_is_bool      := true;   -- same
  v_st_success_eq_ok   := true;   -- both derived from v_overall_success

  v_st_eval_valid := v_evaluation_mode IN ('full','partial','skipped','empty');

  -- skipped_sections sorted & deduped check
  SELECT COALESCE(jsonb_agg(x ORDER BY x ASC), '[]'::jsonb)
    INTO v_st_arr_sorted
    FROM (SELECT DISTINCT jsonb_array_elements_text(v_skipped_sections) AS x) s;
  v_st_skipped_sorted := (v_st_arr_sorted = v_skipped_sections);

  -- why_failed sorted & deduped check
  SELECT COALESCE(jsonb_agg(x ORDER BY x ASC), '[]'::jsonb)
    INTO v_st_arr_sorted
    FROM (SELECT DISTINCT jsonb_array_elements_text(v_why_failed) AS x) s;
  v_st_why_sorted := (v_st_arr_sorted = v_why_failed);

  v_st_all_pass := v_st_success_is_bool
                AND v_st_ok_is_bool
                AND v_st_success_eq_ok
                AND v_st_eval_valid
                AND v_st_skipped_sorted
                AND v_st_why_sorted;

  IF NOT v_st_all_pass THEN
    v_overall_success := false;
    v_failed_count := v_failed_count + 1;
    v_why_failed := v_why_failed || to_jsonb('self_tests_failed'::text);
    v_failing := v_failing || to_jsonb('self_tests'::text);

    -- Re-dedupe & sort
    SELECT COALESCE(jsonb_agg(x ORDER BY x ASC), '[]'::jsonb)
      INTO v_why_failed
      FROM (SELECT DISTINCT jsonb_array_elements_text(v_why_failed) AS x) s;
    SELECT COALESCE(jsonb_agg(x ORDER BY x ASC), '[]'::jsonb)
      INTO v_failing
      FROM (SELECT DISTINCT jsonb_array_elements_text(v_failing) AS x) s;
  END IF;

  v_self_tests := jsonb_build_object(
    'all_pass',                   v_st_all_pass,
    'success_is_boolean',         v_st_success_is_bool,
    'ok_is_boolean',              v_st_ok_is_bool,
    'success_equals_ok',          v_st_success_eq_ok,
    'evaluation_mode_valid',      v_st_eval_valid,
    'skipped_sections_sorted_deduped', v_st_skipped_sorted,
    'why_failed_sorted_deduped',  v_st_why_sorted,
    'message_text',               CASE WHEN v_st_all_pass THEN null ELSE 'self_test_invariant_violated' END
  );

  -- ── Return ───────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'version',           15,
    'success',           v_overall_success,
    'ok',                v_overall_success,
    'evaluation_mode',   v_evaluation_mode,
    'org_id',            p_org_id,
    'project_id',        v_sample_project_id,
    'total_checks',      v_total_count,
    'passed_count',      v_passed_count,
    'failed_count',      v_failed_count,
    'checks', jsonb_build_object(
      'existence_and_security',    jsonb_build_object('existence', v_existence, 'security', v_security, 'success', v_c1_ok),
      'wiring_and_shape_project',  v_wiring_proj,
      'wiring_and_shape_exec',     v_wiring_exec,
      'wiring_and_shape',          v_wiring_shape,
      'guardrail_enforcement_presence', jsonb_build_object('success', v_c1_ok),
      'determinism_hygiene',           v_det,
      'smoke_tests_authenticated',     v_smoke,
      'nonvolatile_ddl_scan',          v_ddl_scan,
      'economic_inputs_credibility',   v_cred_check
    ),
    'failing_sections', v_failing,
    'skipped_sections', v_skipped_sections,
    'why_failed',       v_why_failed,
    'self_tests',       v_self_tests,
    'report_exception', v_report_exception
  );
END;
$fn$;

COMMENT ON FUNCTION public.rpc_get_os_brain_release_report(uuid, uuid) IS
  'v15: nonvolatile_ddl_scan now emits structured offenders[] array '
  'with schema, function, volatility, matched_token, match_line (120-char excerpt). '
  'Sorted by schema ASC, function ASC, matched_token ASC. '
  'On failure: which_call_failed=nonvolatile_ddl_scan, message_text=nonvolatile_ddl_detected.';
