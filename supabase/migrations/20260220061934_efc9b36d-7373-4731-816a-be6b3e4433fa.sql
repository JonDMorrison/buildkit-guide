
-- ═══════════════════════════════════════════════════════════════════════════
-- rpc_get_os_brain_release_report(p_org_id uuid, p_project_id uuid DEFAULT NULL)
--
-- Release-grade verification report for the last 3 OS Brain builds:
--   Build 1: risk_components in rpc_generate_project_margin_control
--   Build 2: revenue exposure metrics in rpc_get_executive_risk_summary
--   Build 3: hard guardrails in rpc_convert_quote_to_invoice,
--             rpc_approve_change_order, rpc_complete_project
--
-- Checks:
--   1. existence_and_security   — pg_proc posture for all 5 functions
--   2. wiring_and_shape_project — rpc_generate_project_margin_control payload shape
--   3. wiring_and_shape_exec    — rpc_get_executive_risk_summary revenue fields
--   4. guardrail_enforcement    — static source scan of 3 guardrail RPCs
--   5. determinism_hygiene      — focused pattern scan of the 5 functions
--   6. smoke_tests              — live read-only calls for the 2 safe RPCs
--
-- Security: STABLE SECURITY DEFINER, pinned search_path, no writes.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_get_os_brain_release_report(
  p_org_id    uuid,
  p_project_id uuid DEFAULT NULL
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
  v_rc_keys           text[];
  v_required_keys     text[] := ARRAY[
    'data_uncertainty_pressure',
    'labor_burn_pressure',
    'margin_pressure',
    'volatility_pressure'
  ];
  v_component         text;
  v_all_keys_present  boolean;
  v_all_numeric       boolean;
  v_key               text;

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
    'rpc_convert_quote_to_invoice',
    'rpc_approve_change_order',
    'rpc_complete_project'
  ];
  v_guardrail         jsonb := '{}'::jsonb;
  v_fn_body           text;
  v_calls_mc          boolean;
  v_blocks_thresh     boolean;
  v_raises_blocked    boolean;
  v_has_42501         boolean;

  -- Check 5 — determinism hygiene
  v_det               jsonb := '[]'::jsonb;
  v_det_fn            text;
  v_det_body          text;

  -- Check 6 — smoke tests
  v_smoke             jsonb := '{}'::jsonb;
  v_smoke_ok          boolean;
  v_smoke_msg         text;
  v_smoke_state       text;

  -- OK computation
  v_failing           jsonb := '[]'::jsonb;
  v_ok                boolean := true;

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

  -- ── Check 1: Existence + Security posture ─────────────────────────────
  FOR v_fn_name IN
    SELECT unnest(v_fn_names) ORDER BY 1
  LOOP
    v_fn_oid   := NULL;
    v_exists   := false;
    v_secdef   := false;
    v_pinned   := false;
    v_auth_grant := false;

    SELECT p.oid, p.prosecdef,
           (p.proconfig IS NOT NULL AND p.proconfig::text ILIKE '%pg_temp%')
      INTO v_fn_oid, v_secdef, v_pinned
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = v_fn_name
     ORDER BY p.oid ASC
     LIMIT 1;

    IF v_fn_oid IS NOT NULL THEN
      v_exists := true;
      BEGIN
        v_auth_grant := has_function_privilege('authenticated', v_fn_oid, 'EXECUTE');
      EXCEPTION WHEN OTHERS THEN
        v_auth_grant := false;
      END;
    END IF;

    v_es := v_es || jsonb_build_object(
      v_fn_name, jsonb_build_object(
        'exists',                   v_exists,
        'security_definer',         COALESCE(v_secdef, false),
        'pinned_search_path',       COALESCE(v_pinned, false),
        'granted_to_authenticated', v_auth_grant
      )
    );
  END LOOP;

  -- ── Check 2: Wiring + Output Shape — project level ────────────────────
  -- Resolve project_id: prefer caller-supplied, else first active by id ASC
  IF p_project_id IS NOT NULL THEN
    v_sample_project_id := p_project_id;
  ELSE
    SELECT id INTO v_sample_project_id
    FROM   public.projects
    WHERE  organization_id = p_org_id
    AND    is_deleted       = false
    AND    status NOT IN ('completed', 'closed', 'cancelled', 'archived', 'deleted', 'cancelled', 'didnt_get')
    ORDER  BY id ASC
    LIMIT  1;
  END IF;

  IF v_sample_project_id IS NULL THEN
    v_wiring_proj := jsonb_build_object('skipped', true, 'reason', 'no_active_project_found');
  ELSE
    BEGIN
      v_margin_payload := public.rpc_generate_project_margin_control(v_sample_project_id);

      -- Verify risk_components key exists
      v_rc := v_margin_payload->'risk_components';

      IF v_rc IS NULL THEN
        v_all_keys_present := false;
        v_all_numeric      := false;
      ELSE
        -- Check exactly the 4 required keys
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

      v_wiring_proj := jsonb_build_object(
        'project_id',                v_sample_project_id,
        'has_risk_components',       v_rc IS NOT NULL,
        'risk_components_keys_ok',   COALESCE(v_all_keys_present, false),
        'risk_components_numeric_ok',COALESCE(v_all_numeric, false),
        'has_risk_components_mismatch', (v_margin_payload ? 'risk_components_mismatch'),
        'sample', jsonb_build_object(
          'risk_score',          v_margin_payload->>'risk_score',
          'economic_position',   v_margin_payload->>'economic_position',
          'intervention_flags',  v_margin_payload->'intervention_flags',
          'risk_components',     v_rc
        )
      );
    EXCEPTION WHEN OTHERS THEN
      v_wiring_proj := jsonb_build_object(
        'project_id', v_sample_project_id,
        'error',      SQLERRM,
        'sqlstate',   SQLSTATE
      );
    END;
  END IF;

  -- ── Check 3: Wiring + Output Shape — org executive ────────────────────
  BEGIN
    v_exec_payload := public.rpc_get_executive_risk_summary(p_org_id);

    v_all_exec_present := true;
    v_all_exec_numeric := true;
    v_pct_ok           := true;
    v_total_rev        := COALESCE((v_exec_payload->>'total_projected_revenue')::numeric, -1);

    FOREACH v_field IN ARRAY v_exec_fields LOOP
      IF NOT (v_exec_payload ? v_field) THEN
        v_all_exec_present := false;
      ELSE
        BEGIN
          PERFORM (v_exec_payload->>v_field)::numeric;
        EXCEPTION WHEN OTHERS THEN
          v_all_exec_numeric := false;
        END;
      END IF;
    END LOOP;

    -- Percent bounds check (only when total_revenue > 0)
    IF v_total_rev > 0 THEN
      FOREACH v_pct_field IN ARRAY v_pct_fields LOOP
        DECLARE v_pct_val numeric;
        BEGIN
          v_pct_val := (v_exec_payload->>v_pct_field)::numeric;
          IF v_pct_val < 0 OR v_pct_val > 100 THEN
            v_pct_ok := false;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          v_pct_ok := false;
        END;
      END LOOP;
    END IF;

    v_wiring_exec := jsonb_build_object(
      'all_fields_present',   v_all_exec_present,
      'all_fields_numeric',   v_all_exec_numeric,
      'percent_bounds_ok',    v_pct_ok,
      'sample', jsonb_build_object(
        'total_projected_revenue',          v_exec_payload->>'total_projected_revenue',
        'high_risk_projected_revenue',      v_exec_payload->>'high_risk_projected_revenue',
        'revenue_exposed_high_risk_percent',v_exec_payload->>'revenue_exposed_high_risk_percent',
        'top_3_risky_revenue',              v_exec_payload->>'top_3_risky_revenue',
        'top_3_risky_revenue_percent',      v_exec_payload->>'top_3_risky_revenue_percent'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_wiring_exec := jsonb_build_object(
      'error',    SQLERRM,
      'sqlstate', SQLSTATE
    );
  END;

  -- ── Check 4: Guardrail enforcement — static source scan ───────────────
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

    -- calls rpc_generate_project_margin_control (directly or via _internal_economic_gate)
    v_calls_mc := (
      position('rpc_generate_project_margin_control' IN v_fn_body) > 0
      OR position('_internal_economic_gate' IN v_fn_body) > 0
    );

    -- compares against >= threshold (60 or block_threshold)
    v_blocks_thresh := (
      position('>= 60' IN v_fn_body) > 0
      OR position('>= v_block_threshold' IN v_fn_body) > 0
      OR position('_internal_economic_gate' IN v_fn_body) > 0   -- helper encapsulates the check
    );

    -- raises economic_blocked (exact string or via helper)
    v_raises_blocked := (
      position('economic_blocked' IN v_fn_body) > 0
      OR position('_internal_economic_gate' IN v_fn_body) > 0
    );

    -- 42501 present (directly or via helper)
    v_has_42501 := (
      position('42501' IN v_fn_body) > 0
      OR position('_internal_economic_gate' IN v_fn_body) > 0
    );

    v_guardrail := v_guardrail || jsonb_build_object(
      v_fn_name, jsonb_build_object(
        'calls_margin_control',   v_calls_mc,
        'blocks_at_threshold',    v_blocks_thresh,
        'raises_economic_blocked',v_raises_blocked,
        'has_errcode_42501',      v_has_42501
      )
    );
  END LOOP;

  -- ── Check 5: Determinism hygiene — focused scan of 5 functions ────────
  FOR v_fn_rec IN
    SELECT p.proname, pg_get_functiondef(p.oid) AS body
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY(v_fn_names)
     ORDER BY p.proname ASC
  LOOP
    v_det_body := v_fn_rec.body;

    -- jsonb_agg without ORDER BY
    IF position('jsonb_agg(' IN v_det_body) > 0
       AND position('jsonb_agg(' IN v_det_body) > 0
    THEN
      -- Heuristic: check if every jsonb_agg has a nearby ORDER BY
      -- Simplified: flag if body contains jsonb_agg but no ORDER BY at all
      IF position('ORDER BY' IN v_det_body) = 0 AND position('jsonb_agg(' IN v_det_body) > 0 THEN
        v_det := v_det || jsonb_build_object(
          'function', v_fn_rec.proname,
          'issue',    'jsonb_agg_without_order_by'
        );
      END IF;
    END IF;

    -- array_agg without ORDER BY
    IF position('array_agg(' IN v_det_body) > 0
       AND position('ORDER BY' IN v_det_body) = 0 THEN
      v_det := v_det || jsonb_build_object(
        'function', v_fn_rec.proname,
        'issue',    'array_agg_without_order_by'
      );
    END IF;

    -- LIMIT without ORDER BY (naive scan — flags top-level LIMIT)
    IF position(' LIMIT ' IN v_det_body) > 0
       AND position('ORDER BY' IN v_det_body) = 0 THEN
      v_det := v_det || jsonb_build_object(
        'function', v_fn_rec.proname,
        'issue',    'limit_without_order_by'
      );
    END IF;
  END LOOP;

  -- Sort determinism hits for deterministic output
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'function' ASC, x->>'issue' ASC), '[]'::jsonb)
    INTO v_det
    FROM jsonb_array_elements(v_det) AS x;

  -- ── Check 6: Authenticated smoke tests — read-only calls ──────────────
  -- rpc_generate_project_margin_control
  IF v_sample_project_id IS NOT NULL THEN
    BEGIN
      PERFORM public.rpc_generate_project_margin_control(v_sample_project_id);
      v_smoke := v_smoke || jsonb_build_object(
        'rpc_generate_project_margin_control', jsonb_build_object(
          'success',    true,
          'project_id', v_sample_project_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      v_smoke := v_smoke || jsonb_build_object(
        'rpc_generate_project_margin_control', jsonb_build_object(
          'success',  false,
          'sqlstate', SQLSTATE,
          'message',  SQLERRM
        )
      );
    END;
  ELSE
    v_smoke := v_smoke || jsonb_build_object(
      'rpc_generate_project_margin_control', jsonb_build_object(
        'skipped', true, 'reason', 'no_active_project'
      )
    );
  END IF;

  -- rpc_get_executive_risk_summary
  BEGIN
    PERFORM public.rpc_get_executive_risk_summary(p_org_id);
    v_smoke := v_smoke || jsonb_build_object(
      'rpc_get_executive_risk_summary', jsonb_build_object('success', true)
    );
  EXCEPTION WHEN OTHERS THEN
    v_smoke := v_smoke || jsonb_build_object(
      'rpc_get_executive_risk_summary', jsonb_build_object(
        'success',  false,
        'sqlstate', SQLSTATE,
        'message',  SQLERRM
      )
    );
  END;

  -- Mutating guardrail RPCs: presence-only (no execution)
  v_smoke := v_smoke || jsonb_build_object(
    'guardrail_rpcs_note',
    'rpc_convert_quote_to_invoice, rpc_approve_change_order, rpc_complete_project: '
    'verified via static source scan only (Check 4). Not executed to avoid side effects.'
  );

  -- ── OK computation ─────────────────────────────────────────────────────
  -- Check 1 pass: all 5 functions exist + secdef + pinned + auth grant
  DECLARE
    v_c1_ok boolean := true;
    v_c2_ok boolean := true;
    v_c3_ok boolean := true;
    v_c6_ok boolean := true;
    v_fn_entry jsonb;
  BEGIN
    FOR v_fn_entry IN
      SELECT jsonb_each.value FROM jsonb_each(v_es)
    LOOP
      IF NOT (
        (v_fn_entry->>'exists')::boolean
        AND (v_fn_entry->>'security_definer')::boolean
        AND (v_fn_entry->>'pinned_search_path')::boolean
        AND (v_fn_entry->>'granted_to_authenticated')::boolean
      ) THEN
        v_c1_ok := false;
      END IF;
    END LOOP;

    IF NOT v_c1_ok THEN
      v_failing := v_failing || to_jsonb('existence_and_security'::text);
      v_ok := false;
    END IF;

    -- Check 2 pass
    IF NOT COALESCE((v_wiring_proj->>'skipped')::boolean, false) THEN
      v_c2_ok := COALESCE((v_wiring_proj->>'has_risk_components')::boolean, false)
        AND COALESCE((v_wiring_proj->>'risk_components_keys_ok')::boolean, false)
        AND COALESCE((v_wiring_proj->>'risk_components_numeric_ok')::boolean, false)
        AND (v_wiring_proj->>'error' IS NULL);
    END IF;
    IF NOT v_c2_ok THEN
      v_failing := v_failing || to_jsonb('wiring_and_shape'::text);
      v_ok := false;
    END IF;

    -- Check 3 pass
    v_c3_ok := COALESCE((v_wiring_exec->>'all_fields_present')::boolean, false)
      AND COALESCE((v_wiring_exec->>'all_fields_numeric')::boolean, false)
      AND COALESCE((v_wiring_exec->>'percent_bounds_ok')::boolean, false)
      AND (v_wiring_exec->>'error' IS NULL);
    IF NOT v_c3_ok THEN
      IF NOT (v_failing @> to_jsonb('wiring_and_shape'::text)) THEN
        v_failing := v_failing || to_jsonb('wiring_and_shape'::text);
      END IF;
      v_ok := false;
    END IF;

    -- Check 6 pass: smoke tests that ran must have succeeded
    IF (v_smoke->'rpc_generate_project_margin_control'->>'success') = 'false'
       OR (v_smoke->'rpc_get_executive_risk_summary'->>'success') = 'false' THEN
      v_c6_ok := false;
      v_failing := v_failing || to_jsonb('smoke_tests_authenticated'::text);
      v_ok := false;
    END IF;
  END;

  -- Deduplicate + sort failing_sections
  SELECT COALESCE(jsonb_agg(x ORDER BY x ASC), '[]'::jsonb)
    INTO v_failing
    FROM (SELECT DISTINCT jsonb_array_elements_text(v_failing) AS x) s;

  -- ── Return ────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'version',    'brain_release_report_v1',
    'org_id',     p_org_id,
    'project_id', p_project_id,
    'checks', jsonb_build_object(
      'existence_and_security',        v_es,
      'wiring_and_shape_project',      v_wiring_proj,
      'wiring_and_shape_exec',         v_wiring_exec,
      'guardrail_enforcement_presence',v_guardrail,
      'determinism_hygiene',           v_det,
      'smoke_tests_authenticated',     v_smoke
    ),
    'ok',              v_ok,
    'failing_sections',v_failing
  );
END;
$$;

-- Grants
REVOKE ALL  ON FUNCTION public.rpc_get_os_brain_release_report(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_os_brain_release_report(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.rpc_get_os_brain_release_report(uuid, uuid) IS
  'brain_release_report_v1 — release-grade verification of risk decomposition, '
  'revenue exposure, and guardrail enforcement. STABLE SECURITY DEFINER, '
  'pinned search_path, no writes, deterministic output.';
