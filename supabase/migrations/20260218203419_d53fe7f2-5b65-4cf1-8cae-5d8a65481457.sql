
-- RPC to update project status with role enforcement
CREATE OR REPLACE FUNCTION public.rpc_update_project_status(p_project_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project projects%ROWTYPE;
  v_org_role text;
  v_caller uuid := auth.uid();
  v_old_status text;
BEGIN
  -- Validate status value
  IF p_status NOT IN ('not_started', 'in_progress', 'completed', 'archived', 'deleted') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be one of: not_started, in_progress, completed, archived, deleted', p_status;
  END IF;

  -- Fetch project
  SELECT * INTO v_project FROM projects WHERE id = p_project_id;
  IF v_project.id IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  v_old_status := v_project.status;

  -- Verify org membership and get role
  SELECT om.role INTO v_org_role
  FROM organization_memberships om
  WHERE om.organization_id = v_project.organization_id
    AND om.user_id = v_caller;

  IF v_org_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  -- Only admin and project_manager can change status
  IF v_org_role NOT IN ('admin', 'pm') THEN
    RAISE EXCEPTION 'Only Admin or Project Manager can change project status';
  END IF;

  -- No-op if same status
  IF v_old_status = p_status THEN
    RETURN;
  END IF;

  -- Update status
  UPDATE projects
  SET status = p_status, updated_at = now()
  WHERE id = p_project_id;

  -- Notify project members about status change
  INSERT INTO notifications (user_id, project_id, type, title, message, link_url)
  SELECT pm.user_id, p_project_id, 'general',
    'Project Status Updated',
    'Project status changed to ' || replace(p_status, '_', ' '),
    '/project/' || p_project_id::text
  FROM project_members pm
  WHERE pm.project_id = p_project_id
    AND pm.user_id != v_caller;
END;
$$;
