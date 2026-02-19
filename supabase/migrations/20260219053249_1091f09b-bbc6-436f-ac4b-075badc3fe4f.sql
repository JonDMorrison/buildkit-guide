CREATE OR REPLACE FUNCTION public.rpc_check_workflow_write_deny()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables text[] := ARRAY['workflow_phases', 'workflow_phase_requirements', 'project_workflows', 'project_workflow_steps'];
  v_table text;
  v_details jsonb := '{}'::jsonb;
  v_all_pass boolean := true;
  v_rls_enabled boolean;
  v_force_rls boolean;
  v_has_permissive_write boolean;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    -- Check RLS flags
    SELECT c.relrowsecurity, c.relforcerowsecurity
      INTO v_rls_enabled, v_force_rls
      FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
     WHERE n.nspname = 'public' AND c.relname = v_table;

    IF NOT FOUND THEN
      v_details := v_details || jsonb_build_object(v_table, jsonb_build_object(
        'exists', false, 'rls', false, 'force', false, 'permissive_writes', false));
      v_all_pass := false;
      CONTINUE;
    END IF;

    -- Check for permissive INSERT/UPDATE/DELETE policies granted to authenticated or public
    SELECT EXISTS(
      SELECT 1
      FROM pg_policy pol
      JOIN pg_class c ON pol.polrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND c.relname = v_table
        AND pol.polpermissive = true
        AND pol.polcmd IN ('a', 'w', 'd')  -- INSERT, UPDATE, DELETE
        AND pol.polqual::text NOT LIKE '%false%'  -- exclude deny-all policies (USING (false))
    ) INTO v_has_permissive_write;

    v_details := v_details || jsonb_build_object(v_table, jsonb_build_object(
      'exists', true,
      'rls', COALESCE(v_rls_enabled, false),
      'force', COALESCE(v_force_rls, false),
      'permissive_writes', v_has_permissive_write));

    IF NOT COALESCE(v_rls_enabled, false) OR NOT COALESCE(v_force_rls, false) OR v_has_permissive_write THEN
      v_all_pass := false;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('pass', v_all_pass, 'details', v_details);
END;
$$;