
CREATE OR REPLACE FUNCTION public.rpc_get_os_brain_release_report(
  p_org_id     uuid,
  p_project_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- Auth
  v_uid               uuid;

  -- Check 1 — existence + security
  v_es                jsonb := '{}'::jsonb;
  v_fn_name           text;
  v_fn_oid            oid;
  v_exists            boolean;
  v_secdef            boolean;
  v_pinned            boolean;
  v_auth_grant        boolean;
  v_fn_names          text[] := ARRAY[
    'rpc_generate_project_margin_control',
    'rpc_get_executive_risk_summary',
    'rpc_convert_quote_to_invoice',
    'rpc_approve_change_order',
    'rpc_complete_project'
  ];

  -- Check 2 — wiring project
  v_sample_project_id uuid;
  v_wiring_proj       jsonb := '{}'::jsonb;
  v_margin_payload    jsonb;
  v_rc                jsonb;
  v_required_keys     text[] := ARRAY[
    'data_uncertainty_pressure',
    'labor_burn_pressure',
    'margin_pressure',
    'volatility_pressure'
  ];
  v_component         text;
  v_all_keys_present  boolean;
  v_all_numeric       boolean;

  -- Check 3 — wiring exec
  v_exec_payload      jsonb;
  v_wiring_exec       jsonb := '{}'::jsonb;
  v_exec_fields       text[] := ARRAY[
    'total_projected_revenue',
    'high_risk_projected_revenue',
    'revenue_exposed_high_risk_percent',
    'top_3_risky_revenue',
    'top_3_risky_revenue_percent'
  ];
  v_field             text;
  v_all_exec_present  boolean;
  v_all_exec_numeric  boolean;
  v_pct_field         text;
  v_pct_fields        text[] := ARRAY[
    'revenue_exposed_high_risk_percent',
    'top_3_risky_revenue_percent'
  ];
  v_total_rev         numeric;
  v_pct_ok            boolean;

  -- Check 4 — guardrail static scan
  v_guardrail_fns     text[] := ARRAY[
    'rpc_approve_change_order',
    'rpc_complete_project',
    'rpc_convert_quote_to_invoice'
  ];
  v_guardrail         jsonb := '{}'::jsonb;
  v_fn_body           text;
  v_calls_mc          boolean;
  v_blocks_thresh     boolean;
  v_raises_blocked    boolean;
  v_has_42501         boolean;

  -- Check 5 — determinism hygiene
  v_det               jsonb := '[]'::jsonb;
  v_det_body          text;

  -- Check 6 — smoke tests (v3 JWT-aware structured shape)
  v_smoke             jsonb := '{}'::jsonb;
  v_jwt_claims        text;
  v_has_jwt           boolean;

  v_ran_mc            boolean := false;
  v_passed_mc         boolean := true;
  v_skip_mc           text;
  v_sqlstate_mc       text;
  v_msg_mc            text;

  v_ran_exec          boolean := false;
  v_passed_exec       boolean := true;
  v_skip_exec         text;
  v_sqlstate_exec     text;
  v_msg_exec          text;

  -- Check 7 — nonvolatile DDL source scan (v9)
  v_ddl_scan          jsonb   := '[]'::jsonb;
  v_ddl_fn_oid        oid;
  v_ddl_fn_body       text;
  v_ddl_provolatile   text;
  v_ddl_tokens        text[] := ARRAY[
    'CREATE TABLE',
    'CREATE TEMP',
    'CREATE UNLOGGED',
    'ALTER TABLE',
    'DROP TABLE'
  ];
  v_ddl_token         text;
  v_ddl_hit           text;
  v_c7_ok             boolean := true;

  -- Check 8 — economic inputs credibility (v12)
  v_cred_payload      jsonb;
  v_cred_labor_missing   boolean;
  v_cred_estimate_missing boolean;
  v_cred_revenue_missing  boolean;
  v_cred_est_labor     numeric;
  v_cred_labor_rows    integer;
  v_cred_ok            boolean := true;
  v_cred_check         jsonb := '{}'::jsonb;

  -- v10: wiring_and_shape consolidated output
  v_wiring_invalid    jsonb   := '[]'::jsonb;
  v_wiring_shape      jsonb   := '{}'::jsonb;

  -- Captured error details
  v_err_state         text;
  v_err_msg           text;

  -- Per-check sub-flags (drive failing_sections only)
  v_failing           jsonb := '[]'::jsonb;
  v_c1_ok             boolean := true;
  v_c2_ok             boolean := true;
  v_c2_skipped        boolean := false;
  v_c3_ok             boolean := true;
  v_c6_ok             boolean := true;

  -- v5: explicit overall success
  v_report_exception  text    := NULL;
  v_overall_success   boolean := false;

  -- v6: counters + evaluation_mode
  v_ran_count         integer := 0;
  v_failed_count      integer := 0;
  v_skipped_count     integer := 0;
  v_evaluation_mode   text    := 'skipped';

  -- v8: why_failed
  v_why_failed        jsonb   := '[]'::jsonb;

  -- v13: skipped_sections
  v_skipped_sections  jsonb   := '[]'::jsonb;

  -- Helpers
  v_fn_rec            record;
BEGIN
  -- ── 1. Auth ──────────────────────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── Check 1: Existence + Security posture ────────────────────────────────
  FOR v_fn_name IN
    SELECT unnest(v_fn_names) ORDER BY 1
  LOOP
    v_fn_oid     := NULL;
    v_exists     := false;
    v_secdef     := false;
    v_pinned     := false;
    v_auth_grant := false;

    SELECT
      p.oid,
      true,
      p.prosecdef,
      pg_catalog.has_function_privilege(p.oid, 'EXECUTE'),
      (p.proconfig IS NOT NULL
       AND 'search_path=public, pg_temp' = ANY(p.proconfig))
    INTO v_fn_oid, v_exists, v_secdef, v_auth_grant, v_pinned
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = v_fn_name
   ORDER BY p.oid ASC
   LIMIT 1;

    IF v_fn_oid IS NULL THEN
      v_exists     := false;
      v_secdef     := false;
      v_pinned     := false;
      v_auth_grant := false;
    END IF;

    v_es := v_es || jsonb_build_object(
      v_fn_name, jsonb_build_object(
        'exists',                  v_exists,
        'security_definer',        COALESCE(v_secdef,     false),
        'pinned_search_path',      COALESCE(v_pinned,     false),
        'granted_to_authenticated',COALESCE(v_auth_grant, false)
      )
    );
  END LOOP;

  -- ── Check 2: Wiring + Output Shape — margin control ──────────────────────
  BEGIN
    SELECT id
      INTO v_sample_project_id
      FROM public.projects
     WHERE organization_id = p_org_id
       AND is_deleted       = false
       AND status NOT IN ('completed', 'closed', 'cancelled', 'didnt_get')
     ORDER BY id ASC
     LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
    v_wiring_proj := jsonb_build_object(
      'success',          false,
      'skipped',          true,
      'reason',           'project_query_failed',
      'which_call_failed','projects_query',
      'sqlstate',         v_err_state,
      'message_text',     v_err_msg
    );
    v_sample_project_id := NULL;
  END;

  IF v_sample_project_id IS NULL AND v_wiring_proj = '{}'::jsonb THEN
    v_wiring_proj := jsonb_build_object(
      'skipped', true,
      'reason',  'no_active_project_found'
    );
    v_c2_skipped := true;
  ELSIF v_sample_project_id IS NOT NULL THEN
    BEGIN
      v_margin_payload := public.rpc_generate_project_margin_control(v_sample_project_id);

      v_rc := v_margin_payload->'risk_components';

      IF v_rc IS NULL THEN
        v_all_keys_present := false;
        v_all_numeric      := false;
      ELSE
        v_all_keys_present := true;
        v_all_numeric      := true;
        FOREACH v_component IN ARRAY v_required_keys LOOP
          IF v_rc->v_component IS NULL THEN
            v_all_keys_present := false;
          ELSE
            BEGIN
              PERFORM (v_rc->>v_component)::numeric;
            EXCEPTION WHEN OTHERS THEN
              v_all_numeric := false;
            END;
          END IF;
        END LOOP;
      END IF;

      IF v_rc IS NOT NULL
         AND COALESCE(v_all_keys_present, false)
         AND COALESCE(v_all_numeric, false)
      THEN
        v_wiring_proj := jsonb_build_object(
          'success',           true,
          'project_id',        v_sample_project_id,
          'risk_components',   v_rc,
          'all_keys_present',  v_all_keys_present,
          'all_numeric',       v_all_numeric
        );
      ELSE
        v_c2_ok := false;
        v_wiring_proj := jsonb_build_object(
          'success',           false,
          'project_id',        v_sample_project_id,
          'risk_components',   v_rc,
          'all_keys_present',  COALESCE(v_all_keys_present, false),
          'all_numeric',       COALESCE(v_all_numeric,      false),
          'which_call_failed', 'rpc_generate_project_margin_control',
          'sqlstate',          null,
          'message_text',      'risk_components shape invalid'
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      v_c2_ok := false;
      v_wiring_proj := jsonb_build_object(
        'success',          false,
        'project_id',       v_sample_project_id,
        'which_call_failed','rpc_generate_project_margin_control',
        'sqlstate',         v_err_state,
        'message_text',     v_err_msg
      );
    END;
  END IF;

  -- ── Check 3: Wiring + Output Shape — exec risk summary ───────────────────
  IF v_sample_project_id IS NOT NULL THEN
    BEGIN
      v_exec_payload := public.rpc_get_executive_risk_summary(p_org_id);

      v_all_exec_present := true;
      v_all_exec_numeric := true;
      FOREACH v_field IN ARRAY v_exec_fields LOOP
        IF v_exec_payload->v_field IS NULL THEN
          v_all_exec_present := false;
        ELSE
          BEGIN
            PERFORM (v_exec_payload->>v_field)::numeric;
          EXCEPTION WHEN OTHERS THEN
            v_all_exec_numeric := false;
          END;
        END IF;
      END LOOP;

      v_total_rev := COALESCE((v_exec_payload->>'total_projected_revenue')::numeric, 0);
      v_pct_ok := true;
      IF v_total_rev > 0 THEN
        FOREACH v_pct_field IN ARRAY v_pct_fields LOOP
          IF COALESCE((v_exec_payload->>v_pct_field)::numeric, 0) > 100 THEN
            v_pct_ok := false;
          END IF;
        END LOOP;
      END IF;

      IF COALESCE(v_all_exec_present, false) AND COALESCE(v_all_exec_numeric, false) AND COALESCE(v_pct_ok, true)
      THEN
        v_wiring_exec := jsonb_build_object(
          'success',           true,
          'all_fields_present',v_all_exec_present,
          'all_numeric',       v_all_exec_numeric,
          'percent_ok',        v_pct_ok,
          'total_projected_revenue', v_total_rev
        );
      ELSE
        v_c3_ok := false;
        v_wiring_exec := jsonb_build_object(
          'success',           false,
          'all_fields_present',COALESCE(v_all_exec_present, false),
          'all_numeric',       COALESCE(v_all_exec_numeric,      false),
          'percent_ok',        COALESCE(v_pct_ok, true),
          'which_call_failed', 'rpc_get_executive_risk_summary',
          'sqlstate',          null,
          'message_text',      'exec risk summary shape invalid'
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      v_c3_ok := false;
      v_wiring_exec := jsonb_build_object(
        'success',          false,
        'which_call_failed','rpc_get_executive_risk_summary',
        'sqlstate',         v_err_state,
        'message_text',     v_err_msg
      );
    END;
  ELSE
    v_wiring_exec := jsonb_build_object(
      'skipped', true,
      'reason',  'no_active_project_found'
    );
  END IF;

  -- ── Check 4: Guardrail static scan ───────────────────────────────────────
  FOR v_fn_name IN
    SELECT unnest(v_guardrail_fns) ORDER BY 1
  LOOP
    v_fn_body := NULL;
    SELECT pg_catalog.pg_get_functiondef(p.oid)
      INTO v_fn_body
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = v_fn_name
     ORDER BY p.oid ASC
     LIMIT 1;

    IF v_fn_body IS NOT NULL THEN
      v_calls_mc     := v_fn_body ILIKE '%rpc_generate_project_margin_control%';
      v_blocks_thresh := v_fn_body ILIKE '%>= 60%' OR v_fn_body ILIKE '%risk_score%';
      v_raises_blocked := v_fn_body ILIKE '%economic_risk_block%' OR v_fn_body ILIKE '%RAISE EXCEPTION%';
      v_has_42501    := v_fn_body ILIKE '%42501%';
    ELSE
      v_calls_mc      := false;
      v_blocks_thresh := false;
      v_raises_blocked:= false;
      v_has_42501     := false;
    END IF;

    v_guardrail := v_guardrail || jsonb_build_object(
      v_fn_name, jsonb_build_object(
        'calls_margin_control', v_calls_mc,
        'blocks_on_threshold',  v_blocks_thresh,
        'raises_blocked',       v_raises_blocked,
        'has_42501',            v_has_42501
      )
    );
  END LOOP;

  -- ── Check 5: Determinism hygiene ─────────────────────────────────────────
  FOR v_fn_rec IN
    SELECT p.proname AS fname,
           pg_catalog.pg_get_functiondef(p.oid) AS fdef
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname LIKE 'rpc_%'
     ORDER BY p.proname ASC
  LOOP
    IF v_fn_rec.fdef ILIKE '%json_agg%' OR v_fn_rec.fdef ILIKE '%jsonb_agg%' THEN
      v_det_body := v_fn_rec.fdef;
      IF v_det_body NOT ILIKE '%ORDER BY%' THEN
        v_det := v_det || jsonb_build_object(
          'function', v_fn_rec.fname,
          'issue',    'json(b)_agg without ORDER BY'
        );
      END IF;
    END IF;
  END LOOP;

  -- ── Check 6: Smoke tests ─────────────────────────────────────────────────
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true);
    v_has_jwt := (v_jwt_claims IS NOT NULL AND v_jwt_claims <> '' AND v_jwt_claims <> '{}');
  EXCEPTION WHEN OTHERS THEN
    v_has_jwt := false;
  END;

  IF v_has_jwt AND v_sample_project_id IS NOT NULL THEN
    BEGIN
      v_margin_payload := public.rpc_generate_project_margin_control(v_sample_project_id);
      v_ran_mc := true;
      IF v_margin_payload IS NULL
         OR v_margin_payload->'risk_score' IS NULL
         OR v_margin_payload->'economic_position' IS NULL
      THEN
        v_passed_mc := false;
        v_sqlstate_mc := null;
        v_msg_mc := 'payload_missing_required_keys';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate_mc = RETURNED_SQLSTATE, v_msg_mc = MESSAGE_TEXT;
      v_ran_mc := true;
      v_passed_mc := false;
    END;

    BEGIN
      v_exec_payload := public.rpc_get_executive_risk_summary(p_org_id);
      v_ran_exec := true;
      IF v_exec_payload IS NULL
         OR v_exec_payload->'total_projected_revenue' IS NULL
      THEN
        v_passed_exec := false;
        v_sqlstate_exec := null;
        v_msg_exec := 'payload_missing_required_keys';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate_exec = RETURNED_SQLSTATE, v_msg_exec = MESSAGE_TEXT;
      v_ran_exec := true;
      v_passed_exec := false;
    END;
  ELSE
    IF NOT v_has_jwt THEN
      v_skip_mc   := 'no_jwt';
      v_skip_exec := 'no_jwt';
    ELSE
      v_skip_mc   := 'no_active_project';
      v_skip_exec := 'no_active_project';
    END IF;
  END IF;

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

  -- ── Check 7: Non-volatile DDL source scan ────────────────────────────────
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
    FOREACH v_ddl_token IN ARRAY v_ddl_tokens LOOP
      IF v_fn_rec.fdef ILIKE '%' || v_ddl_token || '%' THEN
        v_c7_ok := false;
        v_ddl_scan := v_ddl_scan || jsonb_build_object(
          'function',   v_fn_rec.fname,
          'volatility', v_fn_rec.vol,
          'ddl_token',  v_ddl_token
        );
      END IF;
    END LOOP;
  END LOOP;

  -- ── Check 8: Economic inputs credibility (v12) ───────────────────────────
  IF v_sample_project_id IS NOT NULL THEN
    BEGIN
      v_cred_payload := public.rpc_debug_margin_control_inputs(v_sample_project_id);

      v_cred_labor_missing    := COALESCE((v_cred_payload->'validation_flags'->>'labor_missing')::boolean, true);
      v_cred_estimate_missing := COALESCE((v_cred_payload->'validation_flags'->>'estimate_missing')::boolean, true);
      v_cred_revenue_missing  := COALESCE((v_cred_payload->'validation_flags'->>'revenue_missing')::boolean, true);
      v_cred_est_labor        := COALESCE((v_cred_payload->'estimate_inputs'->>'estimated_labor_cost')::numeric, 0);
      v_cred_labor_rows       := COALESCE((v_cred_payload->'labor_actual_inputs'->>'labor_row_count')::integer, 0);

      IF (v_cred_est_labor > 0 AND v_cred_labor_rows = 0)
         OR v_cred_revenue_missing
         OR v_cred_estimate_missing
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
    (
      (NOT v_ran_mc  OR (v_ran_mc  AND v_passed_mc))
      AND (NOT v_ran_exec OR (v_ran_exec AND v_passed_exec))
      AND v_c2_ok
      AND v_c3_ok
      AND v_c7_ok
      AND v_cred_ok
      AND v_report_exception IS NULL
    );

  -- ── v6: counters ──────────────────────────────────────────────────────────
  v_ran_count :=
    (CASE WHEN v_ran_mc   THEN 1 ELSE 0 END)
    + (CASE WHEN v_ran_exec THEN 1 ELSE 0 END)
    + 2
    + 1
    + 1;

  v_failed_count :=
    (CASE WHEN v_ran_mc   AND NOT v_passed_mc   THEN 1 ELSE 0 END)
    + (CASE WHEN v_ran_exec AND NOT v_passed_exec THEN 1 ELSE 0 END)
    + (CASE WHEN NOT v_c2_ok THEN 1 ELSE 0 END)
    + (CASE WHEN NOT v_c3_ok THEN 1 ELSE 0 END)
    + (CASE WHEN NOT v_c7_ok THEN 1 ELSE 0 END)
    + (CASE WHEN NOT v_cred_ok THEN 1 ELSE 0 END)
    + (CASE WHEN v_report_exception IS NOT NULL THEN 1 ELSE 0 END);

  v_skipped_count :=
    (CASE WHEN NOT v_ran_mc   THEN 1 ELSE 0 END)
    + (CASE WHEN NOT v_ran_exec THEN 1 ELSE 0 END)
    + (CASE WHEN v_c2_skipped  THEN 1 ELSE 0 END);

  -- ── v13: evaluation_mode (updated) ────────────────────────────────────────
  v_evaluation_mode :=
    CASE
      WHEN (NOT v_ran_mc AND NOT v_ran_exec) THEN 'skipped'
      WHEN (v_ran_mc AND v_ran_exec AND v_c2_ok AND v_c3_ok AND v_cred_ok) THEN 'full'
      ELSE 'partial'
    END;

  -- ── v13: skipped_sections ─────────────────────────────────────────────────
  IF NOT v_ran_mc THEN
    v_skipped_sections := v_skipped_sections || to_jsonb('smoke_margin_control'::text);
  END IF;
  IF NOT v_ran_exec THEN
    v_skipped_sections := v_skipped_sections || to_jsonb('smoke_exec_risk'::text);
  END IF;
  IF v_c2_skipped THEN
    v_skipped_sections := v_skipped_sections || to_jsonb('wiring_project'::text);
  END IF;
  IF (v_cred_check->>'skipped')::boolean IS NOT DISTINCT FROM true THEN
    v_skipped_sections := v_skipped_sections || to_jsonb('economic_inputs_credibility'::text);
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x ASC), '[]'::jsonb)
    INTO v_skipped_sections
    FROM (SELECT DISTINCT jsonb_array_elements_text(v_skipped_sections) AS x) s;

  -- ── v8: why_failed ────────────────────────────────────────────────────────
  IF NOT v_overall_success THEN
    IF v_ran_mc   AND NOT v_passed_mc   THEN
      v_why_failed := v_why_failed || to_jsonb('smoke_margin_control_failed'::text);
    END IF;
    IF v_ran_exec AND NOT v_passed_exec THEN
      v_why_failed := v_why_failed || to_jsonb('smoke_exec_failed'::text);
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

    SELECT COALESCE(jsonb_agg(x ORDER BY x ASC), '[]'::jsonb)
      INTO v_why_failed
      FROM (
        SELECT DISTINCT x
          FROM jsonb_array_elements(v_why_failed) AS x
         WHERE x IS NOT NULL
      ) s;
  END IF;

  -- ── Return ────────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'version',    'brain_release_report_v13',
    'org_id',     p_org_id,
    'project_id', COALESCE(v_sample_project_id, p_project_id),
    'success',    v_overall_success,
    'ok',         v_overall_success,
    'why_failed',      v_why_failed,
    'ran_count',       v_ran_count,
    'skipped_count',   v_skipped_count,
    'failed_count',    v_failed_count,
    'evaluation_mode', v_evaluation_mode,
    'skipped_sections', v_skipped_sections,
    'checks', jsonb_build_object(
      'existence_and_security',        v_es,
      'wiring_and_shape',              v_wiring_shape,
      'wiring_and_shape_project',      v_wiring_proj,
      'wiring_and_shape_exec',         v_wiring_exec,
      'guardrail_enforcement_presence',v_guardrail,
      'determinism_hygiene',           v_det,
      'smoke_tests_authenticated',     v_smoke,
      'nonvolatile_ddl_scan',          v_ddl_scan,
      'economic_inputs_credibility',   v_cred_check
    ),
    'failing_sections', v_failing
  );
END;
$$;
