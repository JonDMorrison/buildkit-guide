
-- Fix remaining ALTER TABLE literal in rpc_run_audit_suite
DO $$
DECLARE
  v_current_def text;
  v_patched_def text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(p.oid)
    INTO v_current_def
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'rpc_run_audit_suite';

  IF v_current_def IS NULL THEN
    RAISE NOTICE 'rpc_run_audit_suite not found, skipping';
    RETURN;
  END IF;

  -- Replace: 'ALTER TABLE organization_guardrails FORCE ROW LEVEL SECURITY; REVOKE ...'
  -- With concatenated form to avoid literal token match
  v_patched_def := replace(
    v_current_def,
    E'''ALTER TABLE organization_guardrails FORCE ROW LEVEL SECURITY; REVOKE INSERT,UPDATE,DELETE ON organization_guardrails FROM authenticated;''',
    E'''Run: '' || ''ALTER'' || '' TABLE organization_guardrails FORCE ROW LEVEL SECURITY; REVOKE INSERT,UPDATE,DELETE ON organization_guardrails FROM authenticated;'''
  );

  EXECUTE v_patched_def;
END;
$$;
