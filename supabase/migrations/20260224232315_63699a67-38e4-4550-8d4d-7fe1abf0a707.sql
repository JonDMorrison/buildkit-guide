
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
  WITH active AS (
    SELECT id FROM projects
     WHERE organization_id = p_org_id AND is_deleted = false
       AND status IN ('active','in_progress','open')
  ),
  has_est AS (
    SELECT DISTINCT project_id FROM estimates WHERE organization_id = p_org_id
  )
  SELECT COUNT(*)::int,
         COALESCE(jsonb_agg(a.id ORDER BY a.id) FILTER (WHERE rn <= 25), '[]'::jsonb)
    INTO v_cnt_est, v_missing_estimates
    FROM (SELECT a.id, ROW_NUMBER() OVER (ORDER BY a.id) AS rn
            FROM active a LEFT JOIN has_est e ON e.project_id = a.id
           WHERE e.project_id IS NULL) sub
   CROSS JOIN LATERAL (SELECT sub.id) a(id);

  -- re-do cleaner
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

  -- Active projects with 0 or NULL projected_revenue on latest snapshot
  SELECT COALESCE(jsonb_agg(project_id ORDER BY project_id), '[]'::jsonb), COUNT(*)::int
    INTO v_missing_revenue, v_cnt_rev
    FROM (SELECT DISTINCT ON (s.project_id) s.project_id, s.projected_revenue
            FROM project_economic_snapshots s
            JOIN projects p ON p.id = s.project_id
           WHERE s.org_id = p_org_id AND p.is_deleted = false
             AND p.status IN ('active','in_progress','open')
           ORDER BY s.project_id, s.snapshot_date DESC) latest
   WHERE COALESCE(projected_revenue, 0) = 0;

  -- keep only first 25
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

  -- Negative revenue on latest snapshot
  SELECT COALESCE(jsonb_agg(project_id ORDER BY project_id), '[]'::jsonb)
    INTO v_negative_revenue
    FROM (SELECT DISTINCT ON (s.project_id) s.project_id, s.projected_revenue
            FROM project_economic_snapshots s
            JOIN projects p ON p.id = s.project_id
           WHERE s.org_id = p_org_id AND p.is_deleted = false
             AND p.status IN ('active','in_progress','open')
           ORDER BY s.project_id, s.snapshot_date DESC) latest
   WHERE COALESCE(projected_revenue, 0) < 0
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
