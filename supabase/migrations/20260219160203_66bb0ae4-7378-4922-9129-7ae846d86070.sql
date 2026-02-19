
CREATE OR REPLACE FUNCTION public.rpc_generate_project_margin_control(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id       uuid;
  v_snap         record;
  v_omp          record;
  v_burn         record;
  v_proj         record;
  v_risk         int := 0;
  v_position     text;
  v_flags        jsonb := '[]'::jsonb;
BEGIN
  -- Validate project exists
  SELECT organization_id INTO v_org_id
  FROM projects WHERE id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501';
  END IF;

  -- Validate caller belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = v_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  -- Read views
  SELECT * INTO v_snap FROM v_project_economic_snapshot WHERE project_id = p_project_id;
  SELECT * INTO v_omp  FROM v_org_margin_performance    WHERE org_id = v_org_id;
  SELECT * INTO v_burn FROM v_project_labor_burn_index   WHERE project_id = p_project_id;
  SELECT * INTO v_proj FROM v_project_margin_projection  WHERE project_id = p_project_id;

  -- Compute risk score
  IF v_proj.margin_declining_flag THEN
    v_risk := v_risk + 30;
    v_flags := v_flags || '"margin_declining"'::jsonb;
  END IF;

  IF v_burn.labor_risk_flag THEN
    v_risk := v_risk + 25;
    v_flags := v_flags || '"labor_burn_high"'::jsonb;
  END IF;

  IF v_omp.historical_margin_low_band IS NOT NULL
     AND COALESCE(v_snap.realized_margin_ratio, 0) < v_omp.historical_margin_low_band THEN
    v_risk := v_risk + 20;
    v_flags := v_flags || '"below_low_band"'::jsonb;
  END IF;

  IF COALESCE(v_omp.completed_projects_count, 0) < 5 THEN
    v_risk := v_risk + 15;
    v_flags := v_flags || '"low_historical_data"'::jsonb;
  END IF;

  -- Clamp
  v_risk := LEAST(GREATEST(v_risk, 0), 100);

  -- Position
  IF v_risk > 60 THEN v_position := 'at_risk';
  ELSIF v_risk >= 30 THEN v_position := 'volatile';
  ELSE v_position := 'stable';
  END IF;

  RETURN jsonb_build_object(
    'economic_position',                    v_position,
    'risk_score',                           v_risk,
    'margin_trajectory',                    CASE WHEN v_proj.margin_declining_flag THEN 'declining' ELSE 'stable_or_improving' END,
    'projected_margin_at_completion_percent', round(COALESCE(v_proj.projected_margin_at_completion_ratio, 0) * 100, 2),
    'historical_org_margin_percent',         round(COALESCE(v_omp.historical_avg_margin_ratio, 0) * 100, 2),
    'intervention_priority',                 ceil(v_risk::numeric / 20),
    'intervention_flags',                    v_flags,
    'guardrail_recommendation',              CASE WHEN v_risk >= 60 THEN 'block' ELSE 'warn' END,
    'executive_summary',                     CASE
                                               WHEN v_risk > 60 THEN 'Project margin is at risk. Immediate review recommended.'
                                               WHEN v_risk >= 30 THEN 'Project margin is volatile. Monitor closely.'
                                               ELSE 'Project margin is within acceptable range.'
                                             END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_generate_project_margin_control(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_generate_project_margin_control(uuid) TO authenticated;
