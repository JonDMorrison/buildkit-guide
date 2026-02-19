
CREATE OR REPLACE FUNCTION public.rpc_get_project_workflow(p_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_required boolean;
  -- org intelligence
  v_org_id uuid;
  v_oip RECORD;
  v_has_oip boolean := false;
  -- operational profile scores
  v_scores jsonb;
  v_has_scores boolean := false;
  v_risk_score int;
  v_automation int;
  v_control int;
  v_profit_vis int;
  -- economic review injection
  v_margin_ctrl jsonb;
  v_econ_risk int;
BEGIN
  IF NOT has_project_access(p_project_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Get org id
  SELECT organization_id INTO v_org_id FROM projects WHERE id = p_project_id;

  SELECT * INTO v_pw FROM project_workflows WHERE project_id = p_project_id;
  IF v_pw.id IS NULL THEN
    INSERT INTO project_workflows (project_id, organization_id)
      VALUES (p_project_id, v_org_id)
      RETURNING * INTO v_pw;
  END IF;

  -- Load org intelligence profile (backward compatible: may not exist)
  SELECT * INTO v_oip FROM organization_intelligence_profile WHERE organization_id = v_org_id;
  v_has_oip := v_oip.organization_id IS NOT NULL;

  -- Load operational profile scores (backward compatible)
  SELECT score_snapshot INTO v_scores
  FROM organization_operational_profile
  WHERE organization_id = v_org_id AND score_snapshot IS NOT NULL;
  
  IF v_scores IS NOT NULL THEN
    v_has_scores := true;
    v_risk_score := COALESCE((v_scores->>'risk_score')::int, 50);
    v_automation := COALESCE((v_scores->>'automation_readiness')::int, 0);
    v_control := COALESCE((v_scores->>'control_index')::int, 50);
    v_profit_vis := COALESCE((v_scores->>'profit_visibility_score')::int, 50);
  END IF;

  -- Pre-compute economic risk score for injection (idempotent, read-only)
  BEGIN
    v_margin_ctrl := public.rpc_generate_project_margin_control(p_project_id);
    v_econ_risk := COALESCE((v_margin_ctrl->>'risk_score')::int, 0);
  EXCEPTION WHEN OTHERS THEN
    v_econ_risk := 0;
  END;

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
      v_required := COALESCE((v_req.meta->>'required')::boolean, true);

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
        WHEN 'require_schedule_set' THEN
          DECLARE v_proj projects%ROWTYPE;
          BEGIN
            SELECT * INTO v_proj FROM projects WHERE id = p_project_id;
            v_passed := v_proj.start_date IS NOT NULL AND v_proj.end_date IS NOT NULL;
            IF NOT v_passed THEN v_msg := 'Start/end dates not set'; END IF;
          END;
        WHEN 'require_job_sites_created' THEN
          SELECT count(*) INTO v_count FROM job_sites WHERE project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No job sites created'; END IF;
        WHEN 'require_all_tasks_complete' THEN
          SELECT count(*) INTO v_count FROM tasks
            WHERE project_id = p_project_id AND status NOT IN ('completed', 'cancelled');
          v_passed := v_count = 0;
          IF NOT v_passed THEN v_msg := v_count || ' task(s) still incomplete'; END IF;
        WHEN 'require_deficiencies_resolved' THEN
          SELECT count(*) INTO v_count FROM deficiencies
            WHERE project_id = p_project_id AND status NOT IN ('resolved', 'closed') AND NOT is_deleted;
          v_passed := v_count = 0;
          IF NOT v_passed THEN v_msg := v_count || ' deficiency(ies) unresolved'; END IF;
        WHEN 'require_daily_log_recent' THEN
          SELECT count(*) INTO v_count FROM daily_logs
            WHERE project_id = p_project_id AND log_date >= current_date - 7;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No daily log in last 7 days'; END IF;
        WHEN 'require_safety_inspection_recent' THEN
          SELECT count(*) INTO v_count FROM safety_forms
            WHERE project_id = p_project_id AND inspection_date >= current_date - 14;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No safety inspection in last 14 days'; END IF;
        WHEN 'require_invoice_sent' THEN
          SELECT count(*) INTO v_count FROM invoices
            WHERE project_id = p_project_id AND status NOT IN ('draft', 'void');
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No invoice sent'; END IF;
        WHEN 'require_payment_received' THEN
          SELECT count(*) INTO v_count FROM invoice_payments ip
            JOIN invoices i ON i.id = ip.invoice_id
            WHERE i.project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No payment received'; END IF;
        WHEN 'require_final_walkthrough' THEN
          v_passed := false;
          v_msg := 'Final walkthrough not recorded';
        WHEN 'require_client_signoff' THEN
          v_passed := false;
          v_msg := 'Client sign-off not recorded';
        WHEN 'require_retainage_released' THEN
          SELECT count(*) INTO v_count FROM invoices
            WHERE project_id = p_project_id AND retainage_released = true;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'Retainage not released'; END IF;
        WHEN 'require_task_list_created' THEN
          SELECT count(*) INTO v_count FROM tasks WHERE project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No tasks created'; END IF;
        WHEN 'require_time_entries_approved' THEN
          SELECT count(*) INTO v_count FROM time_entries
            WHERE project_id = p_project_id AND status NOT IN ('approved', 'locked', 'posted');
          v_passed := v_count = 0;
          IF NOT v_passed THEN v_msg := v_count || ' time entry(ies) not approved'; END IF;
        WHEN 'require_all_invoices_paid' THEN
          SELECT count(*) INTO v_count FROM invoices
            WHERE project_id = p_project_id AND status NOT IN ('paid', 'void') AND total > 0;
          v_passed := v_count = 0;
          IF NOT v_passed THEN v_msg := v_count || ' invoice(s) unpaid'; END IF;
        WHEN 'require_estimate_approved' THEN
          SELECT count(*) INTO v_count FROM estimates
            WHERE project_id = p_project_id AND status = 'approved';
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No approved estimate'; END IF;
        ELSE
          v_passed := false;
          v_msg := 'Unknown requirement: ' || v_req.requirement_type;
      END CASE;

      v_reqs := v_reqs || jsonb_build_object(
        'id', v_req.id,
        'key', v_req.requirement_type,
        'requirement_type', v_req.requirement_type,
        'label', v_req.label,
        'status', CASE WHEN v_passed THEN 'met' ELSE 'unmet' END,
        'passed', v_passed,
        'details', NULLIF(v_msg, ''),
        'message', v_msg,
        'required', v_required
      );
    END LOOP;

    -- ============================================================
    -- ORG INTELLIGENCE INJECTION (backward-compatible)
    -- ============================================================
    IF v_has_oip THEN

      IF v_oip.loss_absorption_mode = 'absorb' AND v_phase.key = 'pm_closeout' THEN
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_reqs) AS r WHERE r->>'key' = 'org_require_variance_review'
        ) THEN
          v_reqs := v_reqs || jsonb_build_object(
            'id', 'org_inject_variance_review',
            'key', 'org_require_variance_review',
            'requirement_type', 'org_require_variance_review',
            'label', 'Variance review required before closeout (org absorbs losses)',
            'status', 'unmet',
            'passed', false,
            'details', 'Organization policy: losses are absorbed without review. Variance review enforced.',
            'message', 'Variance review required',
            'required', true,
            'source', 'org_intelligence'
          );
        END IF;
      END IF;

      IF v_oip.time_audit_mode = 'none' AND v_phase.key = 'foreman_review' THEN
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_reqs) AS r WHERE r->>'key' = 'org_require_time_audit'
        ) THEN
          v_reqs := v_reqs || jsonb_build_object(
            'id', 'org_inject_time_audit',
            'key', 'org_require_time_audit',
            'requirement_type', 'org_require_time_audit',
            'label', 'Time audit required (org has no time auditing)',
            'status', 'unmet',
            'passed', false,
            'details', 'Organization does not audit time entries. Manual audit enforced.',
            'message', 'Time audit required',
            'required', true,
            'source', 'org_intelligence'
          );
        END IF;
      END IF;

    END IF;

    -- ============================================================
    -- OPERATIONAL PROFILE SCORE-DRIVEN INJECTIONS
    -- ============================================================
    IF v_has_scores THEN

      -- HIGH RISK (risk_score > 70): require strict approval on estimate phase
      IF v_risk_score > 70 THEN

        IF v_phase.key = 'estimating' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_reqs) AS r
          WHERE r->>'key' IN ('org_strict_estimate_approval', 'score_require_estimate_approval')
        ) THEN
          SELECT count(*) INTO v_count FROM estimates
            WHERE project_id = p_project_id AND status = 'approved';
          v_passed := v_count > 0;
          v_msg := CASE WHEN v_passed THEN '' ELSE 'No approved estimate (high risk profile requires approval)' END;
          v_reqs := v_reqs || jsonb_build_object(
            'id', 'score_estimate_approval',
            'key', 'score_require_estimate_approval',
            'requirement_type', 'score_require_estimate_approval',
            'label', 'Estimate approval required (risk score > 70)',
            'status', CASE WHEN v_passed THEN 'met' ELSE 'unmet' END,
            'passed', v_passed,
            'details', NULLIF(v_msg, ''),
            'message', v_msg,
            'required', true,
            'source', 'operational_profile_score',
            'score_trigger', jsonb_build_object('risk_score', v_risk_score)
          );
        END IF;

      END IF; -- risk > 70

      -- HIGH AUTOMATION (automation_readiness > 60): suggest AI-driven scope validation
      IF v_automation > 60 THEN

        IF v_phase.key = 'scope' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_reqs) AS r
          WHERE r->>'key' = 'score_suggest_ai_scope_validation'
        ) THEN
          v_reqs := v_reqs || jsonb_build_object(
            'id', 'score_ai_scope',
            'key', 'score_suggest_ai_scope_validation',
            'requirement_type', 'score_suggest_ai_scope_validation',
            'label', 'AI scope validation available (automation readiness > 60)',
            'status', 'met',
            'passed', true,
            'details', 'Organization automation readiness supports AI-driven scope validation',
            'message', '',
            'required', false,
            'source', 'operational_profile_score',
            'score_trigger', jsonb_build_object('automation_readiness', v_automation)
          );
        END IF;

      END IF; -- automation > 60

      -- LOW CONTROL (control_index < 40): mandate invoice approval
      IF v_control < 40 THEN

        IF v_phase.key = 'pm_closeout' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_reqs) AS r
          WHERE r->>'key' IN ('org_strict_invoice_approval', 'score_require_invoice_approval')
        ) THEN
          SELECT count(*) INTO v_count FROM invoices
            WHERE project_id = p_project_id
              AND approval_status IS DISTINCT FROM 'approved'
              AND status NOT IN ('void', 'draft');
          v_passed := v_count = 0;
          v_msg := CASE WHEN v_passed THEN '' ELSE v_count || ' invoice(s) need approval (low control index)' END;
          v_reqs := v_reqs || jsonb_build_object(
            'id', 'score_invoice_approval',
            'key', 'score_require_invoice_approval',
            'requirement_type', 'score_require_invoice_approval',
            'label', 'Invoice approval required (control index < 40)',
            'status', CASE WHEN v_passed THEN 'met' ELSE 'unmet' END,
            'passed', v_passed,
            'details', NULLIF(v_msg, ''),
            'message', v_msg,
            'required', true,
            'source', 'operational_profile_score',
            'score_trigger', jsonb_build_object('control_index', v_control)
          );
        END IF;

      END IF; -- control < 40

      -- LOW PROFIT VISIBILITY (profit_visibility_score < 50): require variance review
      IF v_profit_vis < 50 THEN

        IF v_phase.key = 'foreman_review' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_reqs) AS r
          WHERE r->>'key' = 'score_require_variance_review'
        ) THEN
          -- Check if variance summary has been reviewed (estimate exists with line items)
          DECLARE
            v_has_variance_data boolean := false;
          BEGIN
            SELECT EXISTS(
              SELECT 1 FROM estimates e
              JOIN estimate_line_items eli ON eli.estimate_id = e.id
              WHERE e.project_id = p_project_id
            ) INTO v_has_variance_data;
            v_passed := v_has_variance_data;
            v_msg := CASE WHEN v_passed THEN '' ELSE 'Variance review required: estimate data with line items needed (low profit visibility)' END;
          END;
          v_reqs := v_reqs || jsonb_build_object(
            'id', 'score_variance_review',
            'key', 'score_require_variance_review',
            'requirement_type', 'score_require_variance_review',
            'label', 'Variance review required (profit visibility < 50)',
            'status', CASE WHEN v_passed THEN 'met' ELSE 'unmet' END,
            'passed', v_passed,
            'details', NULLIF(v_msg, ''),
            'message', v_msg,
            'required', true,
            'source', 'operational_profile_score',
            'score_trigger', jsonb_build_object('profit_visibility_score', v_profit_vis)
          );
        END IF;

      END IF; -- profit_vis < 50

    END IF; -- v_has_scores
    -- ============================================================

    -- ============================================================
    -- ECONOMIC REVIEW INJECTION (margin control engine)
    -- ============================================================
    IF v_econ_risk > 60 AND v_phase.key = 'foreman_review' THEN
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_reqs) AS r
        WHERE r->>'key' = 'economic_review_required'
      ) THEN
        v_reqs := v_reqs || jsonb_build_object(
          'id', 'econ_review_inject',
          'key', 'economic_review_required',
          'requirement_type', 'economic_review_required',
          'label', 'Economic Review Required',
          'status', 'pending',
          'passed', false,
          'details', 'Project risk score is ' || v_econ_risk || '. Economic review required before proceeding.',
          'message', 'Economic review required (risk score > 60)',
          'required', true,
          'source', 'margin_control_engine',
          'score_trigger', jsonb_build_object('economic_risk_score', v_econ_risk)
        );
      END IF;
    END IF;
    -- ============================================================

    v_phases := v_phases || jsonb_build_object(
      'key', v_phase.key,
      'label', v_phase.label,
      'description', v_phase.description,
      'sort_order', v_phase.sort_order,
      'allowed_requester_roles', to_jsonb(v_phase.allowed_requester_roles),
      'allowed_approver_roles', to_jsonb(v_phase.allowed_approver_roles),
      'step', jsonb_build_object(
        'id', v_step.id,
        'status', v_step.status,
        'requested_by', v_step.requested_by,
        'requested_at', v_step.requested_at,
        'approved_by', v_step.approved_by,
        'approved_at', v_step.approved_at,
        'notes', v_step.notes
      ),
      'requirements', v_reqs
    );
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_pw.id,
    'project_id', v_pw.project_id,
    'flow_mode', v_pw.flow_mode,
    'current_phase', v_pw.current_phase,
    'org_intelligence_applied', v_has_oip,
    'score_driven_applied', v_has_scores,
    'active_scores', CASE WHEN v_has_scores THEN v_scores ELSE NULL END,
    'phases', v_phases
  );
END;
$function$;
