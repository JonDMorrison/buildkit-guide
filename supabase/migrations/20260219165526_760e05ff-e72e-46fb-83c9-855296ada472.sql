
-- Temporary: allow postgres to call the chain for testing
GRANT EXECUTE ON FUNCTION public.rpc_generate_project_margin_control(uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.rpc_get_operating_system_score(uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.rpc_get_executive_dashboard(uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.rpc_is_org_member(uuid) TO postgres;
