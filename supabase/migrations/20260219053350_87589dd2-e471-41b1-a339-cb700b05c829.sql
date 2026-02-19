CREATE OR REPLACE FUNCTION public.rpc_get_project_workflow(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pw project_workflows%ROWTYPE;
  v_phases jsonb := '[]'::jsonb;
  v_phase RECORD;
  v_step RECORD;
  v_reqs jsonb;
  v_req RECORD;
  v_passed boolean;
  v_msg text;
  v_count int;
BEGIN
  IF NOT has_project_access(p_project_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pw FROM project_workflows WHERE project_id = p_project_id;
  IF v_pw.id IS NULL THEN
    INSERT INTO project_workflows (project_id, organization_id)
      VALUES (p_project_id, (SELECT organization_id FROM projects WHERE id = p_project_id))
      RETURNING * INTO v_pw;
  END IF;

  FOR v_phase IN SELECT * FROM workflow_phases ORDER BY sort_order LOOP
    SELECT * INTO v_step FROM project_workflow_steps
      WHERE project_id = p_project_id AND phase_key = v_phase.key;
    IF v_step.id IS NULL THEN
      INSERT INTO project_workflow_steps (project_id, organization_id, phase_key)
        VALUES (p_project_id, v_pw.organization_id, v_phase.key) RETURNING * INTO v_step;
    END IF;

    v_reqs := '[]'::jsonb;
    FOR v_req IN SELECT * FROM workflow_phase_requirements WHERE phase_key = v_phase.key LOOP
      v_passed := false;
      v_msg := '';
      CASE v_req.requirement_type
        WHEN 'require_estimate_exists' THEN
          SELECT count(*) INTO v_count FROM estimates WHERE project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No estimate found'; END IF;
        WHEN 'require_estimate_line_items_min' THEN
          SELECT count(*) INTO v_count FROM estimate_line_items eli
            JOIN estimates e ON e.id = eli.estimate_id WHERE e.project_id = p_project_id;
          v_passed := v_count >= COALESCE((v_req.meta->>'min')::int, 1);
          IF NOT v_passed THEN v_msg := 'Not enough line items'; END IF;
        WHEN 'require_quote_exists' THEN
          SELECT count(*) INTO v_count FROM quotes WHERE project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No quote found'; END IF;
        WHEN 'require_quote_approved' THEN
          SELECT count(*) INTO v_count FROM quotes
            WHERE project_id = p_project_id AND status = 'approved';
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No approved quote found'; END IF;
        WHEN 'require_proposal_approved' THEN
          SELECT count(*) INTO v_count FROM proposals
            WHERE project_id = p_project_id AND status = 'approved';
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No approved proposal found'; END IF;
        WHEN 'require_scope_items_exist' THEN
          SELECT count(*) INTO v_count FROM project_scope_items
            WHERE project_id = p_project_id AND NOT is_archived;
          v_passed := v_count >= COALESCE((v_req.meta->>'min')::int, 1);
          IF NOT v_passed THEN v_msg := 'No active scope items'; END IF;
        WHEN 'require_tasks_generated_from_scope' THEN
          SELECT count(*) INTO v_count FROM tasks
            WHERE project_id = p_project_id AND scope_item_id IS NOT NULL;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No tasks generated from scope'; END IF;
        WHEN 'require_foreman_assigned' THEN
          SELECT count(*) INTO v_count FROM project_members
            WHERE project_id = p_project_id AND role = 'foreman';
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No foreman assigned'; END IF;
        WHEN 'require_trades_assigned' THEN
          SELECT count(*) INTO v_count FROM task_assignments ta
            JOIN tasks t ON t.id = ta.task_id WHERE t.project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No trade workers assigned'; END IF;
        WHEN 'require_safety_form_submitted' THEN
          SELECT count(*) INTO v_count FROM safety_forms
            WHERE project_id = p_project_id AND status = 'completed';
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No safety form submitted'; END IF;
        WHEN 'require_time_entries_exist' THEN
          SELECT count(*) INTO v_count FROM time_entries WHERE project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No time entries found'; END IF;
        WHEN 'require_receipt_submitted' THEN
          SELECT count(*) INTO v_count FROM receipts WHERE project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No receipts submitted'; END IF;
        WHEN 'require_task_list_created' THEN
          SELECT count(*) INTO v_count FROM tasks WHERE project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No tasks created'; END IF;
        ELSE
          v_msg := 'Unknown requirement: ' || v_req.requirement_type;
      END CASE;

      v_reqs := v_reqs || jsonb_build_object(
        'id', v_req.id, 'type', v_req.requirement_type,
        'label', v_req.requirement_label, 'passed', v_passed, 'message', v_msg
      );
    END LOOP;

    v_phases := v_phases || jsonb_build_object(
      'key', v_phase.key, 'label', v_phase.label,
      'sort_order', v_phase.sort_order,
      'description', COALESCE(v_phase.description, ''),
      'is_approval_required', v_phase.is_approval_required,
      'allowed_requester_roles', COALESCE(v_phase.allowed_requester_roles, '{}'),
      'allowed_approver_roles', COALESCE(v_phase.allowed_approver_roles, '{}'),
      'status', COALESCE(v_step.status, 'not_started'),
      'requested_by', v_step.requested_by, 'requested_at', v_step.requested_at,
      'approved_by', v_step.approved_by, 'approved_at', v_step.approved_at,
      'notes', v_step.notes, 'requirements', v_reqs
    );
  END LOOP;

  RETURN jsonb_build_object(
    'flow_mode', v_pw.flow_mode,
    'current_phase', v_pw.current_phase,
    'phases', v_phases
  );
END;
$$;