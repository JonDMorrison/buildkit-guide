
-- ═══════════════════════════════════════════════════════════════════════════
-- rpc_get_os_brain_release_report — v9
-- Adds: check_nonvolatile_ddl_scan (Check 7)
--
-- Scans pg_proc for any non-volatile (STABLE/IMMUTABLE) function in the core
-- OS function list and fails if its source body contains DDL tokens that are
-- illegal in non-volatile functions:
--   CREATE TABLE | CREATE TEMP | CREATE UNLOGGED | ALTER TABLE | DROP TABLE
--
-- New additions vs v8:
--   DECLARE:  v_ddl_scan jsonb, v_ddl_fn_name text, v_ddl_fn_oid oid,
--             v_ddl_fn_body text, v_ddl_provolatile text, v_c7_ok boolean,
--             v_ddl_tokens text[], v_ddl_token text, v_ddl_hit text
--   Check 7:  loop over v_fn_names, check provolatile != 'v', scan body
--   v_overall_success: AND v_c7_ok
--   v_ran_count:       +1
--   v_failed_count:    + CASE WHEN NOT v_c7_ok
--   v_why_failed:      'nonvolatile_ddl_detected'
--   v_failing:         'nonvolatile_ddl_scan'
--   RETURN:            checks.nonvolatile_ddl_scan = v_ddl_scan
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_get_os_brain_release_report(
  p_org_id    uuid,
  p_project_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
  v_ddl_fn_name       text;
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

  -- v8: why_failed — deterministic jsonb array of canonical failure reasons
  v_why_failed        jsonb   := '[]'::jsonb;

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

    SELECT p.oid, true,
           p.prosecdef,
           (SELECT COUNT(*) > 0
              FROM pg_proc_acl a
             WHERE a.oid = p.oid
               AND a.acl::text LIKE '%authenticated=X%'),
           (p.proconfig IS NOT NULL
            AND 'search_path=public, pg_temp' = ANY(p.proconfig))
      INTO v_fn_oid, v_exists, v_secdef, v_auth_grant, v_pinned
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
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
          'success',                      true,
          'project_id',                   v_sample_project_id,
          'has_risk_components',          true,
          'risk_components_keys_ok',      true,
          'risk_components_numeric_ok',   true,
          'has_risk_components_mismatch', (v_margin_payload ? 'risk_components_mismatch'),
          'sample', jsonb_build_object(
            'risk_score',         v_margin_payload->>'risk_score',
            'economic_position',  v_margin_payload->>'economic_position',
            'intervention_flags', v_margin_payload->'intervention_flags',
            'risk_components',    v_rc
          )
        );
      ELSE
        v_wiring_proj := jsonb_build_object(
          'success',                      false,
          'project_id',                   v_sample_project_id,
          'has_risk_components',          v_rc IS NOT NULL,
          'risk_components_keys_ok',      COALESCE(v_all_keys_present, false),
          'risk_components_numeric_ok',   COALESCE(v_all_numeric, false),
          'has_risk_components_mismatch', (v_margin_payload ? 'risk_components_mismatch'),
          'which_call_failed',            'rpc_generate_project_margin_control',
          'sqlstate',                     NULL::text,
          'message_text',                 'invalid_shape_or_failed_call',
          'sample', jsonb_build_object(
            'risk_score',         v_margin_payload->>'risk_score',
            'economic_position',  v_margin_payload->>'economic_position',
            'intervention_flags', v_margin_payload->'intervention_flags',
            'risk_components',    v_rc
          )
        );
      END IF;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      v_wiring_proj := jsonb_build_object(
        'success',          false,
        'project_id',       v_sample_project_id,
        'which_call_failed','rpc_generate_project_margin_control',
        'sqlstate',         v_err_state,
        'message_text',     v_err_msg
      );
    END;
  END IF;

  -- ── Check 3: Wiring + Output Shape — org executive ────────────────────────
  BEGIN
    v_exec_payload := public.rpc_get_executive_risk_summary(p_org_id);

    IF v_exec_payload IS NULL THEN
      v_wiring_exec := jsonb_build_object(
        'success',          false,
        'which_call_failed','rpc_get_executive_risk_summary',
        'sqlstate',         NULL::text,
        'message_text',     'invalid_shape_or_failed_call'
      );
    ELSE
      v_all_exec_present := true;
      v_all_exec_numeric := true;
      v_pct_ok           := true;

      FOREACH v_field IN ARRAY v_exec_fields LOOP
        IF v_exec_payload->>v_field IS NULL THEN
          v_all_exec_present := false;
        ELSE
          BEGIN
            PERFORM (v_exec_payload->>v_field)::numeric;
          EXCEPTION WHEN OTHERS THEN
            v_all_exec_numeric := false;
          END;
        END IF;
      END LOOP;

      FOREACH v_pct_field IN ARRAY v_pct_fields LOOP
        BEGIN
          DECLARE v_pct_val numeric;
          BEGIN
            v_pct_val := (v_exec_payload->>v_pct_field)::numeric;
            IF v_pct_val < 0 OR v_pct_val > 100 THEN
              v_pct_ok := false;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            v_pct_ok := false;
          END;
        END;
      END LOOP;

      IF COALESCE(v_all_exec_present, false)
         AND COALESCE(v_all_exec_numeric, false)
         AND COALESCE(v_pct_ok, false)
      THEN
        v_wiring_exec := jsonb_build_object(
          'success',            true,
          'all_fields_present', true,
          'all_fields_numeric', true,
          'percent_bounds_ok',  true,
          'sample', jsonb_build_object(
            'total_projected_revenue',           v_exec_payload->>'total_projected_revenue',
            'high_risk_projected_revenue',       v_exec_payload->>'high_risk_projected_revenue',
            'revenue_exposed_high_risk_percent', v_exec_payload->>'revenue_exposed_high_risk_percent',
            'top_3_risky_revenue',               v_exec_payload->>'top_3_risky_revenue',
            'top_3_risky_revenue_percent',       v_exec_payload->>'top_3_risky_revenue_percent'
          )
        );
      ELSE
        v_wiring_exec := jsonb_build_object(
          'success',            false,
          'all_fields_present', COALESCE(v_all_exec_present, false),
          'all_fields_numeric', COALESCE(v_all_exec_numeric, false),
          'percent_bounds_ok',  COALESCE(v_pct_ok, false),
          'which_call_failed',  'rpc_get_executive_risk_summary',
          'sqlstate',           NULL::text,
          'message_text',       'invalid_shape_or_failed_call',
          'sample', jsonb_build_object(
            'total_projected_revenue',           v_exec_payload->>'total_projected_revenue',
            'high_risk_projected_revenue',       v_exec_payload->>'high_risk_projected_revenue',
            'revenue_exposed_high_risk_percent', v_exec_payload->>'revenue_exposed_high_risk_percent',
            'top_3_risky_revenue',               v_exec_payload->>'top_3_risky_revenue',
            'top_3_risky_revenue_percent',       v_exec_payload->>'top_3_risky_revenue_percent'
          )
        );
      END IF;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
    v_wiring_exec := jsonb_build_object(
      'success',          false,
      'which_call_failed','rpc_get_executive_risk_summary',
      'sqlstate',         v_err_state,
      'message_text',     v_err_msg
    );
  END;

  -- ── Check 4: Guardrail enforcement — static source scan ──────────────────
  FOR v_fn_name IN
    SELECT unnest(v_guardrail_fns) ORDER BY 1
  LOOP
    v_fn_body := NULL;

    SELECT pg_get_functiondef(p.oid)
      INTO v_fn_body
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = v_fn_name
     ORDER BY p.oid ASC
     LIMIT 1;

    IF v_fn_body IS NULL THEN
      v_guardrail := v_guardrail || jsonb_build_object(
        v_fn_name, jsonb_build_object('function_not_found', true)
      );
      CONTINUE;
    END IF;

    v_calls_mc := (
      position('rpc_generate_project_margin_control' IN v_fn_body) > 0
      OR position('_internal_economic_gate' IN v_fn_body) > 0
    );
    v_blocks_thresh := (
      position('>= 60' IN v_fn_body) > 0
      OR position('>= v_block_threshold' IN v_fn_body) > 0
      OR position('_internal_economic_gate' IN v_fn_body) > 0
    );
    v_raises_blocked := (
      position('economic_blocked' IN v_fn_body) > 0
      OR position('_internal_economic_gate' IN v_fn_body) > 0
    );
    v_has_42501 := (
      position('42501' IN v_fn_body) > 0
      OR position('_internal_economic_gate' IN v_fn_body) > 0
    );

    v_guardrail := v_guardrail || jsonb_build_object(
      v_fn_name, jsonb_build_object(
        'calls_margin_control',    v_calls_mc,
        'blocks_at_threshold',     v_blocks_thresh,
        'raises_economic_blocked', v_raises_blocked,
        'has_errcode_42501',       v_has_42501
      )
    );
  END LOOP;

  -- ── Check 5: Determinism hygiene ─────────────────────────────────────────
  FOR v_fn_rec IN
    SELECT p.proname, pg_get_functiondef(p.oid) AS body
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY(v_fn_names)
     ORDER BY p.proname ASC
  LOOP
    v_det_body := v_fn_rec.body;

    IF position('jsonb_agg(' IN v_det_body) > 0
       AND position('ORDER BY' IN v_det_body) = 0 THEN
      v_det := v_det || jsonb_build_object(
        'function', v_fn_rec.proname, 'issue', 'jsonb_agg_without_order_by');
    END IF;
    IF position('array_agg(' IN v_det_body) > 0
       AND position('ORDER BY' IN v_det_body) = 0 THEN
      v_det := v_det || jsonb_build_object(
        'function', v_fn_rec.proname, 'issue', 'array_agg_without_order_by');
    END IF;
    IF position(' LIMIT ' IN v_det_body) > 0
       AND position('ORDER BY' IN v_det_body) = 0 THEN
      v_det := v_det || jsonb_build_object(
        'function', v_fn_rec.proname, 'issue', 'limit_without_order_by');
    END IF;
  END LOOP;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'function' ASC, x->>'issue' ASC), '[]'::jsonb)
    INTO v_det
    FROM jsonb_array_elements(v_det) AS x;

  -- ── Check 6: Authenticated smoke tests (v3 JWT-aware, unchanged) ─────────
  v_jwt_claims := current_setting('request.jwt.claims', true);
  v_has_jwt    := (v_jwt_claims IS NOT NULL AND v_jwt_claims <> '');

  IF NOT v_has_jwt THEN
    v_ran_mc := false; v_passed_mc := true; v_skip_mc := 'no_jwt_context';
    v_sqlstate_mc := NULL; v_msg_mc := NULL;
  ELSIF v_sample_project_id IS NULL THEN
    v_ran_mc := false; v_passed_mc := true; v_skip_mc := 'no_active_project';
    v_sqlstate_mc := NULL; v_msg_mc := NULL;
  ELSE
    BEGIN
      PERFORM public.rpc_generate_project_margin_control(v_sample_project_id);
      v_ran_mc := true; v_passed_mc := true; v_skip_mc := NULL;
      v_sqlstate_mc := NULL; v_msg_mc := NULL;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      v_ran_mc := true; v_passed_mc := false; v_skip_mc := NULL;
      v_sqlstate_mc := v_err_state; v_msg_mc := v_err_msg;
    END;
  END IF;

  IF NOT v_has_jwt THEN
    v_ran_exec := false; v_passed_exec := true; v_skip_exec := 'no_jwt_context';
    v_sqlstate_exec := NULL; v_msg_exec := NULL;
  ELSE
    BEGIN
      PERFORM public.rpc_get_executive_risk_summary(p_org_id);
      v_ran_exec := true; v_passed_exec := true; v_skip_exec := NULL;
      v_sqlstate_exec := NULL; v_msg_exec := NULL;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      v_ran_exec := true; v_passed_exec := false; v_skip_exec := NULL;
      v_sqlstate_exec := v_err_state; v_msg_exec := v_err_msg;
    END;
  END IF;

  v_smoke := jsonb_build_object(
    'rpc_generate_project_margin_control', jsonb_build_object(
      'ran', v_ran_mc, 'passed', v_passed_mc,
      'skipped_reason', v_skip_mc, 'sqlstate', v_sqlstate_mc, 'message_text', v_msg_mc
    ),
    'rpc_get_executive_risk_summary', jsonb_build_object(
      'ran', v_ran_exec, 'passed', v_passed_exec,
      'skipped_reason', v_skip_exec, 'sqlstate', v_sqlstate_exec, 'message_text', v_msg_exec
    ),
    'guardrail_rpcs_note',
      'rpc_convert_quote_to_invoice, rpc_approve_change_order, rpc_complete_project: '
      'verified via static source scan only (Check 4). Not executed to avoid side effects.'
  );

  -- ── Check 7: Nonvolatile DDL source scan (v9) ─────────────────────────────
  -- For each core OS function that is STABLE (provolatile='s') or IMMUTABLE
  -- (provolatile='i'), scan pg_get_functiondef for DDL tokens that are illegal
  -- in non-volatile functions (SQLSTATE 0A000).
  -- No dynamic SQL. No side effects. Pure catalog reads.
  FOR v_fn_name IN
    SELECT unnest(v_fn_names) ORDER BY 1
  LOOP
    v_ddl_fn_oid      := NULL;
    v_ddl_provolatile := NULL;
    v_ddl_fn_body     := NULL;
    v_ddl_hit         := NULL;

    SELECT p.oid, p.provolatile::text, pg_get_functiondef(p.oid)
      INTO v_ddl_fn_oid, v_ddl_provolatile, v_ddl_fn_body
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = v_fn_name
     ORDER BY p.oid ASC
     LIMIT 1;

    -- Only scan STABLE ('s') and IMMUTABLE ('i') functions.
    -- VOLATILE ('v') functions may legitimately use DDL.
    IF v_ddl_fn_oid IS NOT NULL
       AND v_ddl_provolatile IS NOT NULL
       AND v_ddl_provolatile <> 'v'
    THEN
      FOREACH v_ddl_token IN ARRAY v_ddl_tokens LOOP
        IF position(v_ddl_token IN v_ddl_fn_body) > 0 THEN
          v_ddl_hit := v_ddl_token;
          EXIT;  -- first hit is sufficient; earliest token wins
        END IF;
      END LOOP;

      IF v_ddl_hit IS NOT NULL THEN
        -- Hard fail: non-volatile function contains forbidden DDL
        v_c7_ok := false;
        v_ddl_scan := v_ddl_scan || jsonb_build_object(
          'success',          false,
          'which_call_failed','nonvolatile_ddl_scan',
          'sqlstate',         '0A000',
          'message_text',     'ddl_not_allowed_in_nonvolatile_function:' || v_fn_name,
          'details', jsonb_build_object(
            'function',    v_fn_name,
            'token',       v_ddl_hit,
            'provolatile', v_ddl_provolatile
          )
        );
      ELSE
        -- Clean: non-volatile but no forbidden DDL found
        v_ddl_scan := v_ddl_scan || jsonb_build_object(
          'success',          true,
          'which_call_failed', NULL::text,
          'sqlstate',          NULL::text,
          'message_text',      NULL::text,
          'details', jsonb_build_object(
            'function',    v_fn_name,
            'provolatile', v_ddl_provolatile
          )
        );
      END IF;
      -- VOLATILE functions are exempt — no entry emitted (keeps output compact)
    END IF;
  END LOOP;

  -- Sort v_ddl_scan by function name for determinism
  SELECT COALESCE(
    jsonb_agg(x ORDER BY x->'details'->>'function' ASC),
    '[]'::jsonb
  )
  INTO v_ddl_scan
  FROM jsonb_array_elements(v_ddl_scan) AS x;

  -- ── Per-check sub-flags → failing_sections ───────────────────────────────
  DECLARE v_fn_entry jsonb;
  BEGIN
    FOR v_fn_entry IN SELECT jsonb_each.value FROM jsonb_each(v_es) LOOP
      IF NOT (
        COALESCE((v_fn_entry->>'exists')::boolean,                       false)
        AND COALESCE((v_fn_entry->>'security_definer')::boolean,         false)
        AND COALESCE((v_fn_entry->>'pinned_search_path')::boolean,       false)
        AND COALESCE((v_fn_entry->>'granted_to_authenticated')::boolean, false)
      ) THEN
        v_c1_ok := false;
      END IF;
    END LOOP;
  END;

  IF NOT v_c1_ok THEN
    v_failing := v_failing || to_jsonb('existence_and_security'::text);
  END IF;

  IF NOT COALESCE((v_wiring_proj->>'skipped')::boolean, false) THEN
    v_c2_ok :=
      (v_wiring_proj IS NOT NULL)
      AND (v_wiring_proj ? 'success')
      AND jsonb_typeof(v_wiring_proj->'success') = 'boolean'
      AND COALESCE((v_wiring_proj->>'success')::boolean, false) = true;
  END IF;

  v_c3_ok :=
    (v_wiring_exec IS NOT NULL)
    AND (v_wiring_exec ? 'success')
    AND jsonb_typeof(v_wiring_exec->'success') = 'boolean'
    AND COALESCE((v_wiring_exec->>'success')::boolean, false) = true;

  IF NOT v_c2_ok OR NOT v_c3_ok THEN
    IF NOT (v_failing @> to_jsonb('wiring_and_shape'::text)) THEN
      v_failing := v_failing || to_jsonb('wiring_and_shape'::text);
    END IF;
  END IF;

  IF (v_ran_mc = true AND v_passed_mc = false)
     OR (v_ran_exec = true AND v_passed_exec = false)
  THEN
    v_c6_ok := false;
    v_failing := v_failing || to_jsonb('smoke_tests_authenticated'::text);
  END IF;

  -- v9: Check 7 failure → failing_sections
  IF NOT v_c7_ok THEN
    v_failing := v_failing || to_jsonb('nonvolatile_ddl_scan'::text);
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x ASC), '[]'::jsonb)
    INTO v_failing
    FROM (SELECT DISTINCT jsonb_array_elements_text(v_failing) AS x) s;

  -- ── v5: overall success ───────────────────────────────────────────────────
  -- v9: AND v_c7_ok added
  v_overall_success :=
    (
      (NOT v_ran_mc  OR (v_ran_mc  AND v_passed_mc))
      AND (NOT v_ran_exec OR (v_ran_exec AND v_passed_exec))
      AND v_c2_ok
      AND v_c3_ok
      AND v_c7_ok
      AND v_report_exception IS NULL
    );

  -- ── v6: counters ──────────────────────────────────────────────────────────
  v_ran_count :=
    (CASE WHEN v_ran_mc   THEN 1 ELSE 0 END)
    + (CASE WHEN v_ran_exec THEN 1 ELSE 0 END)
    + 2    -- Check 2 (wiring_proj) + Check 3 (wiring_exec)
    + 1;   -- v9: Check 7 (nonvolatile_ddl_scan) always runs

  v_failed_count :=
    (CASE WHEN v_ran_mc   AND NOT v_passed_mc   THEN 1 ELSE 0 END)
    + (CASE WHEN v_ran_exec AND NOT v_passed_exec THEN 1 ELSE 0 END)
    + (CASE WHEN NOT v_c2_ok THEN 1 ELSE 0 END)
    + (CASE WHEN NOT v_c3_ok THEN 1 ELSE 0 END)
    + (CASE WHEN NOT v_c7_ok THEN 1 ELSE 0 END)   -- v9
    + (CASE WHEN v_report_exception IS NOT NULL THEN 1 ELSE 0 END);

  v_skipped_count :=
    (CASE WHEN NOT v_ran_mc   THEN 1 ELSE 0 END)
    + (CASE WHEN NOT v_ran_exec THEN 1 ELSE 0 END);

  v_evaluation_mode :=
    CASE
      WHEN (NOT v_ran_mc AND NOT v_ran_exec) THEN 'skipped'
      WHEN (v_ran_mc AND v_ran_exec)         THEN 'full'
      ELSE                                        'partial'
    END;

  -- ── v8: why_failed — deterministic jsonb array ────────────────────────────
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
      v_why_failed := v_why_failed || to_jsonb('nonvolatile_ddl_detected'::text);  -- v9
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
    'version',    'brain_release_report_v9',
    'org_id',     p_org_id,
    'project_id', COALESCE(v_sample_project_id, p_project_id),
    'success',    v_overall_success,
    'ok',         v_overall_success,
    'why_failed',      v_why_failed,
    'ran_count',       v_ran_count,
    'skipped_count',   v_skipped_count,
    'failed_count',    v_failed_count,
    'evaluation_mode', v_evaluation_mode,
    'checks', jsonb_build_object(
      'existence_and_security',        v_es,
      'wiring_and_shape_project',      v_wiring_proj,
      'wiring_and_shape_exec',         v_wiring_exec,
      'guardrail_enforcement_presence',v_guardrail,
      'determinism_hygiene',           v_det,
      'smoke_tests_authenticated',     v_smoke,
      'nonvolatile_ddl_scan',          v_ddl_scan
    ),
    'failing_sections', v_failing
  );
END;
$$;

REVOKE ALL  ON FUNCTION public.rpc_get_os_brain_release_report(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_os_brain_release_report(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.rpc_get_os_brain_release_report(uuid, uuid) IS
  'v9: adds check_nonvolatile_ddl_scan (Check 7). '
  'For each core OS RPC that is STABLE or IMMUTABLE (provolatile != v), '
  'scans pg_get_functiondef for forbidden DDL tokens: '
  'CREATE TABLE, CREATE TEMP, CREATE UNLOGGED, ALTER TABLE, DROP TABLE. '
  'Hit → success=false, sqlstate=0A000, message_text=ddl_not_allowed_in_nonvolatile_function:<name>. '
  'v_c7_ok gates v_overall_success. Canonical failure reason: nonvolatile_ddl_detected. '
  'STABLE SECURITY DEFINER, pinned search_path = public, pg_temp. No schema/RLS changes.';
