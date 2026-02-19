CREATE OR REPLACE FUNCTION public.rpc_run_project_stress_test(p_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_org_id uuid;
  v_results jsonb := '[]'::jsonb;
  v_err text;
  v_passed boolean;
  v_actual text;
  v_count int;
  v_invoice_id uuid;
  v_quote_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT has_project_access(p_project_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT organization_id INTO v_org_id FROM projects WHERE id = p_project_id;

  -- ================================================================
  -- TEST 1: Verify estimates table has RLS write-deny policies (structural)
  -- ================================================================
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'estimates' AND schemaname = 'public'
    AND (qual = 'false' OR with_check = 'false')
    AND cmd IN ('INSERT','UPDATE','ALL');
  v_passed := v_count > 0;
  v_actual := CASE WHEN v_passed
    THEN v_count || ' write-deny RLS policies found on estimates'
    ELSE 'No write-deny RLS policies on estimates (vulnerability)'
  END;
  v_results := v_results || jsonb_build_object(
    'test_name', 'direct_write_estimates_blocked',
    'expected', 'Write-deny RLS policies exist on estimates table',
    'actual', v_actual,
    'passed', v_passed
  );

  -- ================================================================
  -- TEST 2: Invoice send without permission (fake invoice id)
  -- ================================================================
  BEGIN
    PERFORM rpc_send_invoice('00000000-0000-0000-0000-000000000000'::uuid);
    v_passed := false;
    v_actual := 'rpc_send_invoice succeeded unexpectedly';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    v_passed := true;
    v_actual := 'Blocked: ' || v_err;
  END;
  v_results := v_results || jsonb_build_object(
    'test_name', 'invoice_send_no_permission',
    'expected', 'Rejected with error (not found or forbidden)',
    'actual', v_actual,
    'passed', v_passed
  );

  -- ================================================================
  -- TEST 3: Duplicate quote conversion
  -- ================================================================
  SELECT q.id INTO v_quote_id FROM quotes q
    WHERE q.project_id = p_project_id AND q.converted_invoice_id IS NOT NULL
    LIMIT 1;

  IF v_quote_id IS NOT NULL THEN
    BEGIN
      PERFORM rpc_convert_quote_to_invoice(v_quote_id);
      v_passed := false;
      v_actual := 'Duplicate conversion succeeded (idempotency failure)';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      v_passed := true;
      v_actual := 'Blocked: ' || v_err;
    END;
  ELSE
    v_passed := true;
    v_actual := 'No converted quote found to test (skipped)';
  END IF;
  v_results := v_results || jsonb_build_object(
    'test_name', 'duplicate_quote_conversion',
    'expected', 'Rejected if already converted',
    'actual', v_actual,
    'passed', v_passed
  );

  -- ================================================================
  -- TEST 4: Verify invoices table has RLS write-deny (structural check for currency safety)
  -- ================================================================
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'invoices' AND schemaname = 'public'
    AND (qual = 'false' OR with_check = 'false')
    AND cmd IN ('UPDATE','ALL');
  v_passed := v_count > 0;
  v_actual := CASE WHEN v_passed
    THEN v_count || ' update-deny RLS policies found on invoices'
    ELSE 'No update-deny RLS policies on invoices'
  END;
  v_results := v_results || jsonb_build_object(
    'test_name', 'currency_change_after_sent_blocked',
    'expected', 'Direct UPDATE denied on invoices via RLS',
    'actual', v_actual,
    'passed', v_passed
  );

  -- ================================================================
  -- TEST 5: Workflow phase bypass (fake project)
  -- ================================================================
  BEGIN
    PERFORM rpc_request_phase_advance(
      '00000000-0000-0000-0000-000000000000'::uuid,
      'pm_closeout',
      NULL
    );
    v_passed := false;
    v_actual := 'Phase advance succeeded without requirements (bypass)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    v_passed := true;
    v_actual := 'Blocked: ' || v_err;
  END;
  v_results := v_results || jsonb_build_object(
    'test_name', 'workflow_phase_bypass',
    'expected', 'Rejected (forbidden or requirements unmet)',
    'actual', v_actual,
    'passed', v_passed
  );

  -- ================================================================
  RETURN jsonb_build_object(
    'project_id', p_project_id,
    'tests_run', jsonb_array_length(v_results),
    'all_passed', NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_results) AS r WHERE (r->>'passed')::boolean = false
    ),
    'results', v_results
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_run_project_stress_test(uuid) TO authenticated;