
-- 1) Patch rpc_data_quality_audit: use effective_revenue = COALESCE(projected_revenue, contract_value)
CREATE OR REPLACE FUNCTION public.rpc_data_quality_audit(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_missing_estimates     jsonb;
  v_missing_revenue       jsonb;
  v_missing_labor         jsonb;
  v_impossible_margins    jsonb;
  v_negative_revenue      jsonb;
  v_orphan_snaps          jsonb;
  v_cnt_est               int;
  v_cnt_rev               int;
  v_cnt_lab               int;
BEGIN
  -- Active projects without any estimate
  SELECT COUNT(*)::int INTO v_cnt_est
    FROM projects p
   WHERE p.organization_id = p_org_id AND p.is_deleted = false
     AND p.status IN ('active','in_progress','open')
     AND NOT EXISTS (SELECT 1 FROM estimates e WHERE e.project_id = p.id AND e.organization_id = p_org_id);

  SELECT COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb) INTO v_missing_estimates
    FROM (SELECT p.id FROM projects p
           WHERE p.organization_id = p_org_id AND p.is_deleted = false
             AND p.status IN ('active','in_progress','open')
             AND NOT EXISTS (SELECT 1 FROM estimates e WHERE e.project_id = p.id AND e.organization_id = p_org_id)
           ORDER BY p.id LIMIT 25) sub;

  -- Active projects with missing effective revenue (COALESCE(projected_revenue, contract_value) IS NULL or <= 0)
  SELECT COALESCE(jsonb_agg(project_id ORDER BY project_id), '[]'::jsonb), COUNT(*)::int
    INTO v_missing_revenue, v_cnt_rev
    FROM (SELECT DISTINCT ON (s.project_id) s.project_id,
                 COALESCE(s.projected_revenue, s.contract_value) AS effective_revenue
            FROM project_economic_snapshots s
            JOIN projects p ON p.id = s.project_id
           WHERE s.org_id = p_org_id AND p.is_deleted = false
             AND p.status IN ('active','in_progress','open')
           ORDER BY s.project_id, s.snapshot_date DESC) latest
   WHERE effective_revenue IS NULL OR effective_revenue <= 0;

  SELECT COALESCE(jsonb_agg(val ORDER BY val), '[]'::jsonb) INTO v_missing_revenue
    FROM (SELECT val FROM jsonb_array_elements(v_missing_revenue) val LIMIT 25) sub;

  -- Active projects with no time_entries
  SELECT COUNT(*)::int INTO v_cnt_lab
    FROM projects p
   WHERE p.organization_id = p_org_id AND p.is_deleted = false
     AND p.status IN ('active','in_progress','open')
     AND NOT EXISTS (SELECT 1 FROM time_entries t WHERE t.project_id = p.id);

  SELECT COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb) INTO v_missing_labor
    FROM (SELECT p.id FROM projects p
           WHERE p.organization_id = p_org_id AND p.is_deleted = false
             AND p.status IN ('active','in_progress','open')
             AND NOT EXISTS (SELECT 1 FROM time_entries t WHERE t.project_id = p.id)
           ORDER BY p.id LIMIT 25) sub;

  -- Impossible margins (>100% or < -100%) on latest snapshot
  SELECT COALESCE(jsonb_agg(project_id ORDER BY project_id), '[]'::jsonb)
    INTO v_impossible_margins
    FROM (SELECT DISTINCT ON (s.project_id) s.project_id, s.projected_margin
            FROM project_economic_snapshots s
            JOIN projects p ON p.id = s.project_id
           WHERE s.org_id = p_org_id AND p.is_deleted = false
             AND p.status IN ('active','in_progress','open')
           ORDER BY s.project_id, s.snapshot_date DESC) latest
   WHERE ABS(COALESCE(projected_margin, 0)) > 1
   LIMIT 25;

  -- Negative revenue on latest snapshot (also use effective_revenue)
  SELECT COALESCE(jsonb_agg(project_id ORDER BY project_id), '[]'::jsonb)
    INTO v_negative_revenue
    FROM (SELECT DISTINCT ON (s.project_id) s.project_id,
                 COALESCE(s.projected_revenue, s.contract_value) AS effective_revenue
            FROM project_economic_snapshots s
            JOIN projects p ON p.id = s.project_id
           WHERE s.org_id = p_org_id AND p.is_deleted = false
             AND p.status IN ('active','in_progress','open')
           ORDER BY s.project_id, s.snapshot_date DESC) latest
   WHERE COALESCE(effective_revenue, 0) < 0
   LIMIT 25;

  -- Snapshots referencing deleted/nonexistent projects
  SELECT COALESCE(jsonb_agg(DISTINCT s.project_id ORDER BY s.project_id), '[]'::jsonb)
    INTO v_orphan_snaps
    FROM project_economic_snapshots s
    LEFT JOIN projects p ON p.id = s.project_id
   WHERE s.org_id = p_org_id
     AND (p.id IS NULL OR p.is_deleted = true)
   LIMIT 25;

  RETURN jsonb_build_object(
    'org_id',                    p_org_id,
    'missing_estimates',         v_missing_estimates,
    'missing_revenue',           v_missing_revenue,
    'missing_labor',             v_missing_labor,
    'impossible_margins',        v_impossible_margins,
    'negative_revenue',          v_negative_revenue,
    'snapshots_without_projects', v_orphan_snaps,
    'totals', jsonb_build_object(
      'missing_estimate_count', v_cnt_est,
      'missing_revenue_count',  v_cnt_rev,
      'missing_labor_count',    v_cnt_lab
    )
  );
