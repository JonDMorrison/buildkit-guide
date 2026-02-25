
CREATE OR REPLACE FUNCTION public.rpc_revenue_trace_v2(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id                  uuid;
  v_cols_projects           jsonb;
  v_cols_estimates          jsonb;
  v_cols_snapshots          jsonb;
  v_available_tables        jsonb;
  v_has_org_id_col          boolean;
  v_has_estimates_table     boolean;
  -- snapshot fields
  v_snap_date               date;
  v_snap_id                 uuid;
  v_snap_projected_rev      numeric;
  v_snap_contract_value     numeric;
  v_has_snap_proj_rev       boolean;
  v_has_snap_cv             boolean;
  -- estimate fields
  v_estimate_rev            numeric;
  v_estimate_col_used       text;
  v_has_est_cv              boolean;
  v_has_est_pr              boolean;
  v_has_est_tr              boolean;
  v_has_est_tp              boolean;
  -- output
  v_revenue_source          text;
BEGIN
  -- ========================================
  -- A) Schema discovery
  -- ========================================

  -- Available tables/views matching patterns
  SELECT COALESCE(jsonb_agg(t.table_name ORDER BY t.table_name), '[]'::jsonb)
    INTO v_available_tables
    FROM information_schema.tables t
   WHERE t.table_schema = 'public'
     AND (t.table_name LIKE '%estimate%'
       OR t.table_name LIKE '%snapshot%'
       OR t.table_name LIKE '%economic%');

  -- Columns for projects
  SELECT COALESCE(jsonb_agg(c.column_name ORDER BY c.column_name), '[]'::jsonb)
    INTO v_cols_projects
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = 'projects';

  -- Columns for estimates
  SELECT COALESCE(jsonb_agg(c.column_name ORDER BY c.column_name), '[]'::jsonb)
    INTO v_cols_estimates
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = 'estimates';

  -- Columns for project_economic_snapshots
  SELECT COALESCE(jsonb_agg(c.column_name ORDER BY c.column_name), '[]'::jsonb)
    INTO v_cols_snapshots
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = 'project_economic_snapshots';

  -- Does estimates table exist?
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'estimates'
  ) INTO v_has_estimates_table;

  -- ========================================
  -- B1) Verify org_id column exists on projects
  -- ========================================
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'organization_id'
  ) INTO v_has_org_id_col;

  IF NOT v_has_org_id_col THEN
    RETURN jsonb_build_object(
      'success', false,
      'project_id', p_project_id,
      'reason', 'projects table missing organization_id column',
      'available_tables', v_available_tables,
      'available_columns', jsonb_build_object(
        'projects', v_cols_projects,
        'estimates', v_cols_estimates,
        'project_economic_snapshots', v_cols_snapshots
      )
    );
  END IF;

  -- Fetch org_id
  SELECT p.organization_id
    INTO v_org_id
    FROM projects p
   WHERE p.id = p_project_id
     AND p.is_deleted = false;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'project_id', p_project_id,
      'reason', 'project_not_found',
      'available_tables', v_available_tables,
      'available_columns', jsonb_build_object(
        'projects', v_cols_projects,
        'estimates', v_cols_estimates,
        'project_economic_snapshots', v_cols_snapshots
      )
    );
  END IF;

  -- ========================================
  -- B2) Snapshot revenue
  -- ========================================
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'project_economic_snapshots' AND column_name = 'projected_revenue'
  ) INTO v_has_snap_proj_rev;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'project_economic_snapshots' AND column_name = 'contract_value'
  ) INTO v_has_snap_cv;

  -- Get latest snapshot row identifiers
  SELECT s.snapshot_date, s.id
    INTO v_snap_date, v_snap_id
    FROM project_economic_snapshots s
   WHERE s.project_id = p_project_id
   ORDER BY s.snapshot_date DESC, s.id ASC
   LIMIT 1;

  IF v_snap_id IS NOT NULL THEN
    IF v_has_snap_proj_rev THEN
      SELECT s.projected_revenue INTO v_snap_projected_rev
        FROM project_economic_snapshots s WHERE s.id = v_snap_id;
    END IF;
    IF v_has_snap_cv THEN
      SELECT s.contract_value INTO v_snap_contract_value
        FROM project_economic_snapshots s WHERE s.id = v_snap_id;
    END IF;
  END IF;

  -- ========================================
  -- C) Estimate revenue (safe column selection)
  -- ========================================
  v_estimate_rev := NULL;
  v_estimate_col_used := NULL;

  IF v_has_estimates_table THEN
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='estimates' AND column_name='contract_value') INTO v_has_est_cv;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='estimates' AND column_name='projected_revenue') INTO v_has_est_pr;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='estimates' AND column_name='total_revenue') INTO v_has_est_tr;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='estimates' AND column_name='total_price') INTO v_has_est_tp;

    IF v_has_est_cv THEN
      SELECT e.contract_value INTO v_estimate_rev
        FROM estimates e
       WHERE e.project_id = p_project_id AND e.status = 'approved'
       ORDER BY e.approved_at DESC NULLS LAST, e.id ASC LIMIT 1;
      v_estimate_col_used := 'contract_value';
    ELSIF v_has_est_pr THEN
      SELECT e.projected_revenue INTO v_estimate_rev
        FROM estimates e
       WHERE e.project_id = p_project_id AND e.status = 'approved'
       ORDER BY e.approved_at DESC NULLS LAST, e.id ASC LIMIT 1;
      v_estimate_col_used := 'projected_revenue';
    ELSIF v_has_est_tr THEN
      SELECT e.total_revenue INTO v_estimate_rev
        FROM estimates e
       WHERE e.project_id = p_project_id AND e.status = 'approved'
       ORDER BY e.approved_at DESC NULLS LAST, e.id ASC LIMIT 1;
      v_estimate_col_used := 'total_revenue';
    ELSIF v_has_est_tp THEN
      SELECT e.total_price INTO v_estimate_rev
        FROM estimates e
       WHERE e.project_id = p_project_id AND e.status = 'approved'
       ORDER BY e.approved_at DESC NULLS LAST, e.id ASC LIMIT 1;
      v_estimate_col_used := 'total_price';
    END IF;
  END IF;

  -- ========================================
  -- D) Revenue source determination
  -- ========================================
  v_revenue_source := CASE
    WHEN v_snap_projected_rev IS NOT NULL THEN 'snapshot.projected_revenue'
    WHEN v_estimate_rev IS NOT NULL THEN 'estimate.' || v_estimate_col_used
    ELSE 'missing'
  END;

  RETURN jsonb_build_object(
    'success',                       true,
    'project_id',                    p_project_id,
    'org_id',                        v_org_id,
    'latest_snapshot',               CASE WHEN v_snap_id IS NOT NULL THEN jsonb_build_object(
      'snapshot_date',       v_snap_date,
      'projected_revenue',  v_snap_projected_rev,
      'contract_value',     v_snap_contract_value
    ) ELSE NULL END,
    'estimate_revenue',              jsonb_build_object(
      'value',       v_estimate_rev,
      'column_used', v_estimate_col_used
    ),
    'revenue_source_used_by_engine', v_revenue_source,
    'available_tables',              v_available_tables,
    'available_columns',             jsonb_build_object(
      'projects',                    v_cols_projects,
      'estimates',                   v_cols_estimates,
      'project_economic_snapshots',  v_cols_snapshots
    )
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_revenue_trace_v2(uuid) IS
  'Revenue provenance trace v2. Schema-introspecting, no assumptions on column existence. STABLE SECURITY DEFINER, deterministic, no RPC deps.';
