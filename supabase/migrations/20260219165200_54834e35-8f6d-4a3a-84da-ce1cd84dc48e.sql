
CREATE OR REPLACE FUNCTION public.rpc_get_executive_dashboard(p_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_os_score        jsonb;
  v_at_risk         bigint;
  v_volatile        bigint;
  v_avg_margin      numeric;
  v_top3            jsonb;
BEGIN
  -- Validate membership
  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- OS score
  v_os_score := public.rpc_get_operating_system_score(p_org_id);

  -- Aggregate from margin control per active project
  WITH controls AS (
    SELECT
      p.id   AS project_id,
      p.name AS project_name,
      public.rpc_generate_project_margin_control(p.id) AS ctrl
    FROM projects p
    WHERE p.organization_id = p_org_id
      AND p.status NOT IN ('completed', 'closed', 'cancelled')
  ),
  ranked AS (
    SELECT
      project_id,
      project_name,
      ctrl,
      (ctrl->>'risk_score')::int AS risk_score
    FROM controls
    ORDER BY (ctrl->>'risk_score')::int DESC, project_id ASC
  )
  SELECT
    coalesce(count(*) FILTER (WHERE (ctrl->>'economic_position') = 'at_risk'), 0),
    coalesce(count(*) FILTER (WHERE (ctrl->>'economic_position') = 'volatile'), 0),
    round(coalesce(avg((ctrl->>'projected_margin_at_completion_percent')::numeric), 0)::numeric, 2),
    coalesce(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'economic_position', r2.ctrl->>'economic_position',
          'project_id',       r2.project_id,
          'project_name',     r2.project_name,
          'risk_score',       r2.risk_score
        ) ORDER BY r2.risk_score DESC, r2.project_id ASC
      ) FROM (SELECT * FROM ranked LIMIT 3) r2),
      '[]'::jsonb
    )
  INTO v_at_risk, v_volatile, v_avg_margin, v_top3
  FROM ranked;

  RETURN jsonb_build_object(
    'active_projects_at_risk',      coalesce(v_at_risk, 0),
    'active_projects_volatile',     coalesce(v_volatile, 0),
    'avg_projected_margin_percent', round(coalesce(v_avg_margin, 0)::numeric, 2),
    'os_score',                     v_os_score,
    'top_risk_projects',            coalesce(v_top3, '[]'::jsonb)
  );
END;
$function$;
