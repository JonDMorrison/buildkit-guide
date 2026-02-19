
CREATE OR REPLACE FUNCTION public.rpc_get_executive_dashboard(p_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_os_score        jsonb;
  v_at_risk         bigint := 0;
  v_volatile        bigint := 0;
  v_avg_margin      numeric := 0;
  v_top3            jsonb := '[]'::jsonb;
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
  ),
  aggregates AS (
    SELECT
      coalesce(count(*) FILTER (WHERE (ctrl->>'economic_position') = 'at_risk'), 0) AS cnt_at_risk,
      coalesce(count(*) FILTER (WHERE (ctrl->>'economic_position') = 'volatile'), 0) AS cnt_volatile,
      round(coalesce(avg((ctrl->>'projected_margin_at_completion_percent')::numeric), 0)::numeric, 2) AS avg_margin
    FROM ranked
  ),
  top_rows AS (
    SELECT
      project_id,
      risk_score,
      jsonb_build_object(
        'economic_position', ctrl->>'economic_position',
        'project_id',       project_id,
        'project_name',     project_name,
        'risk_score',       risk_score
      ) AS payload_json
    FROM ranked
    ORDER BY risk_score DESC, project_id ASC
    LIMIT 3
  )
  SELECT
    a.cnt_at_risk,
    a.cnt_volatile,
    a.avg_margin,
    coalesce(
      (SELECT jsonb_agg(t.payload_json ORDER BY t.risk_score DESC, t.project_id ASC) FROM top_rows t),
      '[]'::jsonb
    )
  INTO v_at_risk, v_volatile, v_avg_margin, v_top3
  FROM aggregates a;

  RETURN jsonb_build_object(
    'active_projects_at_risk',      coalesce(v_at_risk, 0),
    'active_projects_volatile',     coalesce(v_volatile, 0),
    'avg_projected_margin_percent', round(coalesce(v_avg_margin, 0)::numeric, 2),
    'os_score',                     v_os_score,
    'top_risk_projects',            coalesce(v_top3, '[]'::jsonb)
  );
END;
$function$;
