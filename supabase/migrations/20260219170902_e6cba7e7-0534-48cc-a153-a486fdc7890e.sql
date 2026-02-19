
CREATE OR REPLACE FUNCTION public.rpc_whoami()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'uid', auth.uid(),
    'role', auth.role()
  );
$$;

REVOKE ALL ON FUNCTION public.rpc_whoami() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_whoami() TO authenticated;
