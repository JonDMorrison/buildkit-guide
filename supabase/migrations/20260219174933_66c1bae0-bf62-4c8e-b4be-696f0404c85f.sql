
CREATE OR REPLACE FUNCTION public.rpc_run_audit_suite(p_project_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_checks jsonb := '[]'::jsonb;
  v_check jsonb;
  v_org_id uuid;
  v_missing text[];
  v_found text[];
  v_table_name text;
  v_rls_enabled boolean;
  v_force_rls boolean;
  v_count bigint;
  v_offenders jsonb;
  v_variance1 jsonb;
  v_variance2 jsonb;
  v_test_project_id uuid;
  v_run_id uuid := gen_random_uuid();
  v_pass_count int := 0;
  v_fail_count int := 0;
  v_manual_count int := 0;
  v_p0_blockers int := 0;
  v_r record;
  -- AI Brain
  v_ai_project_id uuid;
  v_ai_org_id uuid;
  v_ai_brain_result jsonb;
  v_ai_brain_ok boolean := false;
  v_ai_brain jsonb;
BEGIN

  IF p_project_id IS NOT NULL THEN
    SELECT organization_id INTO v_org_id FROM projects WHERE id = p_project_id;
  END IF;
  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id
    FROM organization_memberships WHERE user_id = auth.uid() LIMIT 1;
  END IF;

  -- ================================================================
  -- CHECK 1: RLS + FORCE RLS on critical tables (P0)
  -- ================================================================
  DECLARE
    v_critical_tables text[] := ARRAY[
      'estimates', 'estimate_line_items', 'projects', 'time_entries',
      'receipts', 'invoices', 'quote_events', 'project_financial_snapshots'
    ];
    v_rls_results jsonb := '[]'::jsonb;
    v_all_rls_pass boolean := true;
  BEGIN
    FOREACH v_table_name IN ARRAY v_critical_tables LOOP
      SELECT relrowsecurity, relforcerowsecurity
        INTO v_rls_enabled, v_force_rls
        FROM pg_class c
        JOIN pg_namespace n ON c.relnamespace = n.oid
       WHERE n.nspname = 'public' AND c.relname = v_table_name;

      IF NOT FOUND THEN
        v_rls_results := v_rls_results || jsonb_build_object(
          'table', v_table_name, 'exists', false, 'rls', false, 'force', false);
        v_all_rls_pass := false;
      ELSE
        v_rls_results := v_rls_results || jsonb_build_object(
          'table', v_table_name, 'exists', true,
          'rls', COALESCE(v_rls_enabled, false),
          'force', COALESCE(v_force_rls, false));
        IF NOT COALESCE(v_rls_enabled, false) OR NOT COALESCE(v_force_rls, false) THEN
          v_all_rls_pass := false;
        END IF;
      END IF;
    END LOOP;

    v_check := jsonb_build_object(
      'id', 'critical_rls_force',
      'severity', 'P0',
      'name', 'RLS + FORCE RLS on Critical Tables',
      'area', 'Security',
      'status', CASE WHEN v_all_rls_pass THEN 'PASS' ELSE 'FAIL' END,
      'expected', 'RLS enabled + forced on all critical tables',
      'actual', CASE WHEN v_all_rls_pass THEN 'All pass' ELSE 'Some tables missing RLS/FORCE' END,
      'evidence', v_rls_results,
      'remediation', 'ALTER TABLE <table> ENABLE ROW LEVEL SECURITY; ALTER TABLE <table> FORCE ROW LEVEL SECURITY;',
      'offenders', (SELECT jsonb_agg(x) FROM jsonb_array_elements(v_rls_results) x WHERE NOT (x->>'rls')::boolean OR NOT (x->>'force')::boolean)
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 2: Direct client write denial on estimates (P0)
  -- ================================================================
  DECLARE
    v_permissive_write_policies jsonb := '[]'::jsonb;
    v_tables_to_check text[] := ARRAY['estimates', 'estimate_line_items'];
    v_has_permissive boolean := false;
    v_policy record;
  BEGIN
    FOREACH v_table_name IN ARRAY v_tables_to_check LOOP
      FOR v_policy IN
        SELECT c.relname AS tablename,
               pol.polname AS policyname,
               pol.polcmd,
               pol.polpermissive,
               ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(pol.polroles)) as roles,
               pg_get_expr(pol.polqual, pol.polrelid, true) AS qual,
               pg_get_expr(pol.polwithcheck, pol.polrelid, true) AS with_check
        FROM pg_policy pol
        JOIN pg_class c ON pol.polrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public' AND c.relname = v_table_name
          AND pol.polpermissive = true
          AND pol.polcmd IN ('a', 'w', 'd')
      LOOP
        IF 'authenticated' = ANY(v_policy.roles) OR 'public' = ANY(v_policy.roles) OR array_length(v_policy.roles, 1) IS NULL THEN
          v_permissive_write_policies := v_permissive_write_policies || jsonb_build_object(
            'tablename', v_policy.tablename,
            'policyname', v_policy.policyname,
            'cmd', v_policy.polcmd,
            'permissive', v_policy.polpermissive,
            'roles', to_jsonb(v_policy.roles),
            'qual', v_policy.qual,
            'with_check', v_policy.with_check);
          IF v_policy.qual IS NULL OR v_policy.qual != 'false' THEN
            IF v_policy.with_check IS NULL OR v_policy.with_check != 'false' THEN
              v_has_permissive := true;
            END IF;
          END IF;
        END IF;
      END LOOP;
    END LOOP;

    v_check := jsonb_build_object(
      'id', 'estimate_write_deny',
      'severity', 'P0',
      'name', 'Direct Client Write Denial on Estimates',
      'area', 'Security',
      'status', CASE WHEN NOT v_has_permissive THEN 'PASS' ELSE 'FAIL' END,
      'expected', 'No permissive INSERT/UPDATE/DELETE policies allowing authenticated writes to estimates/estimate_line_items',
      'actual', CASE WHEN NOT v_has_permissive THEN 'All writes denied' ELSE 'Permissive write policies found' END,
      'evidence', v_permissive_write_policies,
      'remediation', 'Ensure all write policies on estimates tables use USING (false) / WITH CHECK (false)',
      'offenders', CASE WHEN v_has_permissive THEN v_permissive_write_policies ELSE NULL END
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 3: RPC inventory (P1)
  -- ================================================================
  DECLARE
    v_required_rpcs text[] := ARRAY[
      'rpc_create_estimate',
      'rpc_update_estimate_header',
      'rpc_approve_estimate',
      'rpc_duplicate_estimate',
      'rpc_delete_estimate',
      'rpc_upsert_estimate_line_item',
      'rpc_delete_estimate_line_item',
      'rpc_generate_tasks_from_estimate',
      'estimate_variance_summary',
      'rpc_send_invoice',
      'rpc_convert_quote_to_invoice',
      'rpc_request_phase_advance',
      'rpc_approve_phase'
    ];
    v_rpc_name text;
    v_rpc_results jsonb := '[]'::jsonb;
    v_all_found boolean := true;
  BEGIN
    v_missing := '{}';
    v_found := '{}';
    FOREACH v_rpc_name IN ARRAY v_required_rpcs LOOP
      SELECT count(*) INTO v_count FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
       WHERE n.nspname = 'public' AND p.proname = v_rpc_name;
      v_rpc_results := v_rpc_results || jsonb_build_object(
        'rpc', v_rpc_name, 'found', v_count > 0);
      IF v_count = 0 THEN
        v_all_found := false;
        v_missing := array_append(v_missing, v_rpc_name);
      ELSE
        v_found := array_append(v_found, v_rpc_name);
      END IF;
    END LOOP;

    v_check := jsonb_build_object(
      'id', 'rpc_inventory',
      'severity', 'P1',
      'name', 'Required RPC Inventory',
      'area', 'Functions',
      'status', CASE WHEN v_all_found THEN 'PASS' ELSE 'FAIL' END,
      'expected', 'All required RPCs exist',
      'actual', CASE WHEN v_all_found THEN format('All %s RPCs found', array_length(v_required_rpcs, 1)) ELSE format('Missing: %s', array_to_string(v_missing, ', ')) END,
      'evidence', v_rpc_results,
      'remediation', 'CREATE OR REPLACE FUNCTION public.<missing_rpc>(...)',
      'offenders', CASE WHEN NOT v_all_found THEN to_jsonb(v_missing) ELSE NULL END
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 4: SECURITY DEFINER on all RPCs (P0)
  -- ================================================================
  DECLARE
    v_sd_rpcs text[] := ARRAY[
      'rpc_create_estimate', 'rpc_update_estimate_header', 'rpc_approve_estimate',
      'rpc_duplicate_estimate', 'rpc_delete_estimate',
      'rpc_upsert_estimate_line_item', 'rpc_delete_estimate_line_item',
      'rpc_generate_tasks_from_estimate', 'estimate_variance_summary'
    ];
    v_sd_rpc text;
    v_sd_results jsonb := '[]'::jsonb;
    v_sd_all boolean := true;
    v_sd_found boolean;
  BEGIN
    FOREACH v_sd_rpc IN ARRAY v_sd_rpcs LOOP
      SELECT EXISTS(
        SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
         WHERE n.nspname = 'public' AND p.proname = v_sd_rpc AND p.prosecdef = true
      ) INTO v_sd_found;
      v_sd_results := v_sd_results || jsonb_build_object(
        'rpc', v_sd_rpc, 'security_definer', v_sd_found);
      IF NOT v_sd_found THEN v_sd_all := false; END IF;
    END LOOP;

    v_check := jsonb_build_object(
      'id', 'rpc_security_definer',
      'severity', 'P0',
      'name', 'SECURITY DEFINER on All Financial RPCs',
      'area', 'Security',
      'status', CASE WHEN v_sd_all THEN 'PASS' ELSE 'FAIL' END,
      'expected', 'All financial RPCs are SECURITY DEFINER',
      'actual', CASE WHEN v_sd_all THEN 'All confirmed' ELSE 'Some RPCs are SECURITY INVOKER' END,
      'evidence', v_sd_results,
      'remediation', 'ALTER FUNCTION public.<rpc> SECURITY DEFINER',
      'offenders', (SELECT jsonb_agg(x) FROM jsonb_array_elements(v_sd_results) x WHERE NOT (x->>'security_definer')::boolean)
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 5: Financial consistency check (P1)
  -- ================================================================
  IF p_project_id IS NOT NULL THEN
    DECLARE
      v_est record;
      v_line_sum numeric;
      v_line_items_exist boolean;
      v_mismatch_details jsonb := '[]'::jsonb;
      v_all_match boolean := true;
    BEGIN
      FOR v_est IN
        SELECT id, estimate_number, planned_labor_bill_amount, planned_material_cost,
               planned_machine_cost, planned_other_cost, planned_total_cost
        FROM estimates WHERE project_id = p_project_id
      LOOP
        SELECT COALESCE(SUM(amount), 0) INTO v_line_sum FROM estimate_line_items WHERE estimate_id = v_est.id;
        v_line_items_exist := v_line_sum > 0;
        IF v_line_items_exist AND v_line_sum != COALESCE(v_est.planned_total_cost, 0) THEN
          v_all_match := false;
          v_mismatch_details := v_mismatch_details || jsonb_build_object(
            'estimate_id', v_est.id, 'estimate_number', v_est.estimate_number,
            'header_total', v_est.planned_total_cost, 'line_sum', v_line_sum,
            'delta', v_line_sum - COALESCE(v_est.planned_total_cost, 0));
        END IF;
      END LOOP;

      v_check := jsonb_build_object(
        'id', 'financial_consistency',
        'severity', 'P1',
        'name', 'Estimate Header vs Line Items Consistency',
        'area', 'Finance',
        'status', CASE WHEN v_all_match THEN 'PASS' ELSE 'FAIL' END,
        'expected', 'Estimate header totals match sum of line items',
        'actual', CASE WHEN v_all_match THEN 'All match' ELSE format('%s mismatches found', jsonb_array_length(v_mismatch_details)) END,
        'evidence', v_mismatch_details,
        'remediation', 'Recalculate estimate totals via rpc_update_estimate_header',
        'offenders', CASE WHEN NOT v_all_match THEN v_mismatch_details ELSE NULL END
      );
      v_checks := v_checks || v_check;
    END;
  END IF;

  -- ================================================================
  -- CHECK 6: Variance engine consistency (P1)
  -- ================================================================
  IF p_project_id IS NOT NULL THEN
    BEGIN
      v_variance1 := estimate_variance_summary(p_project_id);
      IF v_variance1 IS NOT NULL AND (v_variance1->>'has_estimate')::boolean THEN
        v_variance2 := estimate_variance_summary(p_project_id);
        v_check := jsonb_build_object(
          'id', 'variance_determinism',
          'severity', 'P1',
          'name', 'Variance Engine Determinism',
          'area', 'Finance',
          'status', CASE WHEN v_variance1 = v_variance2 THEN 'PASS' ELSE 'FAIL' END,
          'expected', 'Two consecutive calls return identical results',
          'actual', CASE WHEN v_variance1 = v_variance2 THEN 'Deterministic' ELSE 'Non-deterministic' END,
          'evidence', jsonb_build_object('run1_hash', md5(v_variance1::text), 'run2_hash', md5(v_variance2::text)),
          'remediation', 'Check for non-deterministic queries in estimate_variance_summary'
        );
        v_checks := v_checks || v_check;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_check := jsonb_build_object(
        'id', 'variance_determinism', 'severity', 'P1',
        'name', 'Variance Engine Determinism', 'area', 'Finance',
        'status', 'FAIL', 'expected', 'Variance engine runs without error',
        'actual', SQLERRM, 'evidence', SQLERRM
      );
      v_checks := v_checks || v_check;
    END;
  END IF;

  -- ================================================================
  -- CHECK 7: Currency validity (P1)
  -- ================================================================
  IF p_project_id IS NOT NULL THEN
    DECLARE
      v_invalid_currencies jsonb := '[]'::jsonb;
      v_cur_est record;
    BEGIN
      FOR v_cur_est IN
        SELECT id, estimate_number, currency
        FROM estimates WHERE project_id = p_project_id AND currency NOT IN ('CAD', 'USD')
      LOOP
        v_invalid_currencies := v_invalid_currencies || jsonb_build_object(
          'estimate_id', v_cur_est.id, 'estimate_number', v_cur_est.estimate_number,
          'currency', v_cur_est.currency);
      END LOOP;

      v_check := jsonb_build_object(
        'id', 'currency_validity',
        'severity', 'P1',
        'name', 'Estimate Currency Validity',
        'area', 'Finance',
        'status', CASE WHEN jsonb_array_length(v_invalid_currencies) = 0 THEN 'PASS' ELSE 'FAIL' END,
        'expected', 'All estimates use CAD or USD',
        'actual', CASE WHEN jsonb_array_length(v_invalid_currencies) = 0 THEN 'All valid' ELSE format('%s invalid', jsonb_array_length(v_invalid_currencies)) END,
        'evidence', v_invalid_currencies,
        'remediation', 'Update estimate currency to CAD or USD',
        'offenders', CASE WHEN jsonb_array_length(v_invalid_currencies) > 0 THEN v_invalid_currencies ELSE NULL END
      );
      v_checks := v_checks || v_check;
    END;
  END IF;

  -- ================================================================
  -- CHECK 8: Privilege Guard — no direct GRANT INSERT/UPDATE/DELETE (P0)
  -- ================================================================
  DECLARE
    v_priv_tables text[] := ARRAY['estimates', 'estimate_line_items', 'time_entries', 'project_financial_snapshots', 'project_workflows', 'project_workflow_steps'];
    v_priv_results jsonb := '[]'::jsonb;
    v_priv_all_pass boolean := true;
    v_priv_table text;
    v_priv record;
  BEGIN
    FOREACH v_priv_table IN ARRAY v_priv_tables LOOP
      FOR v_priv IN
        SELECT grantee, privilege_type
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND table_name = v_priv_table
          AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
          AND grantee IN ('authenticated', 'anon', 'public')
      LOOP
        v_priv_results := v_priv_results || jsonb_build_object(
          'table', v_priv_table,
          'grantee', v_priv.grantee,
          'privilege', v_priv.privilege_type);
        v_priv_all_pass := false;
      END LOOP;
    END LOOP;

    v_check := jsonb_build_object(
      'id', 'privilege_guard',
      'severity', 'P0',
      'name', 'No Direct GRANT INSERT/UPDATE/DELETE on Protected Tables',
      'area', 'Security',
      'status', CASE WHEN v_priv_all_pass THEN 'PASS' ELSE 'FAIL' END,
      'expected', 'No INSERT/UPDATE/DELETE grants to authenticated/anon/public on protected tables',
      'actual', CASE WHEN v_priv_all_pass THEN 'No direct grants found' ELSE format('%s privilege leak(s) found', jsonb_array_length(v_priv_results)) END,
      'evidence', v_priv_results,
      'remediation', 'REVOKE INSERT, UPDATE, DELETE ON public.<table> FROM authenticated;',
      'offenders', CASE WHEN NOT v_priv_all_pass THEN v_priv_results ELSE NULL END
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 9: Concurrency guard (P0)
  -- ================================================================
  DECLARE
    v_fn_src text;
    v_has_advisory boolean := false;
  BEGIN
    SELECT prosrc INTO v_fn_src
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'generate_tasks_from_scope';
    IF v_fn_src IS NOT NULL THEN
      v_has_advisory := v_fn_src ILIKE '%pg_advisory%';
    END IF;
    v_check := jsonb_build_object(
      'id', 'concurrency_advisory_lock', 'severity', 'P0',
      'name', 'Advisory Lock in generate_tasks_from_scope', 'area', 'Concurrency',
      'status', CASE WHEN v_has_advisory THEN 'PASS' ELSE 'FAIL' END,
      'expected', 'pg_advisory_xact_lock present', 'actual', CASE WHEN v_has_advisory THEN 'Found' ELSE 'Missing' END,
      'evidence', CASE WHEN v_fn_src IS NOT NULL THEN 'Function source inspected' ELSE 'Function not found' END,
      'remediation', 'Add PERFORM pg_advisory_xact_lock(...) at top of function body'
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 10: Cross-org isolation (P0)
  -- ================================================================
  IF p_project_id IS NOT NULL AND v_org_id IS NOT NULL THEN
    DECLARE
      v_cross_org_count bigint := 0;
    BEGIN
      SELECT count(*) INTO v_cross_org_count
      FROM time_entries te JOIN projects p ON p.id = te.project_id
      WHERE te.project_id = p_project_id AND p.organization_id != v_org_id;
      v_check := jsonb_build_object(
        'id', 'cross_org_time_entries', 'severity', 'P0',
        'name', 'Cross-Org Isolation: Time Entries', 'area', 'Security',
        'status', CASE WHEN v_cross_org_count = 0 THEN 'PASS' ELSE 'FAIL' END,
        'expected', 'No cross-org time entries', 'actual', CASE WHEN v_cross_org_count = 0 THEN 'Isolated' ELSE format('%s found', v_cross_org_count) END,
        'evidence', jsonb_build_object('cross_org_count', v_cross_org_count),
        'remediation', 'Review time_entries RLS policies for org isolation'
      );
      v_checks := v_checks || v_check;
    END;
  END IF;

  -- ================================================================
  -- CHECK 11: Invoice Send Role Enforcement (P1)
  -- ================================================================
  DECLARE
    v_pip_exists boolean := false;
    v_send_fn_src text;
    v_send_guard boolean := false;
  BEGIN
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_invoice_permissions') INTO v_pip_exists;
    SELECT prosrc INTO v_send_fn_src FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'rpc_send_invoice';
    IF v_send_fn_src IS NOT NULL THEN v_send_guard := v_send_fn_src ILIKE '%42501%'; END IF;
    v_check := jsonb_build_object(
      'id', 'invoice_send_role_enforcement', 'severity', 'P1',
      'name', 'Invoice Send Role Enforcement', 'area', 'Security',
      'status', CASE WHEN v_pip_exists AND v_send_guard THEN 'PASS' ELSE 'FAIL' END,
      'expected', 'project_invoice_permissions table exists AND rpc_send_invoice contains 42501 guard',
      'actual', format('Table: %s, Guard: %s', v_pip_exists, v_send_guard),
      'evidence', jsonb_build_object('project_invoice_permissions_exists', v_pip_exists, 'guard_found', v_send_guard),
      'remediation', 'Create project_invoice_permissions table and add 42501 guard to rpc_send_invoice'
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 12: Workflow RLS + FORCE RLS (P0)
  -- ================================================================
  DECLARE
    v_wf_tables text[] := ARRAY['project_workflows', 'project_workflow_steps', 'workflow_phases', 'workflow_phase_requirements'];
    v_wf_results jsonb := '[]'::jsonb;
    v_wf_all_pass boolean := true;
    v_wf_offenders jsonb := '[]'::jsonb;
  BEGIN
    FOREACH v_table_name IN ARRAY v_wf_tables LOOP
      SELECT relrowsecurity, relforcerowsecurity INTO v_rls_enabled, v_force_rls
        FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
       WHERE n.nspname = 'public' AND c.relname = v_table_name;
      IF NOT FOUND THEN
        v_wf_results := v_wf_results || jsonb_build_object('table_name', v_table_name, 'exists', false, 'relrowsecurity', false, 'relforcerowsecurity', false);
        v_wf_offenders := v_wf_offenders || jsonb_build_object('table_name', v_table_name, 'exists', false);
        v_wf_all_pass := false;
      ELSE
        v_wf_results := v_wf_results || jsonb_build_object('table_name', v_table_name, 'relrowsecurity', COALESCE(v_rls_enabled, false), 'relforcerowsecurity', COALESCE(v_force_rls, false));
        IF NOT COALESCE(v_rls_enabled, false) OR NOT COALESCE(v_force_rls, false) THEN
          v_wf_offenders := v_wf_offenders || jsonb_build_object('table_name', v_table_name, 'relrowsecurity', COALESCE(v_rls_enabled, false), 'relforcerowsecurity', COALESCE(v_force_rls, false));
          v_wf_all_pass := false;
        END IF;
      END IF;
    END LOOP;
    v_check := jsonb_build_object(
      'id', 'workflow_rls_force', 'severity', 'P0',
      'name', 'Workflow RLS + FORCE RLS Enabled', 'area', 'Security',
      'status', CASE WHEN v_wf_all_pass THEN 'PASS' ELSE 'FAIL' END,
      'expected', 'RLS enabled + forced on all 4 workflow tables',
      'actual', CASE WHEN v_wf_all_pass THEN 'All pass' ELSE format('%s table(s) missing', jsonb_array_length(v_wf_offenders)) END,
      'evidence', v_wf_results,
      'remediation', 'ALTER TABLE <table> ENABLE ROW LEVEL SECURITY; ALTER TABLE <table> FORCE ROW LEVEL SECURITY;',
      'offenders', CASE WHEN jsonb_array_length(v_wf_offenders) > 0 THEN v_wf_offenders ELSE NULL END
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 13: Guardrails Table Hardened (P1)
  -- ================================================================
  DECLARE
    v_gr_tables text[] := ARRAY['organization_guardrails'];
    v_gr_results jsonb := '[]'::jsonb;
    v_gr_all_pass boolean := true;
    v_gr_offenders jsonb := '[]'::jsonb;
    v_gr_priv record;
  BEGIN
    FOREACH v_table_name IN ARRAY v_gr_tables LOOP
      SELECT relrowsecurity, relforcerowsecurity INTO v_rls_enabled, v_force_rls
        FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
       WHERE n.nspname = 'public' AND c.relname = v_table_name;
      IF NOT FOUND THEN
        v_gr_results := v_gr_results || jsonb_build_object('table', v_table_name, 'exists', false);
        v_gr_offenders := v_gr_offenders || jsonb_build_object('table', v_table_name, 'issue', 'table not found');
        v_gr_all_pass := false;
      ELSE
        v_gr_results := v_gr_results || jsonb_build_object('table', v_table_name, 'rls', COALESCE(v_rls_enabled, false), 'force', COALESCE(v_force_rls, false));
        IF NOT COALESCE(v_rls_enabled, false) OR NOT COALESCE(v_force_rls, false) THEN
          v_gr_offenders := v_gr_offenders || jsonb_build_object('table', v_table_name, 'issue', 'RLS or FORCE missing', 'rls', COALESCE(v_rls_enabled, false), 'force', COALESCE(v_force_rls, false));
          v_gr_all_pass := false;
        END IF;
      END IF;
    END LOOP;
    FOR v_gr_priv IN
      SELECT grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'organization_guardrails'
        AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
        AND grantee IN ('authenticated', 'anon', 'public')
    LOOP
      v_gr_offenders := v_gr_offenders || jsonb_build_object('table', 'organization_guardrails', 'issue', 'write grant', 'grantee', v_gr_priv.grantee, 'privilege', v_gr_priv.privilege_type);
      v_gr_all_pass := false;
    END LOOP;

    v_check := jsonb_build_object(
      'id', 'guardrails_hardened', 'severity', 'P1',
      'name', 'Guardrails Table Hardened (RLS Forced, No Write Grants)', 'area', 'Security',
      'status', CASE WHEN v_gr_all_pass THEN 'PASS' ELSE 'FAIL' END,
      'expected', 'RLS enabled+forced, no INSERT/UPDATE/DELETE grants to authenticated/anon',
      'actual', CASE WHEN v_gr_all_pass THEN 'Hardened' ELSE format('%s issues', jsonb_array_length(v_gr_offenders)) END,
      'evidence', v_gr_results,
      'remediation', 'ALTER TABLE organization_guardrails FORCE ROW LEVEL SECURITY; REVOKE INSERT,UPDATE,DELETE ON organization_guardrails FROM authenticated;',
      'offenders', CASE WHEN jsonb_array_length(v_gr_offenders) > 0 THEN v_gr_offenders ELSE NULL END
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 14: Change Orders Tables Hardened (P1)
  -- ================================================================
  DECLARE
    v_co_tables text[] := ARRAY['change_orders', 'change_order_line_items'];
    v_co_results jsonb := '[]'::jsonb;
    v_co_all_pass boolean := true;
    v_co_offenders jsonb := '[]'::jsonb;
    v_co_priv record;
    v_co_policy record;
  BEGIN
    FOREACH v_table_name IN ARRAY v_co_tables LOOP
      SELECT relrowsecurity, relforcerowsecurity INTO v_rls_enabled, v_force_rls
        FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
       WHERE n.nspname = 'public' AND c.relname = v_table_name;
      IF NOT FOUND THEN
        v_co_results := v_co_results || jsonb_build_object('table', v_table_name, 'exists', false);
        v_co_offenders := v_co_offenders || jsonb_build_object('table', v_table_name, 'issue', 'table not found');
        v_co_all_pass := false;
      ELSE
        v_co_results := v_co_results || jsonb_build_object('table', v_table_name, 'rls', COALESCE(v_rls_enabled, false), 'force', COALESCE(v_force_rls, false));
        IF NOT COALESCE(v_rls_enabled, false) OR NOT COALESCE(v_force_rls, false) THEN
          v_co_offenders := v_co_offenders || jsonb_build_object('table', v_table_name, 'issue', 'RLS or FORCE missing');
          v_co_all_pass := false;
        END IF;
      END IF;
    END LOOP;
    FOR v_co_policy IN
      SELECT c.relname AS tbl, pol.polname, pol.polcmd,
        pg_get_expr(pol.polqual, pol.polrelid, true) AS qual,
        pg_get_expr(pol.polwithcheck, pol.polrelid, true) AS with_check
      FROM pg_policy pol
      JOIN pg_class c ON pol.polrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND c.relname = ANY(v_co_tables)
        AND pol.polpermissive = true
        AND pol.polcmd IN ('a', 'w', 'd')
    LOOP
      IF v_co_policy.qual IS NULL OR v_co_policy.qual != 'false' THEN
        IF v_co_policy.with_check IS NULL OR v_co_policy.with_check != 'false' THEN
          v_co_offenders := v_co_offenders || jsonb_build_object('table', v_co_policy.tbl, 'issue', 'permissive write policy', 'policy', v_co_policy.polname, 'cmd', v_co_policy.polcmd);
          v_co_all_pass := false;
        END IF;
      END IF;
    END LOOP;
    FOR v_co_priv IN
      SELECT table_name, grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = ANY(v_co_tables)
        AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
        AND grantee IN ('authenticated', 'anon', 'public')
    LOOP
      v_co_offenders := v_co_offenders || jsonb_build_object('table', v_co_priv.table_name, 'issue', 'write grant', 'grantee', v_co_priv.grantee, 'privilege', v_co_priv.privilege_type);
      v_co_all_pass := false;
    END LOOP;

    v_check := jsonb_build_object(
      'id', 'change_orders_hardened', 'severity', 'P1',
      'name', 'Change Orders Tables Hardened', 'area', 'Security',
      'status', CASE WHEN v_co_all_pass THEN 'PASS' ELSE 'FAIL' END,
      'expected', 'RLS forced, no permissive write policies, no write grants on change_orders + line_items',
      'actual', CASE WHEN v_co_all_pass THEN 'Hardened' ELSE format('%s issues', jsonb_array_length(v_co_offenders)) END,
      'evidence', v_co_results,
      'remediation', 'ALTER TABLE change_orders FORCE ROW LEVEL SECURITY; Ensure write policies use USING(false);',
      'offenders', CASE WHEN jsonb_array_length(v_co_offenders) > 0 THEN v_co_offenders ELSE NULL END
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 15: Cost Rollup Determinism (P1) — server-side
  -- ================================================================
  IF p_project_id IS NOT NULL THEN
    BEGIN
      DECLARE
        v_cr1 jsonb;
        v_cr2 jsonb;
      BEGIN
        v_cr1 := rpc_get_project_cost_rollup(p_project_id);
        v_cr2 := rpc_get_project_cost_rollup(p_project_id);
        v_check := jsonb_build_object(
          'id', 'cost_rollup_determinism_server', 'severity', 'P1',
          'name', 'Cost Rollup Determinism (Server)', 'area', 'Finance',
          'status', CASE WHEN v_cr1 = v_cr2 THEN 'PASS' ELSE 'FAIL' END,
          'expected', 'Two consecutive calls return identical JSON',
          'actual', CASE WHEN v_cr1 = v_cr2 THEN 'Deterministic' ELSE 'Non-deterministic' END,
          'evidence', jsonb_build_object('run1_hash', md5(v_cr1::text), 'run2_hash', md5(v_cr2::text)),
          'remediation', 'Check for non-deterministic queries in rpc_get_project_cost_rollup'
        );
        v_checks := v_checks || v_check;
      END;
    EXCEPTION WHEN OTHERS THEN
      v_check := jsonb_build_object(
        'id', 'cost_rollup_determinism_server', 'severity', 'P1',
        'name', 'Cost Rollup Determinism (Server)', 'area', 'Finance',
        'status', 'FAIL', 'expected', 'RPC runs', 'actual', SQLERRM, 'evidence', SQLERRM
      );
      v_checks := v_checks || v_check;
    END;
  END IF;

  -- ================================================================
  -- CHECK 16: Profit Risk Determinism (P1) — server-side
  -- ================================================================
  IF p_project_id IS NOT NULL THEN
    BEGIN
      DECLARE
        v_pr1 jsonb;
        v_pr2 jsonb;
      BEGIN
        v_pr1 := rpc_get_project_profit_risk(p_project_id);
        v_pr2 := rpc_get_project_profit_risk(p_project_id);
        v_check := jsonb_build_object(
          'id', 'profit_risk_determinism_server', 'severity', 'P1',
          'name', 'Profit Risk Determinism (Server)', 'area', 'Finance',
          'status', CASE WHEN v_pr1 = v_pr2 THEN 'PASS' ELSE 'FAIL' END,
          'expected', 'Two consecutive calls return identical JSON',
          'actual', CASE WHEN v_pr1 = v_pr2 THEN 'Deterministic' ELSE 'Non-deterministic' END,
          'evidence', jsonb_build_object('run1_hash', md5(v_pr1::text), 'run2_hash', md5(v_pr2::text)),
          'remediation', 'Check for non-deterministic queries in rpc_get_project_profit_risk'
        );
        v_checks := v_checks || v_check;
      END;
    EXCEPTION WHEN OTHERS THEN
      v_check := jsonb_build_object(
        'id', 'profit_risk_determinism_server', 'severity', 'P1',
        'name', 'Profit Risk Determinism (Server)', 'area', 'Finance',
        'status', 'FAIL', 'expected', 'RPC runs', 'actual', SQLERRM, 'evidence', SQLERRM
      );
      v_checks := v_checks || v_check;
    END;
  END IF;

  -- ================================================================
  -- CHECK 17: Pricing Intelligence Determinism (P1) — server-side
  -- ================================================================
  BEGIN
    DECLARE
      v_ps1 jsonb;
      v_ps2 jsonb;
    BEGIN
      v_ps1 := rpc_get_pricing_suggestions(10);
      v_ps2 := rpc_get_pricing_suggestions(10);
      v_check := jsonb_build_object(
        'id', 'pricing_intel_determinism_server', 'severity', 'P1',
        'name', 'Pricing Intelligence Determinism (Server)', 'area', 'Finance',
        'status', CASE WHEN v_ps1 = v_ps2 THEN 'PASS' ELSE 'FAIL' END,
        'expected', 'Two consecutive calls return identical JSON',
        'actual', CASE WHEN v_ps1 = v_ps2 THEN 'Deterministic' ELSE 'Non-deterministic' END,
        'evidence', jsonb_build_object('run1_hash', md5(v_ps1::text), 'run2_hash', md5(v_ps2::text)),
        'remediation', 'Check rpc_get_pricing_suggestions for non-determinism'
      );
      v_checks := v_checks || v_check;
    END;
  EXCEPTION WHEN OTHERS THEN
    v_check := jsonb_build_object(
      'id', 'pricing_intel_determinism_server', 'severity', 'P1',
      'name', 'Pricing Intelligence Determinism (Server)', 'area', 'Finance',
      'status', 'FAIL', 'expected', 'RPC runs', 'actual', SQLERRM, 'evidence', SQLERRM
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 18: AI Brain Integrity (P1) — uses rpc_run_ai_brain_test_runner
  -- ================================================================
  BEGIN
    -- Deterministic project/org selection: lowest UUID the caller can access
    SELECT p.id, p.organization_id INTO v_ai_project_id, v_ai_org_id
    FROM projects p
    JOIN organization_memberships om ON om.organization_id = p.organization_id AND om.user_id = auth.uid()
    ORDER BY p.id ASC
    LIMIT 1;

    IF v_ai_project_id IS NULL OR v_ai_org_id IS NULL THEN
      v_ai_brain := jsonb_build_object('skipped', true, 'reason', 'no_accessible_project');
      v_ai_brain_ok := false;
    ELSE
      v_ai_brain_result := public.rpc_run_ai_brain_test_runner(v_ai_project_id, v_ai_org_id);
      v_ai_brain_ok := COALESCE((v_ai_brain_result->>'ok')::boolean, false);
      v_ai_brain := jsonb_build_object(
        'project_id', v_ai_project_id,
        'org_id', v_ai_org_id,
        'ai_brain_ok', v_ai_brain_ok,
        'result', v_ai_brain_result
      );
    END IF;

    v_check := jsonb_build_object(
      'id', 'ai_brain_integrity',
      'severity', 'P1',
      'name', 'AI Brain Layer Integrity',
      'area', 'AI',
      'status', CASE WHEN v_ai_brain_ok THEN 'PASS' ELSE 'FAIL' END,
      'expected', 'All AI Brain views, functions, security, privileges, smoke tests, and determinism pass',
      'actual', CASE WHEN v_ai_brain_ok THEN 'All pass' ELSE 'One or more AI Brain checks failed' END,
      'evidence', v_ai_brain,
      'remediation', 'Review rpc_run_ai_brain_test_runner output for specific failures',
      'offenders', CASE WHEN NOT v_ai_brain_ok THEN v_ai_brain ELSE NULL END
    );
    v_checks := v_checks || v_check;
  EXCEPTION WHEN OTHERS THEN
    v_ai_brain_ok := false;
    v_check := jsonb_build_object(
      'id', 'ai_brain_integrity', 'severity', 'P1',
      'name', 'AI Brain Layer Integrity', 'area', 'AI',
      'status', 'FAIL', 'expected', 'AI Brain verification runs',
      'actual', SQLERRM, 'evidence', SQLERRM,
      'remediation', 'Fix error in rpc_run_ai_brain_test_runner or dependent views/functions'
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 19: Margin Edge-Case Suite presence (P2)
  -- Pure pg_proc existence check — no execution, no session required.
  -- ================================================================
  DECLARE
    v_edge_present boolean := false;
  BEGIN
    SELECT EXISTS (
      SELECT 1
      FROM   pg_proc p
      JOIN   pg_namespace n ON n.oid = p.pronamespace
      WHERE  n.nspname = 'public'
      AND    p.proname = 'rpc_run_margin_control_edge_cases'
      AND    p.pronargs = 1
    ) INTO v_edge_present;

    v_check := jsonb_build_object(
      'id',          'edge_case_suite_present',
      'severity',    'P2',
      'name',        'Margin Edge-Case Suite Registered',
      'area',        'Functions',
      'source',      'server',
      'status',      CASE WHEN v_edge_present THEN 'PASS' ELSE 'FAIL' END,
      'expected',    'rpc_run_margin_control_edge_cases(uuid) exists in public schema',
      'actual',      CASE WHEN v_edge_present THEN 'Present' ELSE 'Not found' END,
      'evidence',    jsonb_build_object('edge_case_suite_present', v_edge_present),
      'remediation', 'Run the migration that creates rpc_run_margin_control_edge_cases(p_org_id uuid)'
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- PERSIST
  -- ================================================================
  IF v_org_id IS NULL AND v_ai_org_id IS NOT NULL THEN
    v_org_id := v_ai_org_id;
  END IF;

  IF v_org_id IS NOT NULL THEN
    SELECT
      count(*) FILTER (WHERE (x->>'status') = 'PASS'),
      count(*) FILTER (WHERE (x->>'status') = 'FAIL'),
      count(*) FILTER (WHERE (x->>'status') = 'NEEDS_MANUAL'),
      count(*) FILTER (WHERE (x->>'status') = 'FAIL' AND (x->>'severity') = 'P0')
    INTO v_pass_count, v_fail_count, v_manual_count, v_p0_blockers
    FROM jsonb_array_elements(v_checks) AS x;

    INSERT INTO audit_run_history (run_id, organization_id, pass_count, fail_count, manual_count, p0_blockers, json_result)
    VALUES (v_run_id, v_org_id, v_pass_count, v_fail_count, v_manual_count, v_p0_blockers, v_checks);
  END IF;

  RETURN v_checks;
END;
$$;
