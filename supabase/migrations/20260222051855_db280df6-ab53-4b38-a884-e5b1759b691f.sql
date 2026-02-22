-- Grant execute to supabase_read_only_user so read-query tool can invoke it for diagnostics
GRANT EXECUTE ON FUNCTION public.rpc_debug_margin_control_inputs(uuid) TO supabase_read_only_user;