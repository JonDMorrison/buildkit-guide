
-- Allow the service_role (used by read-query tool) to execute the test runner
GRANT EXECUTE ON FUNCTION public.rpc_run_ai_brain_test_runner(uuid, uuid) TO service_role;
