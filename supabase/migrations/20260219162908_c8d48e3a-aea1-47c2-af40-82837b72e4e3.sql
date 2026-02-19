
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
  v_stddev := COALESCE(v_stddev, 0);
  v_margin_score := round(GREATEST(0, LEAST(100, 100 - v_stddev * 100))::numeric, 2);

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

  v_workflow_score := round(
    COALESCE(v_compliant_projects, 0)::numeric / nullif(COALESCE(v_projects_with_wf, 0), 0) * 100,
    2
  );
  v_workflow_score := COALESCE(v_workflow_score, 0);

  -- 3. Guardrail discipline: % of time entries not flagged
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE NOT is_flagged)
  INTO v_total_entries, v_clean_entries
  FROM time_entries WHERE organization_id = p_org_id;

  v_guardrail_score := round(
    COALESCE(v_clean_entries, 0)::numeric / nullif(COALESCE(v_total_entries, 0), 0) * 100,
    2
  );
  v_guardrail_score := COALESCE(v_guardrail_score, 100);

  -- 4. Automation: % of projects created via playbook
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE applied_playbook_id IS NOT NULL)
  INTO v_total_projects, v_playbook_projects
  FROM projects WHERE organization_id = p_org_id;

  v_automation_score := round(
    COALESCE(v_playbook_projects, 0)::numeric / nullif(COALESCE(v_total_projects, 0), 0) * 100,
    2
  );
  v_automation_score := COALESCE(v_automation_score, 0);

  -- 5. Maturity: weighted average (margin 30%, workflow 25%, guardrail 25%, automation 20%)
  v_maturity := round((
    COALESCE(v_margin_score, 0) * 0.30 +
    COALESCE(v_workflow_score, 0) * 0.25 +
    COALESCE(v_guardrail_score, 0) * 0.25 +
    COALESCE(v_automation_score, 0) * 0.20
  )::numeric, 2);

  -- Tier
  IF v_maturity > 80 THEN v_tier := 'gold';
  ELSIF v_maturity >= 60 THEN v_tier := 'silver';
  ELSE v_tier := 'bronze';
  END IF;

  RETURN jsonb_build_object(
    'automation_score',             round(v_automation_score::numeric, 2),
    'certification_tier',           v_tier,
    'guardrail_discipline_score',   round(v_guardrail_score::numeric, 2),
    'margin_consistency_score',     round(v_margin_score::numeric, 2),
    'maturity_score',               round(v_maturity::numeric, 2),
    'workflow_compliance_score',    round(v_workflow_score::numeric, 2)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_operating_system_score(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_operating_system_score(uuid) TO authenticated;
