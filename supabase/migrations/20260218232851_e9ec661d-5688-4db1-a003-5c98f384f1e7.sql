
-- A. Add financial_enforcement_level to organizations
ALTER TABLE public.organizations
  ADD COLUMN financial_enforcement_level text NOT NULL DEFAULT 'advisory'
  CONSTRAINT chk_financial_enforcement_level CHECK (financial_enforcement_level IN ('advisory', 'strict_reporting', 'strict_phase_gating'));

-- B. Extend estimate_variance_summary to return financial_enforcement_level
CREATE OR REPLACE FUNCTION public.estimate_variance_summary(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_est RECORD;
  v_labor_hours numeric := 0;
  v_labor_cost numeric := 0;
  v_mat_cost numeric := 0;
  v_machine_cost numeric := 0;
  v_other_cost numeric := 0;
  v_unclassified numeric := 0;
  v_missing_rates_hours numeric := 0;
  v_unassigned_hours numeric := 0;
  v_currency_mismatch_hours numeric := 0;
  v_currency_mismatch_count int := 0;
  v_missing_rates_count int := 0;
  v_org_id uuid;
  v_base_currency text;
  v_project_currency text;
  v_enforcement_level text;
  v_integrity_status text := 'clean';
  v_integrity_score int := 100;
  v_integrity_blockers text[] := '{}';
  v_unreviewed_receipts_count int := 0;
  v_has_approved_estimate boolean := false;
  v_has_draft_estimate boolean := false;
BEGIN
  SELECT p.organization_id, p.currency INTO v_org_id, v_project_currency
  FROM public.projects p WHERE p.id = p_project_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  IF NOT public.has_org_membership(v_org_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT o.base_currency, o.financial_enforcement_level INTO v_base_currency, v_enforcement_level
  FROM public.organizations o WHERE o.id = v_org_id;

  -- Get latest approved estimate (or latest draft if no approved)
  SELECT * INTO v_est FROM public.estimates
  WHERE project_id = p_project_id AND status = 'approved'
  ORDER BY approved_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF v_est IS NOT NULL THEN
    v_has_approved_estimate := true;
  ELSE
    SELECT * INTO v_est FROM public.estimates
    WHERE project_id = p_project_id AND status = 'draft'
    ORDER BY created_at DESC
    LIMIT 1;
    IF v_est IS NOT NULL THEN
      v_has_draft_estimate := true;
    END IF;
  END IF;

  -- Actual labor: closed time entries with valid hours
  SELECT
    COALESCE(SUM(te.duration_hours), 0),
    COALESCE(SUM(
      CASE
        WHEN om.user_id IS NOT NULL AND om.rates_currency = v_base_currency
             AND COALESCE(pm.cost_rate, om.hourly_cost_rate) IS NOT NULL
             AND COALESCE(pm.cost_rate, om.hourly_cost_rate) > 0
        THEN te.duration_hours * COALESCE(pm.cost_rate, om.hourly_cost_rate)
        ELSE 0
      END
    ), 0),
    COALESCE(SUM(CASE
      WHEN om.user_id IS NOT NULL
       AND om.rates_currency = v_base_currency
       AND (COALESCE(pm.cost_rate, om.hourly_cost_rate) IS NULL
            OR COALESCE(pm.cost_rate, om.hourly_cost_rate) = 0)
      THEN te.duration_hours ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN om.user_id IS NOT NULL
       AND om.rates_currency = v_base_currency
       AND (COALESCE(pm.cost_rate, om.hourly_cost_rate) IS NULL
            OR COALESCE(pm.cost_rate, om.hourly_cost_rate) = 0)
      THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE
      WHEN om.user_id IS NOT NULL AND om.rates_currency != v_base_currency
      THEN te.duration_hours ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN om.user_id IS NOT NULL AND om.rates_currency != v_base_currency
      THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN te.task_id IS NULL THEN te.duration_hours ELSE 0 END), 0)
  INTO v_labor_hours, v_labor_cost, v_missing_rates_hours, v_missing_rates_count,
       v_currency_mismatch_hours, v_currency_mismatch_count, v_unassigned_hours
  FROM public.time_entries te
  LEFT JOIN public.project_members pm ON pm.user_id = te.user_id AND pm.project_id = te.project_id
  LEFT JOIN public.organization_memberships om ON om.organization_id = v_org_id AND om.user_id = te.user_id AND om.is_active = true
  WHERE te.project_id = p_project_id
    AND te.status = 'closed'
    AND te.check_out_at IS NOT NULL
    AND te.duration_hours IS NOT NULL
    AND te.duration_hours > 0;

  -- Actual receipts by cost_type (reviewed/processed only)
  SELECT
    COALESCE(SUM(CASE WHEN r.cost_type = 'material' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type = 'machine' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type = 'other' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type = 'unclassified' OR r.cost_type IS NULL THEN r.amount ELSE 0 END), 0)
  INTO v_mat_cost, v_machine_cost, v_other_cost, v_unclassified
  FROM public.receipts r
  WHERE r.project_id = p_project_id
    AND r.review_status IN ('reviewed', 'processed');

  -- Count unreviewed receipts for integrity
  SELECT COUNT(*) INTO v_unreviewed_receipts_count
  FROM public.receipts r
  WHERE r.project_id = p_project_id
    AND r.review_status = 'pending';

  -- INTEGRITY ENGINE
  IF v_est IS NULL THEN
    v_integrity_score := v_integrity_score - 30;
    v_integrity_blockers := array_append(v_integrity_blockers, 'Missing estimate');
    v_integrity_status := 'blocked';
  END IF;

  IF v_currency_mismatch_count > 0 THEN
    v_integrity_score := v_integrity_score - 25;
    v_integrity_blockers := array_append(v_integrity_blockers, 'Currency mismatch on ' || v_currency_mismatch_count || ' time entries');
    v_integrity_status := 'blocked';
  END IF;

  IF v_missing_rates_hours > 0 THEN
    v_integrity_score := v_integrity_score - 20;
    v_integrity_blockers := array_append(v_integrity_blockers, ROUND(v_missing_rates_hours, 1) || ' labor hours without cost rate');
    v_integrity_status := 'blocked';
  END IF;

  IF v_unreviewed_receipts_count > 0 THEN
    v_integrity_score := v_integrity_score - 10;
    IF v_integrity_status != 'blocked' THEN
      v_integrity_status := 'needs_attention';
    END IF;
    v_integrity_blockers := array_append(v_integrity_blockers, v_unreviewed_receipts_count || ' unreviewed receipts');
  END IF;

  IF v_unclassified > 0 THEN
    v_integrity_score := v_integrity_score - 10;
    IF v_integrity_status != 'blocked' THEN
      v_integrity_status := 'needs_attention';
    END IF;
    v_integrity_blockers := array_append(v_integrity_blockers, 'Unclassified receipt costs: $' || ROUND(v_unclassified, 2));
  END IF;

  IF v_has_draft_estimate AND NOT v_has_approved_estimate THEN
    IF v_integrity_status != 'blocked' THEN
      v_integrity_status := 'needs_attention';
    END IF;
    v_integrity_blockers := array_append(v_integrity_blockers, 'Estimate is draft, not yet approved');
  END IF;

  IF v_integrity_score < 0 THEN
    v_integrity_score := 0;
  END IF;

  RETURN jsonb_build_object(
    'has_estimate', v_est IS NOT NULL,
    'estimate_id', v_est.id,
    'currency', v_project_currency,
    'financial_enforcement_level', v_enforcement_level,
    'planned', jsonb_build_object(
      'labor_hours', COALESCE(v_est.planned_labor_hours, 0),
      'labor_bill_amount', COALESCE(v_est.planned_labor_bill_amount, 0),
      'labor_cost_rate', COALESCE(v_est.labor_cost_rate, 0),
      'material_cost', COALESCE(v_est.planned_material_cost, 0),
      'machine_cost', COALESCE(v_est.planned_machine_cost, 0),
      'other_cost', COALESCE(v_est.planned_other_cost, 0),
      'total_cost', COALESCE(v_est.planned_total_cost, 0),
      'contract_value', COALESCE(v_est.contract_value, 0),
      'profit', COALESCE(v_est.planned_profit, 0),
      'margin_percent', COALESCE(v_est.planned_margin_percent, 0)
    ),
    'actual', jsonb_build_object(
      'labor_hours', ROUND(v_labor_hours, 2),
      'labor_cost', ROUND(v_labor_cost, 2),
      'material_cost', ROUND(v_mat_cost, 2),
      'machine_cost', ROUND(v_machine_cost, 2),
      'other_cost', ROUND(v_other_cost, 2),
      'unclassified_cost', ROUND(v_unclassified, 2),
      'total_cost', ROUND(v_labor_cost + v_mat_cost + v_machine_cost + v_other_cost + v_unclassified, 2)
    ),
    'deltas', jsonb_build_object(
      'labor_hours', ROUND(v_labor_hours - COALESCE(v_est.planned_labor_hours, 0), 2),
      'labor_cost', ROUND(v_labor_cost - COALESCE(v_est.planned_labor_bill_amount, 0), 2),
      'material', ROUND(v_mat_cost - COALESCE(v_est.planned_material_cost, 0), 2),
      'machine', ROUND(v_machine_cost - COALESCE(v_est.planned_machine_cost, 0), 2),
      'other', ROUND(v_other_cost - COALESCE(v_est.planned_other_cost, 0), 2),
      'total_cost', ROUND(
        (v_labor_cost + v_mat_cost + v_machine_cost + v_other_cost + v_unclassified)
        - COALESCE(v_est.planned_total_cost, 0), 2)
    ),
    'margin', jsonb_build_object(
      'contract_value', COALESCE(v_est.contract_value, 0),
      'actual_profit', ROUND(COALESCE(v_est.contract_value, 0) - (v_labor_cost + v_mat_cost + v_machine_cost + v_other_cost + v_unclassified), 2),
      'actual_margin_percent', CASE WHEN COALESCE(v_est.contract_value, 0) > 0
        THEN ROUND(((COALESCE(v_est.contract_value, 0) - (v_labor_cost + v_mat_cost + v_machine_cost + v_other_cost + v_unclassified)) / v_est.contract_value) * 100, 1)
        ELSE 0 END
    ),
    'diagnostics', jsonb_build_object(
      'missing_cost_rates_hours', ROUND(v_missing_rates_hours, 2),
      'missing_cost_rates_count', v_missing_rates_count,
      'unassigned_time_hours', ROUND(v_unassigned_hours, 2),
      'unclassified_receipts_amount', ROUND(v_unclassified, 2),
      'currency_mismatch_hours', ROUND(v_currency_mismatch_hours, 2),
      'currency_mismatch_count', v_currency_mismatch_count,
      'currency_mismatch_detected', v_currency_mismatch_count > 0,
      'missing_estimate', v_est IS NULL
    ),
    'integrity', jsonb_build_object(
      'status', v_integrity_status,
      'score', v_integrity_score,
      'blockers', to_jsonb(v_integrity_blockers)
    )
  );
END;
$$;

-- C. Extend rpc_request_phase_advance with hard gate for strict_phase_gating
CREATE OR REPLACE FUNCTION public.rpc_request_phase_advance(p_project_id uuid, p_phase_key text, p_notes text DEFAULT NULL)
RETURNS public.project_workflow_steps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_org_id uuid;
  v_role text;
  v_phase public.workflow_phases;
  v_step public.project_workflow_steps;
  v_req RECORD;
  v_req_pass boolean;
  v_count int;
  v_missing text[] := '{}';
  v_approver RECORD;
  v_enforcement_level text;
  v_variance jsonb;
  v_integrity_status text;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.projects WHERE id = p_project_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0001'; END IF;

  IF NOT public.has_org_membership_for_user(v_org_id, v_actor_id) THEN
    RAISE EXCEPTION 'Not in organization' USING ERRCODE = 'P0001';
  END IF;

  v_role := public.get_user_project_role(v_actor_id, p_project_id);
  IF v_role IS NULL THEN
    IF public.is_org_admin(v_actor_id, v_org_id) OR public.is_admin(v_actor_id) THEN
      v_role := 'admin';
    ELSE
      RAISE EXCEPTION 'No project role' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT * INTO v_phase FROM public.workflow_phases WHERE key = p_phase_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid phase' USING ERRCODE = 'P0001'; END IF;

  IF NOT (v_role = ANY(v_phase.allowed_requester_roles)) THEN
    RAISE EXCEPTION 'Role % cannot request advance for phase %', v_role, p_phase_key USING ERRCODE = 'P0001';
  END IF;

  -- Requirements check
  FOR v_req IN SELECT * FROM public.workflow_phase_requirements WHERE phase_key = p_phase_key LOOP
    v_req_pass := false;
    CASE v_req.requirement_type
      WHEN 'require_estimate_exists' THEN
        SELECT EXISTS(SELECT 1 FROM public.estimates WHERE project_id = p_project_id) INTO v_req_pass;
      WHEN 'require_estimate_line_items_min' THEN
        SELECT COUNT(*) INTO v_count FROM public.estimate_line_items eli
          JOIN public.estimates e ON e.id = eli.estimate_id WHERE e.project_id = p_project_id;
        v_req_pass := v_count >= COALESCE((v_req.meta->>'min')::int, 1);
      WHEN 'require_quote_exists' THEN
        SELECT EXISTS(SELECT 1 FROM public.quotes WHERE project_id = p_project_id) INTO v_req_pass;
      WHEN 'require_quote_approved' THEN
        SELECT EXISTS(SELECT 1 FROM public.quotes WHERE project_id = p_project_id AND status = 'approved') INTO v_req_pass;
      WHEN 'require_scope_items_exist' THEN
        SELECT COUNT(*) INTO v_count FROM public.project_scope_items WHERE project_id = p_project_id AND is_archived = false;
        v_req_pass := v_count >= COALESCE((v_req.meta->>'min')::int, 1);
      WHEN 'require_tasks_generated_from_scope' THEN
        SELECT EXISTS(SELECT 1 FROM public.tasks WHERE project_id = p_project_id AND scope_item_id IS NOT NULL) INTO v_req_pass;
      WHEN 'require_foreman_assigned' THEN
        SELECT EXISTS(SELECT 1 FROM public.project_members WHERE project_id = p_project_id AND role = 'foreman') INTO v_req_pass;
      WHEN 'require_trades_assigned' THEN
        SELECT EXISTS(SELECT 1 FROM public.task_assignments ta JOIN public.tasks t ON t.id = ta.task_id WHERE t.project_id = p_project_id) INTO v_req_pass;
      WHEN 'require_safety_form_submitted' THEN
        SELECT EXISTS(SELECT 1 FROM public.safety_forms WHERE project_id = p_project_id AND status IN ('submitted','reviewed')) INTO v_req_pass;
      WHEN 'require_time_entries_exist' THEN
        SELECT EXISTS(SELECT 1 FROM public.time_entries WHERE project_id = p_project_id) INTO v_req_pass;
      WHEN 'require_receipt_submitted' THEN
        SELECT EXISTS(SELECT 1 FROM public.receipts WHERE project_id = p_project_id) INTO v_req_pass;
      ELSE v_req_pass := false;
    END CASE;

    IF NOT v_req_pass THEN
      v_missing := array_append(v_missing, v_req.requirement_label);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Requirements not met: %', array_to_string(v_missing, '; ') USING ERRCODE = 'P0001';
  END IF;

  -- Financial enforcement hard gate for financially gated phases
  IF p_phase_key IN ('foreman_approve', 'pm_closeout') THEN
    SELECT financial_enforcement_level INTO v_enforcement_level
    FROM public.organizations WHERE id = v_org_id;

    IF v_enforcement_level = 'strict_phase_gating' THEN
      SELECT public.estimate_variance_summary(p_project_id) INTO v_variance;
      v_integrity_status := v_variance->'integrity'->>'status';
      IF v_integrity_status = 'blocked' THEN
        RAISE EXCEPTION 'Financial integrity is blocked. Override not allowed under strict phase gating.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  UPDATE public.project_workflow_steps
  SET status = 'requested', requested_by = v_actor_id, requested_at = now(), notes = p_notes
  WHERE project_id = p_project_id AND phase_key = p_phase_key
  RETURNING * INTO v_step;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workflow step not found' USING ERRCODE = 'P0001';
  END IF;

  FOR v_approver IN
    SELECT DISTINCT pm.user_id FROM public.project_members pm
    WHERE pm.project_id = p_project_id AND pm.role = ANY(v_phase.allowed_approver_roles)
      AND pm.user_id <> v_actor_id
  LOOP
    INSERT INTO public.notifications (user_id, project_id, type, title, message, link_url)
    VALUES (v_approver.user_id, p_project_id, 'general',
      'Phase Advance Requested: ' || v_phase.label,
      'Approval requested for workflow phase: ' || v_phase.label,
      '/workflow?projectId=' || p_project_id);
  END LOOP;

  RETURN v_step;
END;
$$;

-- D. Extend rpc_send_invoice with hard gate
CREATE OR REPLACE FUNCTION public.rpc_send_invoice(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_org_role text;
  v_caller uuid := auth.uid();
  v_send_roles text[];
  v_requires_approval boolean;
  v_blocked_message text;
  v_enforcement_level text;
  v_variance jsonb;
  v_integrity_status text;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  SELECT om.role INTO v_org_role
  FROM organization_memberships om
  WHERE om.organization_id = v_invoice.organization_id
    AND om.user_id = v_caller
    AND om.is_active = true;

  IF v_org_role IS NULL THEN
    RAISE EXCEPTION 'forbidden: not a member of this organization'
      USING ERRCODE = '42501';
  END IF;

  -- Financial enforcement hard gate
  SELECT financial_enforcement_level INTO v_enforcement_level
  FROM public.organizations WHERE id = v_invoice.organization_id;

  IF v_enforcement_level = 'strict_phase_gating' AND v_invoice.project_id IS NOT NULL THEN
    SELECT public.estimate_variance_summary(v_invoice.project_id) INTO v_variance;
    v_integrity_status := v_variance->'integrity'->>'status';
    IF v_integrity_status = 'blocked' THEN
      RAISE EXCEPTION 'Financial integrity is blocked. Invoice send not allowed under strict phase gating.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT
    COALESCE(os.invoice_send_roles, '{admin}'),
    COALESCE(os.invoice_send_requires_approval, true),
    COALESCE(os.invoice_send_blocked_message, 'Invoice requires approval before sending.')
  INTO v_send_roles, v_requires_approval, v_blocked_message
  FROM organization_settings os
  WHERE os.organization_id = v_invoice.organization_id;

  IF v_send_roles IS NULL THEN
    v_send_roles := '{admin}';
    v_requires_approval := true;
    v_blocked_message := 'Invoice requires approval before sending.';
  END IF;

  IF NOT (v_org_role = ANY(v_send_roles)) THEN
    RAISE EXCEPTION 'Your role (%) is not authorized to send invoices. %', v_org_role, v_blocked_message
      USING ERRCODE = '42501';
  END IF;

  IF v_requires_approval AND v_invoice.approval_status != 'approved' THEN
    RAISE EXCEPTION '%', v_blocked_message
      USING ERRCODE = '42501';
  END IF;

  IF v_invoice.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'Invoice must be in draft or sent status to send. Current: %', v_invoice.status;
  END IF;

  UPDATE invoices
  SET status = 'sent', sent_at = now(), updated_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO invoice_activity_log (invoice_id, user_id, action, details)
  VALUES (p_invoice_id, v_caller, 'sent', 'Invoice sent via email');

  IF v_invoice.created_by IS NOT NULL AND v_invoice.created_by != v_caller THEN
    INSERT INTO notifications (user_id, project_id, type, title, message, link_url)
    VALUES (
      v_invoice.created_by,
      v_invoice.project_id,
      'general',
      'Invoice Sent',
      'Invoice ' || v_invoice.invoice_number || ' has been sent.',
      '/invoicing'
    );
  END IF;
END;
$$;

-- E. Extend rpc_log_financial_override to reject under strict_phase_gating
CREATE OR REPLACE FUNCTION public.rpc_log_financial_override(p_project_id uuid, p_checkpoint text, p_override_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_caller uuid := auth.uid();
  v_variance jsonb;
  v_integrity jsonb;
  v_status text;
  v_score integer;
  v_blockers jsonb;
  v_enforcement_level text;
BEGIN
  IF p_checkpoint NOT IN ('pm_approval', 'invoice_send', 'project_close') THEN
    RAISE EXCEPTION 'Invalid checkpoint: %', p_checkpoint USING ERRCODE = '22023';
  END IF;

  IF length(trim(p_override_reason)) < 10 THEN
    RAISE EXCEPTION 'Override reason must be at least 10 characters' USING ERRCODE = '22023';
  END IF;

  IF NOT has_project_access(p_project_id, ARRAY['admin', 'project_manager']) THEN
    RAISE EXCEPTION 'Forbidden: insufficient role' USING ERRCODE = '42501';
  END IF;

  SELECT organization_id INTO v_org_id FROM projects WHERE id = p_project_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501';
  END IF;

  -- Fetch current integrity state server-side
  SELECT estimate_variance_summary(p_project_id) INTO v_variance;

  v_integrity := v_variance->'integrity';
  v_status := COALESCE(v_integrity->>'status', 'unknown');
  v_score := COALESCE((v_integrity->>'score')::integer, 0);
  v_blockers := COALESCE(v_integrity->'blockers', '[]'::jsonb);

  -- Fetch enforcement level and reject if strict + blocked
  SELECT financial_enforcement_level INTO v_enforcement_level
  FROM public.organizations WHERE id = v_org_id;

  IF v_enforcement_level = 'strict_phase_gating' AND v_status = 'blocked' THEN
    RAISE EXCEPTION 'Override not permitted under strict phase gating' USING ERRCODE = '42501';
  END IF;

  INSERT INTO financial_integrity_overrides (
    organization_id, project_id, triggered_by, checkpoint,
    integrity_status, integrity_score, blockers, override_reason
  ) VALUES (
    v_org_id, p_project_id, v_caller, p_checkpoint,
    v_status, v_score, v_blockers, trim(p_override_reason)
  );

  RETURN true;
END;
$$;
