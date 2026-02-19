
-- ================================================================
-- rpc_get_project_workflow — add economic_requirements_preview
-- Top-level read-only field. Phases untouched. Deterministic.
-- ================================================================
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
  -- NEW: preview accumulator
  v_econ_preview jsonb := '[]'::jsonb;
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

  -- Pre-compute economic risk score (idempotent, read-only)
  BEGIN
    v_margin_ctrl := public.rpc_generate_project_margin_control(p_project_id);
    v_econ_risk := COALESCE((v_margin_ctrl->>'risk_score')::int, 0);
  EXCEPTION WHEN OTHERS THEN
    v_econ_risk := 0;
  END;

  -- ── NEW: build economic_requirements_preview (top-level, preview only) ──
  IF v_econ_risk >= 60 THEN
    v_econ_preview := jsonb_build_array(
      jsonb_build_object(
        'key',      'economic_review_required',
        'label',    'Economic Review Required',
        'status',   'pending',
        'required', true,
        'details',  'Project trending below safe margin band'
      )
    );
  END IF;
  -- ────────────────────────────────────────────────────────────────────────

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
          IF NOT v_passed THEN v_msg := 'No approved quote'; END IF;
        WHEN 'require_scope_exists' THEN
          SELECT count(*) INTO v_count FROM project_scope_items WHERE project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No scope items found'; END IF;
        WHEN 'require_scope_count_min' THEN
          SELECT count(*) INTO v_count FROM project_scope_items WHERE project_id = p_project_id;
          v_passed := v_count >= COALESCE((v_req.meta->>'min')::int, 1);
          IF NOT v_passed THEN v_msg := format('Need at least %s scope items', COALESCE((v_req.meta->>'min')::int, 1)); END IF;
        WHEN 'require_tasks_exist' THEN
          SELECT count(*) INTO v_count FROM tasks WHERE project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No tasks created'; END IF;
        WHEN 'require_task_list_created' THEN
          SELECT count(*) INTO v_count FROM tasks WHERE project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'Task list not yet created from scope'; END IF;
        WHEN 'require_time_entry_exists' THEN
          SELECT count(*) INTO v_count FROM time_entries WHERE project_id = p_project_id;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No time entries found'; END IF;
        WHEN 'require_time_audit' THEN
          SELECT count(*) INTO v_count FROM time_entries
            WHERE project_id = p_project_id AND flagged_for_review = false;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'Time audit not complete'; END IF;
        WHEN 'require_deficiency_resolution' THEN
          SELECT count(*) INTO v_count FROM deficiencies
            WHERE project_id = p_project_id AND status != 'resolved' AND is_deleted = false;
          v_passed := v_count = 0;
          IF NOT v_passed THEN v_msg := format('%s open deficiencies remain', v_count); END IF;
        WHEN 'require_final_invoice' THEN
          SELECT count(*) INTO v_count FROM invoices
            WHERE project_id = p_project_id AND status IN ('sent','paid');
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'Final invoice not sent'; END IF;
        WHEN 'require_proposal_approved' THEN
          SELECT count(*) INTO v_count FROM quotes
            WHERE project_id = p_project_id AND status = 'approved';
          IF v_count = 0 THEN
            SELECT count(*) INTO v_count FROM estimates
              WHERE project_id = p_project_id AND status = 'approved';
          END IF;
          v_passed := v_count > 0;
          IF NOT v_passed THEN v_msg := 'No approved proposal (quote or estimate)'; END IF;
        ELSE
          v_passed := false;
          v_msg := 'Unknown requirement type: ' || v_req.requirement_type;
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
    -- SCORE-DRIVEN REQUIREMENT INJECTION
    -- ============================================================
    IF v_has_scores THEN

      IF v_risk_score > 70 AND v_phase.key = 'pm_review' AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_reqs) AS r
        WHERE r->>'key' = 'score_require_security_gate'
      ) THEN
        v_reqs := v_reqs || jsonb_build_object(
          'id', 'score_security_gate',
          'key', 'score_require_security_gate',
          'requirement_type', 'score_require_security_gate',
          'label', 'Security Gate required (org risk > 70)',
          'status', 'unmet',
          'passed', false,
          'details', 'Organization risk score requires a manual security gate sign-off',
          'message', 'Security gate required: org risk score > 70',
          'required', true,
          'source', 'operational_profile_score',
          'score_trigger', jsonb_build_object('risk_score', v_risk_score)
        );
      END IF;

      IF v_automation > 60 AND v_phase.key = 'pm_review' AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_reqs) AS r
        WHERE r->>'key' = 'score_ai_advisory_unlocked'
      ) THEN
        v_reqs := v_reqs || jsonb_build_object(
          'id', 'score_ai_advisory',
          'key', 'score_ai_advisory_unlocked',
          'requirement_type', 'score_ai_advisory_unlocked',
          'label', 'AI Advisory feature unlocked (automation > 60)',
          'status', 'met',
          'passed', true,
          'details', null,
          'message', '',
          'required', false,
          'source', 'operational_profile_score',
          'score_trigger', jsonb_build_object('automation_readiness', v_automation)
        );
      END IF;

      IF v_profit_vis < 50 AND v_phase.key = 'foreman_review' AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_reqs) AS r
        WHERE r->>'key' = 'score_require_variance_review'
      ) THEN
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

    END IF; -- v_has_scores

    -- ============================================================
    -- ECONOMIC REVIEW INJECTION into foreman_review phase (existing behaviour)
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
    'phases', v_phases,
    'economic_requirements_preview', v_econ_preview
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_get_project_workflow(uuid) TO authenticated;
