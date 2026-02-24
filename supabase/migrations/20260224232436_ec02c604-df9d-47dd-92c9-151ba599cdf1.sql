
CREATE OR REPLACE FUNCTION public.rpc_os_scale_probe(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_project_count   int;
  v_snapshot_count   bigint;
  v_avg_snaps        numeric;
  v_vol_rows_est     bigint;
BEGIN
  SELECT COUNT(*)::int INTO v_project_count
    FROM projects
   WHERE organization_id = p_org_id AND is_deleted = false
     AND status IN ('active','in_progress','open');

  SELECT COUNT(*), ROUND(COALESCE(AVG(cnt), 0), 2)
    INTO v_snapshot_count, v_avg_snaps
    FROM (
      SELECT COUNT(*) AS cnt
        FROM project_economic_snapshots
       WHERE org_id = p_org_id
       GROUP BY project_id
    ) sub;

  -- Volatility scan estimate: snapshots within 30-day window
  SELECT COUNT(*) INTO v_vol_rows_est
    FROM project_economic_snapshots
   WHERE org_id = p_org_id
     AND snapshot_date >= (CURRENT_DATE - 30);

  RETURN jsonb_build_object(
    'org_id',                        p_org_id,
    'project_count',                 v_project_count,
    'snapshot_count',                 v_snapshot_count,
    'avg_snapshots_per_project',     v_avg_snaps,
    'volatility_scan_rows_estimate', v_vol_rows_est
  );
END;
$function$;