END;
$function$;

-- 2) Patch rpc_capture_project_economic_snapshot: fallback projected_revenue to contract_value
CREATE OR REPLACE FUNCTION public.rpc_capture_project_economic_snapshot(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id          uuid;
  v_mc              jsonb;
  v_risk_score      numeric;
  v_economic_pos    text;
  v_projected_margin numeric;
  v_realized_margin  numeric;
  v_labor_burn      numeric;
  v_contract_value  numeric;
  v_projected_rev   numeric;
  v_flags_raw       jsonb;
  v_flags           jsonb;
  v_flags_hash      text;
  v_snap_date       date := CURRENT_DATE;
  v_existed         boolean;
  v_row_count       integer;
BEGIN
  SELECT p.organization_id INTO STRICT v_org_id
    FROM projects p
   WHERE p.id = p_project_id
     AND p.is_deleted = false;

  v_mc := public.rpc_generate_project_margin_control(p_project_id);

  v_risk_score      := COALESCE((v_mc->>'risk_score')::numeric, 0);
  v_economic_pos    := COALESCE(v_mc->>'economic_position', 'unknown');
  v_projected_margin := COALESCE((v_mc->>'projected_margin')::numeric, 0);
  v_realized_margin  := COALESCE((v_mc->>'realized_margin')::numeric, 0);
  v_labor_burn      := COALESCE((v_mc->>'labor_burn_ratio')::numeric, 0);
  v_contract_value  := (v_mc->>'contract_value')::numeric;
  v_projected_rev   := (v_mc->>'projected_revenue')::numeric;

  -- Fallback: if projected_revenue is null, use contract_value
  IF v_projected_rev IS NULL THEN
    v_projected_rev := v_contract_value;
  END IF;

  v_flags_raw       := COALESCE(v_mc->'intervention_flags', '[]'::jsonb);

  IF jsonb_typeof(v_flags_raw) <> 'array' THEN
    RAISE EXCEPTION 'intervention_flags is not a jsonb array'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(val ORDER BY val::text ASC), '[]'::jsonb)
    INTO v_flags
    FROM (SELECT DISTINCT val FROM jsonb_array_elements(v_flags_raw) AS val) sub;

  v_flags_hash := md5(v_flags::text);

  SELECT EXISTS(
    SELECT 1 FROM project_economic_snapshots
     WHERE org_id = v_org_id
       AND project_id = p_project_id
       AND snapshot_date = v_snap_date
  ) INTO v_existed;

  INSERT INTO project_economic_snapshots (
    org_id, project_id, snapshot_date,
    risk_score, economic_position, projected_margin, realized_margin,
    labor_burn_ratio, contract_value, projected_revenue,
    flags, flags_hash, source
  ) VALUES (
    v_org_id, p_project_id, v_snap_date,
    v_risk_score, v_economic_pos, v_projected_margin, v_realized_margin,
    v_labor_burn, v_contract_value, v_projected_rev,
    v_flags, v_flags_hash, 'capture'
  )
  ON CONFLICT (org_id, project_id, snapshot_date)
  DO UPDATE SET
    risk_score        = EXCLUDED.risk_score,
    economic_position = EXCLUDED.economic_position,
    projected_margin  = EXCLUDED.projected_margin,
    realized_margin   = EXCLUDED.realized_margin,
    labor_burn_ratio  = EXCLUDED.labor_burn_ratio,
    contract_value    = EXCLUDED.contract_value,
    projected_revenue = EXCLUDED.projected_revenue,
    flags             = EXCLUDED.flags,
    flags_hash        = EXCLUDED.flags_hash,
    source            = EXCLUDED.source
  WHERE
    project_economic_snapshots.flags_hash        IS DISTINCT FROM EXCLUDED.flags_hash
    OR project_economic_snapshots.risk_score     IS DISTINCT FROM EXCLUDED.risk_score
    OR project_economic_snapshots.projected_margin IS DISTINCT FROM EXCLUDED.projected_margin
    OR project_economic_snapshots.realized_margin  IS DISTINCT FROM EXCLUDED.realized_margin
    OR project_economic_snapshots.labor_burn_ratio IS DISTINCT FROM EXCLUDED.labor_burn_ratio
    OR project_economic_snapshots.economic_position IS DISTINCT FROM EXCLUDED.economic_position;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success',       true,
    'org_id',        v_org_id,
    'project_id',    p_project_id,
    'snapshot_date',  v_snap_date,
    'inserted',      (NOT v_existed AND v_row_count > 0),
    'updated',       (v_existed AND v_row_count > 0),
    'flags_hash',    v_flags_hash
  );
END;
$$;
