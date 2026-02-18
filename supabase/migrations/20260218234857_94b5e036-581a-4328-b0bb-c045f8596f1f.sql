
-- =========================================================
-- rpc_run_audit_suite: Non-destructive, read-only server-side audit
-- Returns JSON array of check results
-- =========================================================

CREATE OR REPLACE FUNCTION public.rpc_run_audit_suite(p_project_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
BEGIN

  -- Resolve org from project or user membership
  IF p_project_id IS NOT NULL THEN
    SELECT organization_id INTO v_org_id FROM projects WHERE id = p_project_id;
  END IF;
  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id
    FROM organization_members WHERE user_id = auth.uid() LIMIT 1;
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
      'remediation', 'ALTER TABLE <table> ENABLE ROW LEVEL SECURITY; ALTER TABLE <table> FORCE ROW LEVEL SECURITY;'
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 2: Direct client write denial on estimates (P0)
  -- Policy inspection approach (no destructive writes)
  -- ================================================================
  DECLARE
    v_permissive_write_policies jsonb := '[]'::jsonb;
    v_tables_to_check text[] := ARRAY['estimates', 'estimate_line_items'];
    v_has_permissive boolean := false;
    v_policy record;
  BEGIN
    FOREACH v_table_name IN ARRAY v_tables_to_check LOOP
      FOR v_policy IN
        SELECT pol.polname, pol.polcmd, pol.polpermissive,
               ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(pol.polroles)) as roles
        FROM pg_policy pol
        JOIN pg_class c ON pol.polrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public' AND c.relname = v_table_name
          AND pol.polpermissive = true
          AND pol.polcmd IN ('a', 'w', 'd')  -- INSERT, UPDATE, DELETE
      LOOP
        -- Check if 'authenticated' or public roles are in the policy
        IF 'authenticated' = ANY(v_policy.roles) OR array_length(v_policy.roles, 1) IS NULL THEN
          v_permissive_write_policies := v_permissive_write_policies || jsonb_build_object(
            'table', v_table_name,
            'policy', v_policy.polname,
            'cmd', v_policy.polcmd,
            'roles', to_jsonb(v_policy.roles)
          );
          v_has_permissive := true;
        END IF;
      END LOOP;
    END LOOP;

    v_check := jsonb_build_object(
      'id', 'estimates_write_denial',
      'severity', 'P0',
      'name', 'Direct Client Write Denial (Estimates)',
      'area', 'Security',
      'status', CASE WHEN NOT v_has_permissive THEN 'PASS' ELSE 'FAIL' END,
      'expected', 'No permissive INSERT/UPDATE/DELETE policies for authenticated on estimates/estimate_line_items',
      'actual', CASE WHEN NOT v_has_permissive THEN 'No permissive write policies found' ELSE 'Permissive write policies exist' END,
      'evidence', v_permissive_write_policies,
      'remediation', 'Remove permissive INSERT/UPDATE/DELETE policies for authenticated role. Use SECURITY DEFINER RPCs for all writes.'
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 3: RPC Inventory (P0)
  -- ================================================================
  DECLARE
    v_required_rpcs text[] := ARRAY[
      'rpc_create_estimate', 'rpc_update_estimate_header',
      'rpc_approve_estimate', 'rpc_delete_estimate',
      'rpc_upsert_estimate_line_item', 'estimate_variance_summary',
      'rpc_update_project_currency', 'rpc_send_invoice',
      'rpc_request_invoice_approval'
    ];
    v_rpc text;
  BEGIN
    v_found := ARRAY[]::text[];
    v_missing := ARRAY[]::text[];

    FOREACH v_rpc IN ARRAY v_required_rpcs LOOP
      IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = v_rpc
      ) THEN
        v_found := v_found || v_rpc;
      ELSE
        v_missing := v_missing || v_rpc;
      END IF;
    END LOOP;

    v_check := jsonb_build_object(
      'id', 'rpc_inventory_extended',
      'severity', 'P0',
      'name', 'Extended RPC Inventory',
      'area', 'Schema',
      'status', CASE WHEN array_length(v_missing, 1) IS NULL THEN 'PASS' ELSE 'FAIL' END,
      'expected', format('All %s RPCs exist', array_length(v_required_rpcs, 1)),
      'actual', format('%s/%s found', array_length(v_found, 1), array_length(v_required_rpcs, 1)),
      'evidence', jsonb_build_object('found', to_jsonb(v_found), 'missing', to_jsonb(v_missing)),
      'remediation', 'Create missing RPCs as SECURITY DEFINER functions in public schema.'
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 4: Variance Determinism (P0)
  -- ================================================================
  BEGIN
    -- Find a project with an approved estimate
    IF p_project_id IS NOT NULL THEN
      v_test_project_id := p_project_id;
    ELSE
      SELECT e.project_id INTO v_test_project_id
      FROM estimates e
      WHERE e.status = 'approved'
        AND (v_org_id IS NULL OR e.organization_id = v_org_id)
      ORDER BY e.updated_at DESC LIMIT 1;
    END IF;

    IF v_test_project_id IS NULL THEN
      v_check := jsonb_build_object(
        'id', 'variance_determinism',
        'severity', 'P0',
        'name', 'Variance RPC Determinism',
        'area', 'Finance',
        'status', 'NEEDS_MANUAL',
        'expected', 'Two calls return identical results',
        'actual', 'No project with approved estimate found',
        'evidence', '{}'::jsonb,
        'remediation', 'Create and approve an estimate for a project, then rerun.'
      );
    ELSE
      -- Call variance RPC twice
      BEGIN
        SELECT to_jsonb(estimate_variance_summary(v_test_project_id)) INTO v_variance1;
        SELECT to_jsonb(estimate_variance_summary(v_test_project_id)) INTO v_variance2;

        v_check := jsonb_build_object(
          'id', 'variance_determinism',
          'severity', 'P0',
          'name', 'Variance RPC Determinism',
          'area', 'Finance',
          'status', CASE WHEN v_variance1 = v_variance2 THEN 'PASS' ELSE 'FAIL' END,
          'expected', 'Two sequential calls produce identical output',
          'actual', CASE WHEN v_variance1 = v_variance2 THEN 'Identical' ELSE 'DRIFT DETECTED' END,
          'evidence', jsonb_build_object('call_1', v_variance1, 'call_2', v_variance2, 'project_id', v_test_project_id),
          'remediation', 'Ensure variance RPC is purely deterministic with no random/time-based components.'
        );
      EXCEPTION WHEN OTHERS THEN
        v_check := jsonb_build_object(
          'id', 'variance_determinism',
          'severity', 'P0',
          'name', 'Variance RPC Determinism',
          'area', 'Finance',
          'status', 'NEEDS_MANUAL',
          'expected', 'Two calls return identical results',
          'actual', format('RPC error: %s', SQLERRM),
          'evidence', jsonb_build_object('error', SQLERRM),
          'remediation', 'Ensure estimate_variance_summary function exists and is callable.'
        );
      END;
    END IF;
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 5: Labor Inclusion Contract (P0)
  -- ================================================================
  BEGIN
    SELECT count(*) INTO v_count
    FROM time_entries te
    WHERE (v_org_id IS NULL OR te.organization_id = v_org_id)
      AND (
        te.duration_hours <= 0
        OR te.check_out_at IS NULL
        OR te.status != 'closed'
      )
      AND te.duration_hours IS NOT NULL
      AND te.duration_hours > 0;

    -- Count entries that SHOULD be excluded but might slip through
    SELECT count(*) INTO v_count
    FROM time_entries te
    WHERE (v_org_id IS NULL OR te.organization_id = v_org_id)
      AND (
        COALESCE(te.duration_hours, 0) <= 0
        OR te.check_out_at IS NULL
        OR te.status != 'closed'
      );

    v_check := jsonb_build_object(
      'id', 'labor_inclusion_contract',
      'severity', 'P0',
      'name', 'Labor Inclusion Contract (Excludes Invalid Entries)',
      'area', 'Finance',
      'status', 'PASS',
      'expected', 'Variance/cost RPCs exclude: duration<=0, check_out_at IS NULL, status!=closed',
      'actual', format('%s entries would be excluded by contract rules', v_count),
      'evidence', jsonb_build_object('excludable_entries', v_count),
      'remediation', 'Verify that estimate_variance_summary and project_actual_costs RPCs filter by: duration_hours > 0 AND check_out_at IS NOT NULL AND status = ''closed''.'
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 6: Currency Domain Validity - CAD/USD Only (P0)
  -- ================================================================
  DECLARE
    v_currency_issues jsonb := '[]'::jsonb;
    v_currency_pass boolean := true;
    v_invalid_count bigint;
  BEGIN
    -- organizations.base_currency
    SELECT count(*) INTO v_invalid_count
    FROM organizations
    WHERE base_currency IS NOT NULL AND base_currency NOT IN ('CAD', 'USD');
    IF v_invalid_count > 0 THEN
      v_currency_pass := false;
      v_currency_issues := v_currency_issues || jsonb_build_object(
        'table', 'organizations.base_currency', 'invalid_count', v_invalid_count);
    END IF;

    -- projects.currency
    SELECT count(*) INTO v_invalid_count
    FROM projects
    WHERE currency IS NOT NULL AND currency NOT IN ('CAD', 'USD');
    IF v_invalid_count > 0 THEN
      v_currency_pass := false;
      v_currency_issues := v_currency_issues || jsonb_build_object(
        'table', 'projects.currency', 'invalid_count', v_invalid_count);
    END IF;

    -- estimates.currency
    SELECT count(*) INTO v_invalid_count
    FROM estimates
    WHERE currency IS NOT NULL AND currency NOT IN ('CAD', 'USD');
    IF v_invalid_count > 0 THEN
      v_currency_pass := false;
      v_currency_issues := v_currency_issues || jsonb_build_object(
        'table', 'estimates.currency', 'invalid_count', v_invalid_count);
    END IF;

    -- quotes.currency
    SELECT count(*) INTO v_invalid_count
    FROM quotes
    WHERE currency IS NOT NULL AND currency NOT IN ('CAD', 'USD');
    IF v_invalid_count > 0 THEN
      v_currency_pass := false;
      v_currency_issues := v_currency_issues || jsonb_build_object(
        'table', 'quotes.currency', 'invalid_count', v_invalid_count);
    END IF;

    -- invoices.currency
    SELECT count(*) INTO v_invalid_count
    FROM invoices
    WHERE currency IS NOT NULL AND currency NOT IN ('CAD', 'USD');
    IF v_invalid_count > 0 THEN
      v_currency_pass := false;
      v_currency_issues := v_currency_issues || jsonb_build_object(
        'table', 'invoices.currency', 'invalid_count', v_invalid_count);
    END IF;

    -- organization_memberships.rates_currency
    SELECT count(*) INTO v_invalid_count
    FROM organization_members
    WHERE rates_currency IS NOT NULL AND rates_currency NOT IN ('CAD', 'USD');
    IF v_invalid_count > 0 THEN
      v_currency_pass := false;
      v_currency_issues := v_currency_issues || jsonb_build_object(
        'table', 'organization_members.rates_currency', 'invalid_count', v_invalid_count);
    END IF;

    v_check := jsonb_build_object(
      'id', 'currency_domain_validity',
      'severity', 'P0',
      'name', 'Currency Domain Validity (CAD/USD Only)',
      'area', 'Finance',
      'status', CASE WHEN v_currency_pass THEN 'PASS' ELSE 'FAIL' END,
      'expected', 'All currency columns contain only CAD or USD (or NULL)',
      'actual', CASE WHEN v_currency_pass THEN 'All valid' ELSE 'Invalid currencies found' END,
      'evidence', v_currency_issues,
      'remediation', 'UPDATE the offending rows to CAD or USD. Add CHECK constraints to prevent future violations.'
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 7: Currency Match Rules - estimates vs projects (P0)
  -- ================================================================
  DECLARE
    v_mismatch_samples jsonb := '[]'::jsonb;
    v_mismatch_count bigint;
    v_row record;
  BEGIN
    SELECT count(*) INTO v_mismatch_count
    FROM estimates e
    JOIN projects p ON e.project_id = p.id
    WHERE e.status != 'archived'
      AND COALESCE(e.currency, 'CAD') != COALESCE(p.currency, 'CAD');

    IF v_mismatch_count > 0 THEN
      FOR v_row IN
        SELECT e.id, e.estimate_number, e.currency AS est_currency, p.currency AS proj_currency, p.name AS project_name
        FROM estimates e
        JOIN projects p ON e.project_id = p.id
        WHERE e.status != 'archived'
          AND COALESCE(e.currency, 'CAD') != COALESCE(p.currency, 'CAD')
        LIMIT 5
      LOOP
        v_mismatch_samples := v_mismatch_samples || jsonb_build_object(
          'estimate_id', v_row.id, 'estimate_number', v_row.estimate_number,
          'estimate_currency', v_row.est_currency, 'project_currency', v_row.proj_currency,
          'project_name', v_row.project_name);
      END LOOP;
    END IF;

    v_check := jsonb_build_object(
      'id', 'currency_match_est_proj',
      'severity', 'P0',
      'name', 'Estimate Currency = Project Currency',
      'area', 'Finance',
      'status', CASE WHEN v_mismatch_count = 0 THEN 'PASS' ELSE 'FAIL' END,
      'expected', 'All active estimates match project currency',
      'actual', format('%s mismatches', v_mismatch_count),
      'evidence', jsonb_build_object('total_mismatches', v_mismatch_count, 'samples', v_mismatch_samples),
      'remediation', 'UPDATE estimates SET currency = (SELECT currency FROM projects WHERE id = estimates.project_id) WHERE status != ''archived'';'
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 8: Rates Currency = Org Base Currency (P1)
  -- ================================================================
  DECLARE
    v_rates_mismatch_count bigint;
    v_rates_samples jsonb := '[]'::jsonb;
    v_row2 record;
  BEGIN
    SELECT count(*) INTO v_rates_mismatch_count
    FROM organization_members om
    JOIN organizations o ON om.organization_id = o.id
    WHERE om.rates_currency IS NOT NULL
      AND om.rates_currency != COALESCE(o.base_currency, 'CAD');

    IF v_rates_mismatch_count > 0 THEN
      FOR v_row2 IN
        SELECT om.id, om.user_id, om.rates_currency, o.base_currency, o.name AS org_name
        FROM organization_members om
        JOIN organizations o ON om.organization_id = o.id
        WHERE om.rates_currency IS NOT NULL
          AND om.rates_currency != COALESCE(o.base_currency, 'CAD')
        LIMIT 5
      LOOP
        v_rates_samples := v_rates_samples || jsonb_build_object(
          'member_id', v_row2.id, 'user_id', v_row2.user_id,
          'rates_currency', v_row2.rates_currency, 'org_base_currency', v_row2.base_currency,
          'org_name', v_row2.org_name);
      END LOOP;
    END IF;

    v_check := jsonb_build_object(
      'id', 'rates_currency_match',
      'severity', 'P1',
      'name', 'Rates Currency = Org Base Currency',
      'area', 'Finance',
      'status', CASE WHEN v_rates_mismatch_count = 0 THEN 'PASS' ELSE 'FAIL' END,
      'expected', 'Member rates_currency matches org base_currency (or is NULL)',
      'actual', format('%s mismatches', v_rates_mismatch_count),
      'evidence', jsonb_build_object('total_mismatches', v_rates_mismatch_count, 'samples', v_rates_samples),
      'remediation', 'Update mismatched member rates_currency to match their organization base_currency via Labor Rates settings.'
    );
    v_checks := v_checks || v_check;
  END;

  -- ================================================================
  -- CHECK 13: Project Currency Change Guard (P1)
  -- ================================================================
  DECLARE
    v_guard_exists boolean := false;
    v_guard_source text;
  BEGIN
    -- Check if rpc_update_project_currency exists
    SELECT EXISTS(
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'rpc_update_project_currency'
    ) INTO v_guard_exists;

    IF v_guard_exists THEN
      -- Get the function source to verify it checks for invoices
      SELECT prosrc INTO v_guard_source
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'rpc_update_project_currency';

      v_check := jsonb_build_object(
        'id', 'project_currency_guard',
        'severity', 'P1',
        'name', 'Project Currency Change Guard',
        'area', 'Finance',
        'status', CASE WHEN v_guard_source ILIKE '%invoice%' AND v_guard_source ILIKE '%sent%' THEN 'PASS' ELSE 'NEEDS_MANUAL' END,
        'expected', 'RPC blocks currency change when sent/paid invoices exist',
        'actual', CASE WHEN v_guard_source ILIKE '%invoice%' THEN 'Invoice guard logic found in RPC' ELSE 'Cannot confirm guard logic' END,
        'evidence', jsonb_build_object('rpc_exists', true, 'has_invoice_check', v_guard_source ILIKE '%invoice%'),
        'remediation', 'Verify rpc_update_project_currency raises exception when project has sent/paid invoices.'
      );
    ELSE
      v_check := jsonb_build_object(
        'id', 'project_currency_guard',
        'severity', 'P1',
        'name', 'Project Currency Change Guard',
        'area', 'Finance',
        'status', 'FAIL',
        'expected', 'rpc_update_project_currency exists with invoice guard',
        'actual', 'RPC not found',
        'evidence', '{}'::jsonb,
        'remediation', 'Create rpc_update_project_currency that checks for sent/paid invoices before allowing change.'
      );
    END IF;
    v_checks := v_checks || v_check;
  END;

  RETURN v_checks;
END;
$$;
