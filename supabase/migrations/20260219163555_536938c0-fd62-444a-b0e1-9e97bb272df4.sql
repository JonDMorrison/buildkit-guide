
-- Function: public.rpc_is_org_member(uuid)
-- Deterministic membership check, SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.rpc_is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_table text;
  v_org_col text;
  v_status_col text;
  v_sql text;
  v_result boolean;
BEGIN
  -- Detect membership table (priority order)
  SELECT t.table_name INTO v_table
  FROM (
    VALUES
      (1, 'organization_members'),
      (2, 'organization_memberships'),
      (3, 'organization_users'),
      (4, 'org_members'),
      (5, 'org_users'),
      (6, 'memberships'),
      (7, 'user_org_roles')
  ) AS t(priority, table_name)
  WHERE EXISTS (
    SELECT 1 FROM information_schema.tables ist
    WHERE ist.table_schema = 'public' AND ist.table_name = t.table_name
  )
  ORDER BY t.priority
  LIMIT 1;

  IF v_table IS NULL THEN
    RAISE EXCEPTION 'membership_table_not_found';
  END IF;

  -- Detect org id column: prefer org_id, then organization_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'org_id'
  ) THEN
    v_org_col := 'org_id';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'organization_id'
  ) THEN
    v_org_col := 'organization_id';
  ELSE
    RAISE EXCEPTION 'membership_table_not_found';
  END IF;

  -- Detect status column (is_active or status)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'is_active'
  ) THEN
    v_status_col := 'is_active';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'status'
  ) THEN
    v_status_col := 'status';
  ELSE
    v_status_col := NULL;
  END IF;

  -- Build query
  v_sql := format(
    'SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I = $1 AND user_id = $2',
    v_table, v_org_col
  );

  IF v_status_col = 'is_active' THEN
    v_sql := v_sql || ' AND is_active = true';
  ELSIF v_status_col = 'status' THEN
    v_sql := v_sql || $q$ AND status IN ('active','accepted','enabled')$q$;
  END IF;

  v_sql := v_sql || ')';

  EXECUTE v_sql INTO v_result USING p_org_id, v_uid;

  RETURN coalesce(v_result, false);
END;
$$;

-- Grants
REVOKE ALL ON FUNCTION public.rpc_is_org_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_is_org_member(uuid) TO authenticated;
