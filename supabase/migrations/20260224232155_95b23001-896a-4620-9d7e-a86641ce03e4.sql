
CREATE OR REPLACE FUNCTION public.rpc_os_system_state(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total_projects       int;
  v_active_projects      int;
  v_archived_projects    int;
  v_total_snapshots      bigint;
  v_projects_w_snaps     int;
  v_projects_wo_snaps    int;
  v_oldest_snap          date;
  v_newest_snap          date;
  v_projects_w_estimates int;
  v_projects_wo_estimates int;
  v_projects_w_labor     int;
  v_projects_wo_labor    int;
  v_projects_w_vol       int;
  v_projects_wo_vol      int;
  v_high_risk            int;
  v_unstable             int;
  v_active_ids           uuid[];
BEGIN
  -- Project counts
  SELECT COUNT(*)
    INTO v_total_projects
    FROM projects
   WHERE organization_id = p_org_id AND is_deleted = false;

  SELECT COUNT(*)
    INTO v_active_projects
    FROM projects
   WHERE organization_id = p_org_id AND is_deleted = false
     AND status IN ('active', 'in_progress', 'open');

  v_archived_projects := v_total_projects - v_active_projects;

  -- Collect active project ids for reuse
  SELECT ARRAY(
    SELECT id FROM projects
     WHERE organization_id = p_org_id AND is_deleted = false
       AND status IN ('active', 'in_progress', 'open')
     ORDER BY id ASC
  ) INTO v_active_ids;

  -- Snapshot stats (scoped to org)
  SELECT COUNT(*), MIN(snapshot_date), MAX(snapshot_date)
    INTO v_total_snapshots, v_oldest_snap, v_newest_snap
    FROM project_economic_snapshots
   WHERE org_id = p_org_id;

  SELECT COUNT(DISTINCT project_id)
    INTO v_projects_w_snaps
    FROM project_economic_snapshots
   WHERE org_id = p_org_id
     AND project_id = ANY(v_active_ids);

  v_projects_wo_snaps := v_active_projects - v_projects_w_snaps;

  -- Economics: estimates
  SELECT COUNT(DISTINCT project_id)
    INTO v_projects_w_estimates
    FROM estimates
   WHERE organization_id = p_org_id
     AND project_id = ANY(v_active_ids);

  v_projects_wo_estimates := v_active_projects - v_projects_w_estimates;

  -- Economics: labor (time_entries)
  SELECT COUNT(DISTINCT project_id)
    INTO v_projects_w_labor
    FROM time_entries
   WHERE project_id = ANY(v_active_ids);

  v_projects_wo_labor := v_active_projects - v_projects_w_labor;

  -- Volatility: projects that have >1 snapshot with varying risk_score
  SELECT COUNT(*)
    INTO v_projects_w_vol
    FROM (
      SELECT project_id
        FROM project_economic_snapshots
       WHERE org_id = p_org_id
         AND project_id = ANY(v_active_ids)
       GROUP BY project_id
      HAVING COUNT(*) > 1
         AND MIN(risk_score) IS DISTINCT FROM MAX(risk_score)
    ) sub;

  v_projects_wo_vol := v_active_projects - v_projects_w_vol;

  -- Risks: latest snapshot per active project
  SELECT
    COALESCE(SUM(CASE WHEN s.economic_position = 'at_risk' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.economic_position = 'volatile' THEN 1 ELSE 0 END), 0)
    INTO v_high_risk, v_unstable
    FROM (
      SELECT DISTINCT ON (project_id) project_id, economic_position
        FROM project_economic_snapshots
       WHERE org_id = p_org_id
         AND project_id = ANY(v_active_ids)
       ORDER BY project_id, snapshot_date DESC
    ) s;

  RETURN jsonb_build_object(
    'org_id', p_org_id,
    'projects', jsonb_build_object(
      'total',    v_total_projects,
      'active',   v_active_projects,
      'archived', v_archived_projects
    ),
    'snapshots', jsonb_build_object(
      'total_snapshots',           v_total_snapshots,
      'projects_with_snapshots',   v_projects_w_snaps,
      'projects_without_snapshots', v_projects_wo_snaps,
      'oldest_snapshot_date',      v_oldest_snap,
      'newest_snapshot_date',      v_newest_snap
    ),
    'economics', jsonb_build_object(
      'projects_with_estimates',    v_projects_w_estimates,
      'projects_without_estimates', v_projects_wo_estimates,
      'projects_with_labor',        v_projects_w_labor,
      'projects_without_labor',     v_projects_wo_labor
    ),
    'volatility', jsonb_build_object(
      'projects_with_volatility',    v_projects_w_vol,
      'projects_without_volatility', v_projects_wo_vol
    ),
    'risks', jsonb_build_object(
      'high_risk_projects', v_high_risk,
      'unstable_projects',  v_unstable
    )
  );
END;
$function$;
