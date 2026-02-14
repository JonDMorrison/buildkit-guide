-- Function to check RLS status and policies for given tables
CREATE OR REPLACE FUNCTION public.check_rls_status(p_tables text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  rec record;
BEGIN
  FOR rec IN
    SELECT
      c.relname AS table_name,
      c.relrowsecurity AS rls_enabled,
      COALESCE(
        (SELECT jsonb_agg(pp.policyname ORDER BY pp.policyname)
         FROM pg_policies pp
         WHERE pp.schemaname = 'public' AND pp.tablename = c.relname),
        '[]'::jsonb
      ) AS policy_names,
      COALESCE(
        (SELECT count(*)::int
         FROM pg_policies pp
         WHERE pp.schemaname = 'public' AND pp.tablename = c.relname),
        0
      ) AS policy_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY(p_tables)
      AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    result := result || jsonb_build_object(
      'table_name', rec.table_name,
      'rls_enabled', rec.rls_enabled,
      'policy_count', rec.policy_count,
      'policy_names', rec.policy_names
    );
  END LOOP;

  RETURN result;
END;
$$;