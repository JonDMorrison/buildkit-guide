
-- PostgREST requires authenticator to be able to see/execute functions
GRANT EXECUTE ON FUNCTION public.rpc_run_ai_brain_test_runner(uuid, uuid) TO authenticator;
GRANT EXECUTE ON FUNCTION public.rpc_generate_project_margin_control(uuid) TO authenticator;
GRANT EXECUTE ON FUNCTION public.rpc_get_operating_system_score(uuid) TO authenticator;
GRANT EXECUTE ON FUNCTION public.rpc_get_executive_dashboard(uuid) TO authenticator;
GRANT EXECUTE ON FUNCTION public.rpc_is_org_member(uuid) TO authenticator;
