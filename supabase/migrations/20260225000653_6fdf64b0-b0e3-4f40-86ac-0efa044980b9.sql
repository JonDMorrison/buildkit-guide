
CREATE OR REPLACE FUNCTION public.rpc_revenue_trace_v2(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id                  uuid;
  v_snapshot_rev            numeric;
  v_estimate_rev            numeric;
  v_estimate_col_used       text;
  v_revenue_source          text;
  v_cols_projects           jsonb;
  v_cols_estimates          jsonb;
  v_cols_snapshot           jsonb;
  v_has_contract_value      boolean;
  v_has_projected_revenue   boolean;
  v_has_total_revenue       boolean;
  v_has_total_price         boolean;
BEGIN
  -- 1) Verify project
  SELECT p.organization_id
    INTO v_org_id
    FROM projects p
   WHERE p.id = p_project_id
     AND p.is_deleted = false;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'success',    false,
      'project_id', p_project_id,
      'reason',     'project_not_found'
    );
  END IF;

  -- 2) Schema introspection
  SELECT COALESCE(jsonb_agg(c.column_name ORDER BY c.column_name), '[]'::jsonb)
    INTO v_cols_projects
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name = 'projects';

  SELECT COALESCE(jsonb_agg(c.column_name ORDER BY c.column_name), '[]'::jsonb)
    INTO v_cols_estimates
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name = 'estimates';

  SELECT COALESCE(jsonb_agg(c.column_name ORDER BY c.column_name), '[]'::jsonb)
    INTO v_cols_snapshot
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name = 'v_project_economic_snapshot';

  -- 3a) Snapshot revenue
  SELECT s.projected_revenue
    INTO v_snapshot_rev
    FROM v_project_economic_snapshot s
   WHERE s.project_id = p_project_id
   ORDER BY s.snapshot_date DESC, s.id ASC
   LIMIT 1;

  -- 3b) Estimate revenue — check which column exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'estimates' AND column_name = 'contract_value'
  ) INTO v_has_contract_value;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'estimates' AND column_name = 'projected_revenue'
  ) INTO v_has_projected_revenue;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'estimates' AND column_name = 'total_revenue'
  ) INTO v_has_total_revenue;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'estimates' AND column_name = 'total_price'
  ) INTO v_has_total_price;

  IF v_has_contract_value THEN
    SELECT e.contract_value
      INTO v_estimate_rev
      FROM estimates e
     WHERE e.project_id = p_project_id AND e.status = 'approved'
     ORDER BY e.approved_at DESC NULLS LAST, e.id ASC
     LIMIT 1;
    v_estimate_col_used := 'contract_value';
  ELSIF v_has_projected_revenue THEN
    SELECT e.projected_revenue
      INTO v_estimate_rev
      FROM estimates e
     WHERE e.project_id = p_project_id AND e.status = 'approved'
     ORDER BY e.approved_at DESC NULLS LAST, e.id ASC
     LIMIT 1;
    v_estimate_col_used := 'projected_revenue';
  ELSIF v_has_total_revenue THEN
    SELECT e.total_revenue
      INTO v_estimate_rev
      FROM estimates e
     WHERE e.project_id = p_project_id AND e.status = 'approved'
     ORDER BY e.approved_at DESC NULLS LAST, e.id ASC
     LIMIT 1;
    v_estimate_col_used := 'total_revenue';
  ELSIF v_has_total_price THEN
    SELECT e.total_price
      INTO v_estimate_rev
      FROM estimates e
     WHERE e.project_id = p_project_id AND e.status = 'approved'
     ORDER BY e.approved_at DESC NULLS LAST, e.id ASC
     LIMIT 1;
    v_estimate_col_used := 'total_price';
  ELSE
    v_estimate_rev := NULL;
    v_estimate_col_used := NULL;
  END IF;

  -- 4) Determine source
  v_revenue_source := CASE
    WHEN v_snapshot_rev IS NOT NULL THEN 'snapshot.projected_revenue'
    WHEN v_estimate_rev IS NOT NULL THEN 'estimate.' || v_estimate_col_used
    ELSE 'missing'
  END;

  -- 5) Return
  RETURN jsonb_build_object(
    'success',                         true,
    'project_id',                      p_project_id,
    'org_id',                          v_org_id,
    'projected_revenue_from_snapshot', v_snapshot_rev,
    'estimate_revenue_value',          v_estimate_rev,
    'estimate_revenue_column_used',    v_estimate_col_used,
    'revenue_source_used_by_engine',   v_revenue_source,
    'available_columns',               jsonb_build_object(
      'projects',      v_cols_projects,
      'estimates',     v_cols_estimates,
      'snapshot_view', v_cols_snapshot
    )
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_revenue_trace_v2(uuid) IS
  'Revenue provenance trace v2. STABLE SECURITY DEFINER, deterministic, no RPC deps, schema-introspecting. Nulls preserved.';
