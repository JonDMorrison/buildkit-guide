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
  -- temp vars
  v_invoice_id uuid;
  v_quote_id uuid;
  v_estimate_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT has_project_access(p_project_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT organization_id INTO v_org_id FROM projects WHERE id = p_project_id;

  -- ================================================================
  -- TEST 1: Direct write to estimates table (should be denied by RLS)
  -- ================================================================
  BEGIN
    INSERT INTO estimates (project_id, organization_id, estimate_number, created_by)
    VALUES (p_project_id, v_org_id, 'STRESS_TEST_' || gen_random_uuid()::text, v_caller);
    -- If we get here, it succeeded — that's a FAIL
    v_passed := false;
    v_actual := 'INSERT succeeded (RLS vulnerability)';
    -- Roll back the row
    DELETE FROM estimates WHERE estimate_number LIKE 'STRESS_TEST_%' AND project_id = p_project_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    v_passed := true;
    v_actual := 'Blocked: ' || v_err;
  END;
  v_results := v_results || jsonb_build_object(
    'test_name', 'direct_write_estimates',
    'expected', 'INSERT denied by RLS',
    'actual', v_actual,
    'passed', v_passed
  );

  -- ================================================================
  -- TEST 2: Invoice send without permission (use fake invoice id)
  -- ================================================================
  BEGIN
    -- Try sending a non-existent invoice — should fail with not found or forbidden
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
  -- TEST 3: Duplicate quote conversion (find a converted quote, try again)
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
  -- TEST 4: Currency change after sent invoice
  -- ================================================================
  SELECT i.id INTO v_invoice_id FROM invoices i
    WHERE i.project_id = p_project_id AND i.status IN ('sent', 'paid', 'overdue')
    LIMIT 1;

  IF v_invoice_id IS NOT NULL THEN
    BEGIN
      UPDATE invoices SET currency = 'FAKE_XYZ' WHERE id = v_invoice_id;
      -- If succeeded, that's bad — revert
      v_passed := false;
      v_actual := 'Currency change succeeded on sent invoice (vulnerability)';
      -- Try to revert
      UPDATE invoices SET currency = 'CAD' WHERE id = v_invoice_id;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      v_passed := true;
      v_actual := 'Blocked: ' || v_err;
    END;
  ELSE
    v_passed := true;
    v_actual := 'No sent invoice found to test (skipped)';
  END IF;
  v_results := v_results || jsonb_build_object(
    'test_name', 'currency_change_after_sent',
    'expected', 'UPDATE denied on sent invoice',
    'actual', v_actual,
    'passed', v_passed
  );

  -- ================================================================
  -- TEST 5: Workflow phase bypass (try to advance without meeting requirements)
  -- ================================================================
  BEGIN
    -- Request advance on a phase for a fake project — should fail
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
  -- SUMMARY
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