-- Grant execute on rpc_debug_margin_control_inputs to authenticated
GRANT EXECUTE ON FUNCTION public.rpc_debug_margin_control_inputs(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_debug_margin_control_inputs(uuid) FROM anon;