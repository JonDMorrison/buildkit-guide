
-- Helper RPC for audit: check if a function exists in pg_proc
CREATE OR REPLACE FUNCTION public._check_function_exists(
  p_function_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'exists', true,
    'security_definer', p.prosecdef,
    'args', pg_get_function_arguments(p.oid),
    'return_type', pg_get_function_result(p.oid)
  ) INTO v_result
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = p_function_name
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  RETURN v_result;
END;
$$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
