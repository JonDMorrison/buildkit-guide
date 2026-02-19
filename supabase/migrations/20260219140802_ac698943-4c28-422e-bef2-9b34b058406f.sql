
-- RPC to fetch playbook baseline data for a project's applied playbook
CREATE OR REPLACE FUNCTION public.get_playbook_baseline(p_project_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_playbook_id uuid;
  v_playbook_name text;
  v_playbook_version int;
  v_total_hours_low numeric := 0;
  v_total_hours_high numeric := 0;
  v_total_hours_midpoint numeric := 0;
  v_required_hours_low numeric := 0;
  v_required_hours_high numeric := 0;
  v_task_count int := 0;
  v_required_task_count int := 0;
  v_org_id uuid;
BEGIN
  -- Verify org membership
  SELECT p.organization_id, p.applied_playbook_id, p.applied_playbook_version
  INTO v_org_id, v_playbook_id, v_playbook_version
  FROM projects p
  WHERE p.id = p_project_id;

  IF v_org_id IS NULL THEN
    RETURN json_build_object('has_playbook', false);
  END IF;

  -- Check org membership
  IF NOT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = v_org_id
      AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_playbook_id IS NULL THEN
    RETURN json_build_object('has_playbook', false);
  END IF;

  -- Get playbook name
  SELECT pb.name INTO v_playbook_name
  FROM playbooks pb WHERE pb.id = v_playbook_id;

  -- Aggregate task hour bands from playbook
  SELECT
    count(*),
    count(*) FILTER (WHERE pt.required_flag = true),
    coalesce(sum(pt.expected_hours_low), 0),
    coalesce(sum(pt.expected_hours_high), 0),
    coalesce(sum(pt.expected_hours_low) FILTER (WHERE pt.required_flag = true), 0),
    coalesce(sum(pt.expected_hours_high) FILTER (WHERE pt.required_flag = true), 0)
  INTO v_task_count, v_required_task_count,
       v_total_hours_low, v_total_hours_high,
       v_required_hours_low, v_required_hours_high
  FROM playbook_tasks pt
  JOIN playbook_phases pp ON pp.id = pt.playbook_phase_id
  WHERE pp.playbook_id = v_playbook_id;

  v_total_hours_midpoint := (v_total_hours_low + v_total_hours_high) / 2.0;

  RETURN json_build_object(
    'has_playbook', true,
    'playbook_id', v_playbook_id,
    'playbook_name', v_playbook_name,
    'playbook_version', v_playbook_version,
    'task_count', v_task_count,
    'required_task_count', v_required_task_count,
    'hours_low', round(v_total_hours_low, 1),
    'hours_high', round(v_total_hours_high, 1),
    'hours_midpoint', round(v_total_hours_midpoint, 1),
    'required_hours_low', round(v_required_hours_low, 1),
    'required_hours_high', round(v_required_hours_high, 1)
  );
END;
$$;
