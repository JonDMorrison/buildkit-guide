-- Temporary diagnostic RPC: rpc_debug_labor_row_match
-- Exposes time entry join/status distribution for a project
CREATE OR REPLACE FUNCTION public.rpc_debug_labor_row_match(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_count   int;
  v_closed_count  int;
  v_snapshot_count int;
  v_by_status     jsonb;
  v_sample        jsonb;
BEGIN
  -- 1) Total rows matching project_id (same base join as v_project_economic_snapshot)
  SELECT COUNT(*)::int INTO v_total_count
  FROM time_entries te
  WHERE te.project_id = p_project_id;

  -- 2) Status distribution
  SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY s.status ASC), '[]'::jsonb)
  INTO v_by_status
  FROM (
    SELECT te.status, COUNT(*)::int AS count
    FROM time_entries te
    WHERE te.project_id = p_project_id
    GROUP BY te.status
    ORDER BY te.status ASC
  ) s;

  -- 3) Count using EXACT filter from v_project_economic_snapshot labor CTE
  --    i.e. status IN ('approved','locked','posted') AND check_out_at IS NOT NULL AND duration_hours > 0
  SELECT COUNT(*)::int INTO v_snapshot_count
  FROM time_entries te
  WHERE te.project_id = p_project_id
    AND te.status IN ('approved', 'locked', 'posted')
    AND te.check_out_at IS NOT NULL
    AND te.duration_hours > 0;

  -- 3b) Count using is_valid_time_entry (status = 'closed')
  SELECT COUNT(*)::int INTO v_closed_count
  FROM time_entries te
  WHERE te.project_id = p_project_id
    AND te.status = 'closed'
    AND te.check_out_at IS NOT NULL
    AND te.duration_hours > 0;

  -- 4) Sample of up to 10 rows
  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.time_entry_id ASC), '[]'::jsonb)
  INTO v_sample
  FROM (
    SELECT
      te.id::text        AS time_entry_id,
      te.status,
      te.project_id::text,
      te.organization_id::text AS org_id,
      te.check_out_at IS NOT NULL AS has_checkout,
      te.duration_hours
    FROM time_entries te
    WHERE te.project_id = p_project_id
    ORDER BY te.id ASC
    LIMIT 10
  ) r;

  RETURN jsonb_build_object(
    'time_rows_total_count',          v_total_count,
    'time_rows_status_closed_count',  v_closed_count,
    'time_rows_snapshot_filter_count', v_snapshot_count,
    'snapshot_filter_used',           'status IN (approved, locked, posted) AND check_out_at IS NOT NULL AND duration_hours > 0',
    'is_valid_time_entry_filter',     'status = closed AND check_out_at IS NOT NULL AND duration_hours IS NOT NULL AND duration_hours > 0',
    'time_rows_by_status',            v_by_status,
    'join_key_audit', jsonb_build_object(
      'join_column',   'time_entries.project_id',
      'filter_column', 'time_entries.status',
      'rate_join_1',   'project_members ON (project_id, user_id)',
      'rate_join_2',   'organization_memberships ON (organization_id, user_id)'
    ),
    'sample_rows', v_sample
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_debug_labor_row_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_debug_labor_row_match(uuid) TO supabase_read_only_user;
REVOKE EXECUTE ON FUNCTION public.rpc_debug_labor_row_match(uuid) FROM anon;
