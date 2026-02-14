
-- =============================================================
-- 1) Reusable Inclusion Contract predicate
-- =============================================================
CREATE OR REPLACE FUNCTION public.is_valid_time_entry(te public.time_entries)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = 'public'
AS $$
  SELECT te.status = 'closed'
    AND te.check_out_at IS NOT NULL
    AND te.duration_hours IS NOT NULL
    AND te.duration_hours > 0;
$$;

COMMENT ON FUNCTION public.is_valid_time_entry(public.time_entries) IS
  'Canonical Time Entry Inclusion Contract. A time entry is valid for '
  'aggregation iff: status=closed, check_out_at IS NOT NULL, '
  'duration_hours IS NOT NULL, and duration_hours > 0. '
  'ALL reporting RPCs and views MUST use this predicate.';

-- =============================================================
-- 2) Fix project_task_actual_hours — was missing check_out_at
--    and duration_hours > 0
-- =============================================================
CREATE OR REPLACE FUNCTION public.project_task_actual_hours(p_project_id uuid)
RETURNS TABLE(task_id uuid, actual_hours numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT p.organization_id INTO v_org_id
  FROM public.projects p WHERE p.id = p_project_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found: %', p_project_id;
  END IF;
  IF NOT public.has_org_membership(v_org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization';
  END IF;

  RETURN QUERY
    SELECT te.task_id, round(COALESCE(SUM(te.duration_hours), 0), 2)
    FROM public.time_entries te
    WHERE te.project_id = p_project_id
      AND te.status = 'closed'
      AND te.check_out_at IS NOT NULL
      AND te.duration_hours IS NOT NULL
      AND te.duration_hours > 0
      AND te.task_id IS NOT NULL
    GROUP BY te.task_id;
END;
$$;

COMMENT ON FUNCTION public.project_task_actual_hours(uuid) IS
  'Returns actual hours grouped by task_id using the full '
  'Time Entry Inclusion Contract (closed + check_out_at + duration_hours > 0).';
