
REVOKE ALL ON FUNCTION public.rpc_run_ai_brain_test_runner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_run_ai_brain_test_runner(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_run_ai_brain_test_runner(uuid, uuid) TO authenticated;
