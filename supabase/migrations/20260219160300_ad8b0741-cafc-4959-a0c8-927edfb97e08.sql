
CREATE OR REPLACE FUNCTION public.rpc_get_operating_system_score(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_margin_score      numeric;
  v_workflow_score     numeric;
  v_guardrail_score    numeric;
  v_automation_score   numeric;
  v_maturity           numeric;
  v_tier               text;
  v_stddev             numeric;
  v_total_projects     bigint;
  v_playbook_projects  bigint;
  v_total_entries      bigint;
  v_clean_entries      bigint;
  v_compliant_projects bigint;
  v_projects_with_wf   bigint;
BEGIN
  -- Validate membership
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  -- 1. Margin consistency from org margin performance
  SELECT COALESCE(historical_margin_stddev, 0) INTO v_stddev
  FROM v_org_margin_performance WHERE org_id = p_org_id;
  v_margin_score := GREATEST(0, LEAST(100, 100 - COALESCE(v_stddev, 0) * 100));

  -- 2. Workflow compliance: % of projects where all steps are 'met'
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM project_workflow_steps s
      WHERE s.project_id = pw.project_id
        AND s.organization_id = p_org_id
        AND s.status IS DISTINCT FROM 'met'
    ))
  INTO v_projects_with_wf, v_compliant_projects
  FROM (SELECT DISTINCT project_id FROM project_workflow_steps WHERE organization_id = p_org_id) pw;

  v_workflow_score := CASE WHEN COALESCE(v_projects_with_wf, 0) = 0 THEN 0
    ELSE ROUND(v_compliant_projects::numeric / v_projects_with_wf * 100, 2) END;

  -- 3. Guardrail discipline: % of time entries not flagged
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE NOT is_flagged)
  INTO v_total_entries, v_clean_entries
  FROM time_entries WHERE organization_id = p_org_id;

  v_guardrail_score := CASE WHEN COALESCE(v_total_entries, 0) = 0 THEN 100
    ELSE ROUND(v_clean_entries::numeric / v_total_entries * 100, 2) END;

  -- 4. Automation: % of projects created via playbook
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE applied_playbook_id IS NOT NULL)
  INTO v_total_projects, v_playbook_projects
  FROM projects WHERE organization_id = p_org_id;

  v_automation_score := CASE WHEN COALESCE(v_total_projects, 0) = 0 THEN 0
    ELSE ROUND(v_playbook_projects::numeric / v_total_projects * 100, 2) END;

  -- 5. Maturity: weighted average (margin 30%, workflow 25%, guardrail 25%, automation 20%)
  v_maturity := ROUND(
    v_margin_score * 0.30 +
    v_workflow_score * 0.25 +
    v_guardrail_score * 0.25 +
    v_automation_score * 0.20
  , 2);

  -- Tier
  IF v_maturity > 80 THEN v_tier := 'gold';
  ELSIF v_maturity >= 60 THEN v_tier := 'silver';
  ELSE v_tier := 'bronze';
  END IF;

  RETURN jsonb_build_object(
    'maturity_score',               v_maturity,
    'margin_consistency_score',     v_margin_score,
    'workflow_compliance_score',    v_workflow_score,
    'guardrail_discipline_score',   v_guardrail_score,
    'automation_score',             v_automation_score,
    'certification_tier',           v_tier
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_operating_system_score(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_operating_system_score(uuid) TO authenticated;
