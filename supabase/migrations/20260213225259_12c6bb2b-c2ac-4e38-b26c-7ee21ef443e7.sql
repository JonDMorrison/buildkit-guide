
-- =============================================
-- project_scope_accuracy: per-scope-item variance with trade breakdown
-- =============================================
CREATE OR REPLACE FUNCTION public.project_scope_accuracy(
  p_project_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  scope_item_id uuid,
  scope_item_name text,
  item_type text,
  planned_hours numeric,
  actual_hours numeric,
  delta_hours numeric,
  delta_pct numeric,
  task_count bigint,
  trade_breakdown jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  WHERE psi.project_id = p_project_id
    AND psi.item_type = 'task'
    AND psi.is_archived = false
  ORDER BY delta_pct DESC;
END;
$$;

-- =============================================
-- org_scope_accuracy: cross-project normalized scope learning
-- =============================================
CREATE OR REPLACE FUNCTION public.org_scope_accuracy(
  p_org_id uuid,
  p_weeks int DEFAULT 12
)
RETURNS TABLE (
  normalized_name text,
  project_count bigint,
  total_planned_hours numeric,
  total_actual_hours numeric,
  avg_delta_pct numeric,
  worst_project_name text,
  worst_delta_pct numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cutoff date := current_date - (p_weeks * 7);
  v_role text;
BEGIN
  -- Validate org membership
  v_role := org_role(p_org_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  RETURN QUERY
  WITH scope_tasks AS (
    SELECT
      t.scope_item_id AS si_id,
      t.id AS task_id,
      t.project_id
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE p.organization_id = p_org_id
      AND p.is_deleted = false
      AND t.scope_item_id IS NOT NULL
      AND t.is_deleted = false
  ),
  task_hours AS (
    SELECT
      te.task_id,
      COALESCE(SUM(te.duration_hours), 0) AS hours
    FROM time_entries te
    JOIN projects p ON p.id = te.project_id
    WHERE p.organization_id = p_org_id
      AND te.status = 'closed'
      AND te.duration_hours IS NOT NULL
      AND te.task_id IS NOT NULL
      AND te.check_in_at::date >= v_cutoff
    GROUP BY te.task_id
  ),
  per_project_scope AS (
    SELECT
      psi.project_id,
      p.name AS project_name,
      -- Normalize: lower, trim, collapse whitespace
      regexp_replace(lower(trim(psi.name)), '\s+', ' ', 'g') AS norm_name,
      (psi.planned_hours * psi.quantity) AS planned,
      COALESCE(SUM(th.hours), 0) AS actual
    FROM project_scope_items psi
    JOIN scope_tasks st ON st.si_id = psi.id
    LEFT JOIN task_hours th ON th.task_id = st.task_id
    JOIN projects p ON p.id = psi.project_id
    WHERE psi.organization_id = p_org_id
      AND psi.item_type = 'task'
      AND psi.is_archived = false
    GROUP BY psi.id, psi.project_id, p.name, psi.name, psi.planned_hours, psi.quantity
  ),
  with_pct AS (
    SELECT
      pps.*,
      CASE WHEN pps.planned > 0
        THEN ((pps.actual - pps.planned) / pps.planned * 100)
        ELSE 0
      END AS delta_pct_val
    FROM per_project_scope pps
  )
  SELECT
    wp.norm_name AS normalized_name,
    COUNT(DISTINCT wp.project_id)::bigint AS project_count,
    ROUND(SUM(wp.planned)::numeric, 1) AS total_planned_hours,
    ROUND(SUM(wp.actual)::numeric, 1) AS total_actual_hours,
    ROUND(AVG(wp.delta_pct_val)::numeric, 1) AS avg_delta_pct,
    (SELECT wp2.project_name FROM with_pct wp2
     WHERE wp2.norm_name = wp.norm_name
     ORDER BY wp2.delta_pct_val DESC LIMIT 1) AS worst_project_name,
    ROUND((SELECT MAX(wp2.delta_pct_val) FROM with_pct wp2
     WHERE wp2.norm_name = wp.norm_name)::numeric, 1) AS worst_delta_pct
  FROM with_pct wp
  GROUP BY wp.norm_name
  HAVING COUNT(DISTINCT wp.project_id) >= 1
  ORDER BY AVG(wp.delta_pct_val) DESC;
END;
$$;
