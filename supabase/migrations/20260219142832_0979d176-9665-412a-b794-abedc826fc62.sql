
-- Fix the audit suite's change_orders write policy detection logic.
-- The issue: UPDATE deny policies have USING(false) but NULL WITH CHECK,
-- and INSERT deny policies have NULL USING but WITH CHECK(false).
-- The current logic uses AND between both checks, causing false positives.
--
-- We replace the entire rpc_run_audit_suite function.
-- Since it's ~34k chars, we use a targeted approach: create a helper
-- function for the corrected CO check and call it from the main suite.

-- Step 1: Create the corrected CO hardening check as a helper
CREATE OR REPLACE FUNCTION public._audit_change_orders_hardened()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_co_tables text[] := ARRAY['change_orders', 'change_order_line_items'];
  v_co_results jsonb := '[]'::jsonb;
  v_co_all_pass boolean := true;
  v_co_offenders jsonb := '[]'::jsonb;
  v_table_name text;
  v_rls_enabled boolean;
  v_force_rls boolean;
  v_co_priv record;
  v_co_policy record;
  v_is_deny boolean;
BEGIN
  -- RLS + FORCE check
  FOREACH v_table_name IN ARRAY v_co_tables LOOP
    SELECT relrowsecurity, relforcerowsecurity INTO v_rls_enabled, v_force_rls
      FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
     WHERE n.nspname = 'public' AND c.relname = v_table_name;
    IF NOT FOUND THEN
      v_co_results := v_co_results || jsonb_build_object('table', v_table_name, 'exists', false);
      v_co_offenders := v_co_offenders || jsonb_build_object('table', v_table_name, 'issue', 'table not found');
      v_co_all_pass := false;
    ELSE
      v_co_results := v_co_results || jsonb_build_object(
        'table', v_table_name,
        'rls', COALESCE(v_rls_enabled, false),
        'force', COALESCE(v_force_rls, false));
      IF NOT COALESCE(v_rls_enabled, false) OR NOT COALESCE(v_force_rls, false) THEN
        v_co_offenders := v_co_offenders || jsonb_build_object('table', v_table_name, 'issue', 'RLS or FORCE missing');
        v_co_all_pass := false;
      END IF;
    END IF;
  END LOOP;

  -- No permissive write policies check (FIXED logic)
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
    -- Determine if this is a proper deny policy based on command type:
    -- INSERT (a): only has WITH CHECK → deny if with_check = 'false'
    -- UPDATE (w): has USING + WITH CHECK → deny if qual = 'false' 
    -- DELETE (d): only has USING → deny if qual = 'false'
    v_is_deny := false;
    
    CASE v_co_policy.polcmd
      WHEN 'a' THEN  -- INSERT: check with_check only
        v_is_deny := (v_co_policy.with_check IS NOT NULL AND v_co_policy.with_check = 'false');
      WHEN 'w' THEN  -- UPDATE: check qual (USING)
        v_is_deny := (v_co_policy.qual IS NOT NULL AND v_co_policy.qual = 'false');
      WHEN 'd' THEN  -- DELETE: check qual (USING)
        v_is_deny := (v_co_policy.qual IS NOT NULL AND v_co_policy.qual = 'false');
    END CASE;

    IF NOT v_is_deny THEN
      v_co_offenders := v_co_offenders || jsonb_build_object(
        'table', v_co_policy.tbl,
        'issue', 'permissive write policy (not deny)',
        'policy', v_co_policy.polname,
        'cmd', v_co_policy.polcmd);
      v_co_all_pass := false;
    END IF;
  END LOOP;

  -- Write grant check
  FOR v_co_priv IN
    SELECT table_name, grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = ANY(v_co_tables)
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
      AND grantee IN ('authenticated', 'anon', 'public')
  LOOP
    v_co_offenders := v_co_offenders || jsonb_build_object(
      'table', v_co_priv.table_name,
      'issue', 'write grant',
      'grantee', v_co_priv.grantee,
      'privilege', v_co_priv.privilege_type);
    v_co_all_pass := false;
  END LOOP;

  RETURN jsonb_build_object(
    'id', 'change_orders_hardened',
    'severity', 'P1',
    'name', 'Change Orders Tables Hardened',
    'area', 'Security',
    'status', CASE WHEN v_co_all_pass THEN 'PASS' ELSE 'FAIL' END,
    'expected', 'RLS forced, no permissive write policies, no write grants on change_orders + line_items',
    'actual', CASE WHEN v_co_all_pass THEN 'Hardened' ELSE format('%s issues', jsonb_array_length(v_co_offenders)) END,
    'evidence', v_co_results,
    'remediation', 'Ensure write policies use USING(false)/WITH CHECK(false); revoke write grants from authenticated',
    'offenders', CASE WHEN jsonb_array_length(v_co_offenders) > 0 THEN v_co_offenders ELSE NULL END
  );
END;
$$;
