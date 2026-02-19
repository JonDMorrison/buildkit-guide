
-- Create a view to expose function metadata (PostgREST auto-exposes views)
CREATE OR REPLACE VIEW public.v_rpc_metadata AS
SELECT p.proname as function_name,
       p.prosecdef as security_definer,
       pg_get_function_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f';

-- Grant read access
GRANT SELECT ON public.v_rpc_metadata TO authenticated, anon;

-- Force PostgREST reload
NOTIFY pgrst, 'reload schema';
