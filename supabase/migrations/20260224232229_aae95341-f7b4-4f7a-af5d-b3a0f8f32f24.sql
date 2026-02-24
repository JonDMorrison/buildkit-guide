
CREATE OR REPLACE FUNCTION public.rpc_snapshot_coverage_report(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_project_count          int;
  v_avg_snaps              numeric;
  v_with_0                 int;
  v_with_1                 int;
  v_with_2_to_7            int;
  v_with_8_to_30           int;
  v_with_30_plus           int;
  v_newest                 date;
  v_oldest                 date;
BEGIN
  -- Active project count
  SELECT COUNT(*)
    INTO v_project_count
    FROM projects
   WHERE organization_id = p_org_id
     AND is_deleted = false
     AND status IN ('active', 'in_progress', 'open');

  -- Snapshot date range
  SELECT MIN(snapshot_date), MAX(snapshot_date)
    INTO v_oldest, v_newest
    FROM project_economic_snapshots
   WHERE org_id = p_org_id;

  -- Bucket counts
  WITH active_projects AS (
    SELECT id AS project_id
      FROM projects
     WHERE organization_id = p_org_id
       AND is_deleted = false
       AND status IN ('active', 'in_progress', 'open')
  ),
  snap_counts AS (
    SELECT ap.project_id,
           COUNT(s.id)::int AS cnt
      FROM active_projects ap
      LEFT JOIN project_economic_snapshots s
        ON s.project_id = ap.project_id AND s.org_id = p_org_id
     GROUP BY ap.project_id
  )
  SELECT
    ROUND(COALESCE(AVG(cnt), 0), 2),
    COALESCE(SUM(CASE WHEN cnt = 0 THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN cnt BETWEEN 2 AND 7 THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN cnt BETWEEN 8 AND 30 THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN cnt > 30 THEN 1 ELSE 0 END), 0)::int
    INTO v_avg_snaps, v_with_0, v_with_1, v_with_2_to_7, v_with_8_to_30, v_with_30_plus
    FROM snap_counts;

  RETURN jsonb_build_object(
    'org_id',                       p_org_id,
    'project_count',                v_project_count,
    'avg_snapshots_per_project',    v_avg_snaps,
    'projects_with_0_snapshots',    v_with_0,
    'projects_with_1_snapshot',     v_with_1,
    'projects_with_2_to_7',         v_with_2_to_7,
    'projects_with_8_to_30',        v_with_8_to_30,
    'projects_with_30_plus',        v_with_30_plus,
    'newest_snapshot',              v_newest,
    'oldest_snapshot',              v_oldest
  );
END;
$function$;
