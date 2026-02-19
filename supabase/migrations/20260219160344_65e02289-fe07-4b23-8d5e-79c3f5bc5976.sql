
CREATE OR REPLACE FUNCTION public.rpc_get_executive_dashboard(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_os_score        jsonb;
  v_at_risk         bigint;
  v_volatile        bigint;
  v_avg_margin      numeric;
  v_top3            jsonb;
BEGIN
  -- Validate membership
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  -- OS score
  v_os_score := public.rpc_get_operating_system_score(p_org_id);

  -- Aggregate from margin control per active project
  WITH controls AS (
    SELECT
      p.id AS project_id,
      p.name AS project_name,
      public.rpc_generate_project_margin_control(p.id) AS ctrl
    FROM projects p
    WHERE p.organization_id = p_org_id
      AND p.status NOT IN ('completed', 'closed', 'cancelled')
  )
  SELECT
    COUNT(*) FILTER (WHERE (ctrl->>'economic_position') = 'at_risk'),
    COUNT(*) FILTER (WHERE (ctrl->>'economic_position') = 'volatile'),
    ROUND(AVG((ctrl->>'projected_margin_at_completion_percent')::numeric), 2),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'project_id', project_id,
          'project_name', project_name,
          'risk_score', (ctrl->>'risk_score')::int,
          'economic_position', ctrl->>'economic_position'
        ) ORDER BY (ctrl->>'risk_score')::int DESC
      ) FILTER (WHERE true),
      '[]'::jsonb
    )
  INTO v_at_risk, v_volatile, v_avg_margin, v_top3
  FROM controls;

  -- Trim top 3
  IF jsonb_array_length(v_top3) > 3 THEN
    v_top3 := (
      SELECT jsonb_agg(elem)
      FROM (SELECT elem FROM jsonb_array_elements(v_top3) AS elem LIMIT 3) sub
    );
  END IF;

  RETURN jsonb_build_object(
    'os_score',                          v_os_score,
    'active_projects_at_risk',           COALESCE(v_at_risk, 0),
    'active_projects_volatile',          COALESCE(v_volatile, 0),
    'avg_projected_margin_percent',      COALESCE(v_avg_margin, 0),
    'top_risk_projects',                 COALESCE(v_top3, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_executive_dashboard(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_executive_dashboard(uuid) TO authenticated;
