
-- RPC: project_task_actual_hours
-- Returns actual hours per task_id for a project, using same criteria as project_actual_costs
CREATE OR REPLACE FUNCTION public.project_task_actual_hours(p_project_id uuid)
RETURNS TABLE(task_id uuid, actual_hours numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT p.organization_id INTO v_org_id
  FROM public.projects p WHERE p.id = p_project_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found: %', p_project_id;
  END IF;
  IF NOT public.has_org_membership(v_org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization';
  END IF;

  RETURN QUERY
    SELECT te.task_id, round(COALESCE(SUM(te.duration_hours), 0), 2)
    FROM public.time_entries te
    WHERE te.project_id = p_project_id
      AND te.status = 'closed'
      AND te.duration_hours IS NOT NULL
      AND te.task_id IS NOT NULL
    GROUP BY te.task_id;
END;
$$;

-- RPC: assign_time_entry_task
-- Assigns a task to a time entry with full server-side validation
CREATE OR REPLACE FUNCTION public.assign_time_entry_task(p_time_entry_id uuid, p_task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_project_id uuid;
  v_entry_org_id uuid;
  v_task_project_id uuid;
  v_caller_role text;
BEGIN
  -- Get time entry info
  SELECT te.project_id, p.organization_id
  INTO v_entry_project_id, v_entry_org_id
  FROM public.time_entries te
  JOIN public.projects p ON p.id = te.project_id
  WHERE te.id = p_time_entry_id;

  IF v_entry_project_id IS NULL THEN
    RAISE EXCEPTION 'Time entry not found: %', p_time_entry_id;
  END IF;

  -- Check org membership
  IF NOT public.has_org_membership(v_entry_org_id) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization';
  END IF;

  -- Check caller is admin or PM (org-level or project-level)
  v_caller_role := public.org_role(v_entry_org_id);
  IF v_caller_role NOT IN ('admin', 'owner') THEN
    -- Check project-level role
    IF NOT EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = v_entry_project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin', 'project_manager')
    ) THEN
      RAISE EXCEPTION 'Access denied: admin or project manager role required';
    END IF;
  END IF;

  -- Validate task belongs to same project
  SELECT t.project_id INTO v_task_project_id
  FROM public.tasks t WHERE t.id = p_task_id;

  IF v_task_project_id IS NULL THEN
    RAISE EXCEPTION 'Task not found: %', p_task_id;
  END IF;

  IF v_task_project_id != v_entry_project_id THEN
    RAISE EXCEPTION 'Task and time entry must belong to the same project';
  END IF;

  -- Perform update
  UPDATE public.time_entries
  SET task_id = p_task_id
  WHERE id = p_time_entry_id;

  RETURN true;
END;
$$;
