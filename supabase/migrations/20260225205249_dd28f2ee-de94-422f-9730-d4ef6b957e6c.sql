CREATE OR REPLACE FUNCTION public.project_scope_accuracy(p_project_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(scope_item_id uuid, scope_item_name text, item_type text, planned_hours numeric, actual_hours numeric, delta_hours numeric, delta_pct numeric, task_count bigint, trade_breakdown jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH scope_tasks AS (
    SELECT
      t.scope_item_id AS si_id,
      t.id AS task_id,
      t.assigned_trade_id
    FROM tasks t
    WHERE t.project_id = p_project_id
      AND t.scope_item_id IS NOT NULL
      AND t.is_deleted = false
  ),
  task_hours AS (
    SELECT
      te.task_id,
      COALESCE(SUM(te.duration_hours), 0) AS hours
    FROM time_entries te
    WHERE te.project_id = p_project_id
      AND te.status = 'closed'
      AND te.duration_hours IS NOT NULL
      AND te.task_id IS NOT NULL
      AND (p_start_date IS NULL OR te.check_in_at::date >= p_start_date)
      AND (p_end_date IS NULL OR te.check_in_at::date <= p_end_date)
    GROUP BY te.task_id
  ),
  scope_agg AS (
    SELECT
      st.si_id,
      COUNT(DISTINCT st.task_id) AS t_count,
      COALESCE(SUM(th.hours), 0) AS total_actual
    FROM scope_tasks st
    LEFT JOIN task_hours th ON th.task_id = st.task_id
    GROUP BY st.si_id
  ),
  trade_agg AS (
    SELECT
      st.si_id,
      jsonb_agg(
        jsonb_build_object(
          'trade_id', st.assigned_trade_id,
          'trade_name', COALESCE(tr.name, 'Unassigned'),
          'hours', COALESCE(th.hours, 0)
        )
      ) FILTER (WHERE th.hours > 0) AS breakdown
    FROM scope_tasks st
    LEFT JOIN task_hours th ON th.task_id = st.task_id
    LEFT JOIN trades tr ON tr.id = st.assigned_trade_id
    WHERE th.hours > 0
    GROUP BY st.si_id
  )
  SELECT
    psi.id AS scope_item_id,
    psi.name AS scope_item_name,
    psi.item_type,
    (psi.planned_hours * psi.quantity)::numeric AS planned_hours,
    sa.total_actual::numeric AS actual_hours,
    ((psi.planned_hours * psi.quantity) - sa.total_actual)::numeric AS delta_hours,
    CASE
      WHEN (psi.planned_hours * psi.quantity) > 0
      THEN ROUND((((sa.total_actual - (psi.planned_hours * psi.quantity)) / (psi.planned_hours * psi.quantity)) * 100)::numeric, 1)
      ELSE 0
    END AS delta_pct,
    sa.t_count AS task_count,
    COALESCE(ta.breakdown, '[]'::jsonb) AS trade_breakdown
  FROM project_scope_items psi
  JOIN scope_agg sa ON sa.si_id = psi.id
  LEFT JOIN trade_agg ta ON ta.si_id = psi.id
  WHERE psi.project_id = p_project_id
    AND psi.item_type = 'task'
    AND psi.is_archived = false
  ORDER BY delta_pct DESC;
END;
$function$;