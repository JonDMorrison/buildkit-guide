
CREATE OR REPLACE FUNCTION public.rpc_generate_project_margin_control(p_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  IF NOT public.rpc_is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- Read views
  SELECT * INTO v_snap FROM v_project_economic_snapshot WHERE project_id = p_project_id;
  SELECT * INTO v_omp  FROM v_org_margin_performance    WHERE org_id = v_org_id;
  SELECT * INTO v_burn FROM v_project_labor_burn_index   WHERE project_id = p_project_id;
  SELECT * INTO v_proj FROM v_project_margin_projection  WHERE project_id = p_project_id;

  -- Compute risk score and collect flags
  IF v_proj.margin_declining_flag THEN
    v_risk := v_risk + 30;
    v_flags := v_flags || to_jsonb('margin_declining'::text);
  END IF;

  IF v_burn.labor_risk_flag THEN
    v_risk := v_risk + 25;
    v_flags := v_flags || to_jsonb('labor_burn_high'::text);
  END IF;

  IF v_omp.historical_margin_low_band IS NOT NULL
     AND coalesce(v_snap.realized_margin_ratio, 0) < v_omp.historical_margin_low_band THEN
    v_risk := v_risk + 20;
    v_flags := v_flags || to_jsonb('below_low_band'::text);
  END IF;

  IF coalesce(v_omp.completed_projects_count, 0) < 5 THEN
    v_risk := v_risk + 15;
    v_flags := v_flags || to_jsonb('low_historical_data'::text);
  END IF;

  -- Clamp
  v_risk := least(greatest(v_risk, 0), 100);

  -- Sort flags alphabetically for determinism
  SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb)
  INTO v_flags
  FROM (
    SELECT DISTINCT value AS x
    FROM jsonb_array_elements_text(v_flags)
  ) s;

  -- Position
  IF v_risk > 60 THEN v_position := 'at_risk';
  ELSIF v_risk >= 30 THEN v_position := 'volatile';
  ELSE v_position := 'stable';
  END IF;

  RETURN jsonb_build_object(
    'economic_position',                     v_position,
    'executive_summary',                     CASE
                                               WHEN v_risk > 60 THEN 'Project margin is at risk. Immediate review recommended.'
                                               WHEN v_risk >= 30 THEN 'Project margin is volatile. Monitor closely.'
                                               ELSE 'Project margin is within acceptable range.'
                                             END,
    'guardrail_recommendation',              CASE WHEN v_risk >= 60 THEN 'block' ELSE 'warn' END,
    'historical_org_margin_percent',         round(coalesce(v_omp.historical_avg_margin_ratio, 0)::numeric * 100, 2),
    'intervention_flags',                    v_flags,
    'intervention_priority',                 ceil(v_risk::numeric / 20),
    'margin_trajectory',                     CASE WHEN v_proj.margin_declining_flag THEN 'declining' ELSE 'stable_or_improving' END,
    'projected_margin_at_completion_percent', round(coalesce(v_proj.projected_margin_at_completion_ratio, 0)::numeric * 100, 2),
    'risk_score',                            v_risk
  );
END;
$function$;
