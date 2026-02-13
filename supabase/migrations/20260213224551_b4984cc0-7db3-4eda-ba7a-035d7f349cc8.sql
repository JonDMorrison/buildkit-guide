
-- backfill_weekly_snapshots RPC
CREATE OR REPLACE FUNCTION public.backfill_weekly_snapshots(
  p_org_id uuid,
  p_weeks int DEFAULT 12
)
RETURNS json
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_snapshot_date date;
  v_week_start date;
  v_count int := 0;
  v_result json;
BEGIN
  IF NOT public.has_org_membership(p_org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization';
  END IF;

  v_caller_role := public.org_role(p_org_id);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'owner', 'pm', 'hr') THEN
    RAISE EXCEPTION 'Access denied: admin or PM role required to backfill snapshots';
  END IF;

  -- Clamp weeks to a reasonable max
  IF p_weeks > 52 THEN
    p_weeks := 52;
  END IF;
  IF p_weeks < 1 THEN
    p_weeks := 1;
  END IF;

  FOR i IN 0..(p_weeks - 1) LOOP
    -- Truncate to Monday (ISO week start)
    v_snapshot_date := date_trunc('week', current_date - (i * 7) * interval '1 day')::date;

    PERFORM public.generate_weekly_snapshots_for_org(p_org_id, v_snapshot_date);
    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object(
    'weeks', v_count,
    'org_id', p_org_id,
    'created_or_updated', v_count
  );
END;
$$;
