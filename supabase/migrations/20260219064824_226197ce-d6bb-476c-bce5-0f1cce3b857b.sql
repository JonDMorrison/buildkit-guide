
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
        WHEN 'require_trades_assigned' THEN
          SELECT count(*) INTO v_count FROM task_assignments ta
            JOIN tasks t ON t.id = ta.task_id WHERE t.project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No trade workers assigned'; END IF;
        WHEN 'require_safety_form_submitted' THEN
          SELECT count(*) INTO v_count FROM safety_forms
            WHERE project_id = p_project_id AND status IN ('submitted', 'reviewed');
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No safety form submitted'; END IF;
        WHEN 'require_time_entries_exist' THEN
          SELECT count(*) INTO v_count FROM time_entries WHERE project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No time entries found'; END IF;
        WHEN 'require_receipt_submitted' THEN
          SELECT count(*) INTO v_count FROM receipts WHERE project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No receipt submitted'; END IF;
        WHEN 'require_all_tasks_completed' THEN
          SELECT count(*) INTO v_count FROM tasks
            WHERE project_id = p_project_id AND status <> 'completed';
          v_passed := v_count = 0;
          IF NOT v_passed THEN v_msg := v_count || ' tasks not completed'; END IF;
        WHEN 'require_daily_log_submitted' THEN
          SELECT count(*) INTO v_count FROM daily_logs WHERE project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No daily log submitted'; END IF;
        WHEN 'require_all_blockers_resolved' THEN
          SELECT count(*) INTO v_count FROM blockers b
            JOIN tasks t ON t.id = b.task_id
            WHERE t.project_id = p_project_id AND NOT b.is_resolved;
          v_passed := v_count = 0;
          IF NOT v_passed THEN v_msg := v_count || ' unresolved blockers'; END IF;
        WHEN 'require_deficiencies_resolved' THEN
          SELECT count(*) INTO v_count FROM deficiencies
            WHERE project_id = p_project_id AND status <> 'resolved' AND NOT is_deleted;
          v_passed := v_count = 0;
          IF NOT v_passed THEN v_msg := v_count || ' unresolved deficiencies'; END IF;
        ELSE
          v_passed := false;
          v_msg := 'Unknown requirement: ' || v_req.requirement_type;
      END CASE;

      v_reqs := v_reqs || jsonb_build_object(
        'id', v_req.id,
        'key', v_req.requirement_type,
        'requirement_type', v_req.requirement_type,
        'label', v_req.requirement_label,
        'status', CASE WHEN v_passed THEN 'met' ELSE 'unmet' END,
        'passed', v_passed,
        'details', NULLIF(v_msg, ''),
        'message', v_msg,
        'required', v_required
      );
    END LOOP;

    -- ============================================================
    -- Inject dynamic requirements from organization_intelligence_profile
    -- ============================================================
    IF v_has_oip THEN

      -- 1. require_quote_approved: if org profile says quotes must be approved
      IF v_phase.key = 'quote' AND v_oip.require_quote_approved = true THEN
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_reqs) AS r
          WHERE r->>'key' = 'org_require_quote_approved'
        ) THEN
          SELECT count(*) INTO v_count FROM quotes
            WHERE project_id = p_project_id AND status = 'approved';
          v_passed := v_count > 0;
          v_msg := CASE WHEN v_passed THEN '' ELSE 'Quote must be approved before phase progression (org policy)' END;

          v_reqs := v_reqs || jsonb_build_object(
            'id', 'org_intel_quote_approved',
            'key', 'org_require_quote_approved',
            'requirement_type', 'org_require_quote_approved',
            'label', 'Quote must be approved before phase progression',
            'status', CASE WHEN v_passed THEN 'met' ELSE 'unmet' END,
            'passed', v_passed,
            'details', NULLIF(v_msg, ''),
            'message', v_msg,
            'required', true,
            'source', 'organization_intelligence_profile'
          );
        END IF;
      END IF;

      -- 2. quote_required_before_tasks
      IF v_phase.key = 'pm_assign_foreman' AND v_oip.quote_required_before_tasks = true THEN
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_reqs) AS r
          WHERE r->>'key' = 'org_require_quote_before_tasks'
        ) THEN
          SELECT count(*) INTO v_count FROM quotes WHERE project_id = p_project_id;
          v_passed := v_count > 0;
          v_msg := CASE WHEN v_passed THEN '' ELSE 'A quote is required before task assignment (org policy)' END;

          v_reqs := v_reqs || jsonb_build_object(
            'id', 'org_intel_quote_before_tasks',
            'key', 'org_require_quote_before_tasks',
            'requirement_type', 'org_require_quote_before_tasks',
            'label', 'Quote required before task assignment',
            'status', CASE WHEN v_passed THEN 'met' ELSE 'unmet' END,
            'passed', v_passed,
            'details', NULLIF(v_msg, ''),
            'message', v_msg,
            'required', true,
            'source', 'organization_intelligence_profile'
          );
        END IF;
      END IF;

      -- 3. invoice_permission_model = strict: inject into closeout
      IF v_phase.key = 'pm_closeout' AND v_oip.invoice_permission_model = 'strict' THEN
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_reqs) AS r
          WHERE r->>'key' = 'org_strict_invoice_approval'
        ) THEN
          SELECT count(*) INTO v_count FROM invoices
            WHERE project_id = p_project_id
              AND approval_status IS DISTINCT FROM 'approved'
              AND status != 'void';
          v_passed := v_count = 0;
          v_msg := CASE WHEN v_passed THEN '' ELSE v_count || ' invoice(s) pending approval (strict permission model)' END;

          v_reqs := v_reqs || jsonb_build_object(
            'id', 'org_intel_strict_invoice',
            'key', 'org_strict_invoice_approval',
            'requirement_type', 'org_strict_invoice_approval',
            'label', 'All invoices must be approved before closeout (strict mode)',
            'status', CASE WHEN v_passed THEN 'met' ELSE 'unmet' END,
            'passed', v_passed,
            'details', NULLIF(v_msg, ''),
            'message', v_msg,
            'required', true,
            'source', 'organization_intelligence_profile'
          );
        END IF;
      END IF;

    END IF;
    -- ============================================================

    -- ============================================================
    -- Inject score-driven requirements from operational profile
    -- ============================================================
    IF v_has_scores THEN

      -- HIGH RISK (risk_score > 70): mandate quote approval, change order for overage, time auditing
      IF v_risk_score > 70 THEN

        -- Require quote approved on quote phase
        IF v_phase.key = 'quote' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_reqs) AS r
          WHERE r->>'key' IN ('org_require_quote_approved', 'require_quote_approved', 'score_require_quote_approved')
        ) THEN
          SELECT count(*) INTO v_count FROM quotes
            WHERE project_id = p_project_id AND status = 'approved';
          v_passed := v_count > 0;
          v_msg := CASE WHEN v_passed THEN '' ELSE 'High risk org: quote approval mandatory' END;
          v_reqs := v_reqs || jsonb_build_object(
            'id', 'score_high_risk_quote',
            'key', 'score_require_quote_approved',
            'requirement_type', 'score_require_quote_approved',
            'label', 'Quote approval required (risk score > 70)',
            'status', CASE WHEN v_passed THEN 'met' ELSE 'unmet' END,
            'passed', v_passed,
            'details', NULLIF(v_msg, ''),
            'message', v_msg,
            'required', true,
            'source', 'operational_profile_score',
            'score_trigger', jsonb_build_object('risk_score', v_risk_score)
          );
        END IF;

        -- Require change order documentation on foreman_review phase
        IF v_phase.key = 'foreman_review' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_reqs) AS r
          WHERE r->>'key' = 'score_require_change_order_for_overage'
        ) THEN
          -- Check if any estimate has actual cost exceeding planned
          DECLARE
            v_has_overage boolean := false;
          BEGIN
            SELECT EXISTS(
              SELECT 1 FROM estimates e
              LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(eli.amount), 0) AS actual_total
                FROM estimate_line_items eli WHERE eli.estimate_id = e.id
              ) li ON true
              WHERE e.project_id = p_project_id
                AND li.actual_total > e.planned_total_cost
                AND e.planned_total_cost > 0
            ) INTO v_has_overage;

            -- If there's an overage, check for change orders (proposals with type 'change_order')
            IF v_has_overage THEN
              SELECT count(*) INTO v_count FROM proposals
                WHERE project_id = p_project_id AND proposal_type = 'change_order';
              v_passed := v_count > 0;
            ELSE
              v_passed := true; -- No overage, requirement is met
            END IF;
            v_msg := CASE WHEN v_passed THEN '' ELSE 'Budget overage detected: change order required (risk score > 70)' END;
          END;
          v_reqs := v_reqs || jsonb_build_object(
            'id', 'score_change_order_overage',
            'key', 'score_require_change_order_for_overage',
            'requirement_type', 'score_require_change_order_for_overage',
            'label', 'Change order required for budget overages (high risk)',
            'status', CASE WHEN v_passed THEN 'met' ELSE 'unmet' END,
            'passed', v_passed,
            'details', NULLIF(v_msg, ''),
            'message', v_msg,
            'required', true,
            'source', 'operational_profile_score',
            'score_trigger', jsonb_build_object('risk_score', v_risk_score)
          );
        END IF;

        -- Require time audit on foreman_approve phase
        IF v_phase.key = 'foreman_approve' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_reqs) AS r
          WHERE r->>'key' = 'score_require_time_audit'
        ) THEN
          SELECT count(*) INTO v_count FROM time_entries
            WHERE project_id = p_project_id AND status = 'approved';
          v_passed := v_count > 0;
          v_msg := CASE WHEN v_passed THEN '' ELSE 'Time entries must be audited/approved (risk score > 70)' END;
          v_reqs := v_reqs || jsonb_build_object(
            'id', 'score_time_audit',
            'key', 'score_require_time_audit',
            'requirement_type', 'score_require_time_audit',
            'label', 'Time entry audit required (high risk)',
            'status', CASE WHEN v_passed THEN 'met' ELSE 'unmet' END,
            'passed', v_passed,
            'details', NULLIF(v_msg, ''),
            'message', v_msg,
            'required', true,
            'source', 'operational_profile_score',
            'score_trigger', jsonb_build_object('risk_score', v_risk_score)
          );
        END IF;

      END IF; -- risk_score > 70

      -- HIGH AUTOMATION (automation_readiness > 60): enable auto features
      IF v_automation > 60 THEN

        -- Auto-generate tasks hint on scope phase
        IF v_phase.key = 'scope' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_reqs) AS r
          WHERE r->>'key' = 'score_auto_generate_tasks'
        ) THEN
          SELECT count(*) INTO v_count FROM tasks
            WHERE project_id = p_project_id AND scope_item_id IS NOT NULL;
          v_passed := v_count > 0;
          v_msg := CASE WHEN v_passed THEN '' ELSE 'Auto-task generation recommended (automation readiness > 60)' END;
          v_reqs := v_reqs || jsonb_build_object(
            'id', 'score_auto_tasks',
            'key', 'score_auto_generate_tasks',
            'requirement_type', 'score_auto_generate_tasks',
            'label', 'Auto-generate tasks from scope (automation ready)',
            'status', CASE WHEN v_passed THEN 'met' ELSE 'unmet' END,
            'passed', v_passed,
            'details', NULLIF(v_msg, ''),
            'message', v_msg,
            'required', false,
            'source', 'operational_profile_score',
            'score_trigger', jsonb_build_object('automation_readiness', v_automation)
          );
        END IF;

        -- Auto-suggest invoice timing on closeout phase
        IF v_phase.key = 'pm_closeout' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_reqs) AS r
          WHERE r->>'key' = 'score_auto_suggest_invoice_timing'
        ) THEN
          SELECT count(*) INTO v_count FROM invoices
            WHERE project_id = p_project_id AND status = 'sent';
          v_passed := v_count > 0;
          v_msg := CASE WHEN v_passed THEN '' ELSE 'AI suggests sending invoice now (automation readiness > 60)' END;
          v_reqs := v_reqs || jsonb_build_object(
            'id', 'score_auto_invoice',
            'key', 'score_auto_suggest_invoice_timing',
            'requirement_type', 'score_auto_suggest_invoice_timing',
            'label', 'AI-suggested invoice timing (automation ready)',
            'status', CASE WHEN v_passed THEN 'met' ELSE 'unmet' END,
            'passed', v_passed,
            'details', NULLIF(v_msg, ''),
            'message', v_msg,
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
