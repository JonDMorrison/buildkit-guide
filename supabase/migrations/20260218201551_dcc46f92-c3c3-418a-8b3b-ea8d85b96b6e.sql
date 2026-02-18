
-- Drop old function signature so we can recreate
DROP FUNCTION IF EXISTS public.convert_quote_to_invoice(uuid, uuid);

-- ============================================================
-- 1) Add project status CHECK constraint
-- ============================================================
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('not_started','in_progress','completed','archived','deleted'));
ALTER TABLE public.projects ALTER COLUMN status SET DEFAULT 'not_started';

-- ============================================================
-- 2) Recreate convert_quote_to_invoice RPC (full snapshot + email swap)
-- ============================================================
CREATE OR REPLACE FUNCTION public.convert_quote_to_invoice(
  p_quote_id uuid,
  p_actor_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), p_actor_id);
  v_quote RECORD;
  v_org_id uuid;
  v_role text;
  v_client RECORD;
  v_parent_client RECORD;
  v_project RECORD;
  v_inv_number text;
  v_invoice_id uuid;
  v_send_to text;
  v_bill_to_client_id uuid;
  v_bill_to_name text;
  v_bill_to_address text;
  v_ship_to_address text;
  v_existing_conversion uuid;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote not found' USING ERRCODE = 'P0001'; END IF;

  v_org_id := v_quote.organization_id;

  IF v_quote.status <> 'approved' THEN
    RAISE EXCEPTION 'Quote must be approved before conversion' USING ERRCODE = 'P0001';
  END IF;

  IF v_quote.project_id IS NULL THEN
    RAISE EXCEPTION 'Quote must have a project' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_existing_conversion FROM public.quote_conversions WHERE quote_id = p_quote_id;
  IF FOUND THEN
    RAISE EXCEPTION 'Quote already converted' USING ERRCODE = 'P0001';
  END IF;

  IF v_quote.converted_invoice_id IS NOT NULL THEN
    RAISE EXCEPTION 'Quote already converted' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_org_membership_for_user(v_org_id, v_actor) THEN
    RAISE EXCEPTION 'Not in organization' USING ERRCODE = 'P0001';
  END IF;

  v_role := public.get_user_project_role(v_actor, v_quote.project_id);
  IF v_role IS NULL THEN
    IF NOT public.is_org_admin(v_actor, v_org_id) AND NOT public.is_admin(v_actor) THEN
      RAISE EXCEPTION 'Must be PM or Admin to convert' USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_role NOT IN ('admin','project_manager') THEN
    RAISE EXCEPTION 'Must be PM or Admin to convert' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_project FROM public.projects WHERE id = v_quote.project_id;

  IF v_quote.client_id IS NOT NULL THEN
    SELECT * INTO v_client FROM public.clients WHERE id = v_quote.client_id;
  END IF;

  IF v_quote.parent_client_id IS NOT NULL THEN
    SELECT * INTO v_parent_client FROM public.clients WHERE id = v_quote.parent_client_id;
  END IF;

  -- Resolve bill-to (parent client takes precedence)
  IF v_parent_client.id IS NOT NULL THEN
    v_bill_to_client_id := v_parent_client.id;
    v_bill_to_name := v_parent_client.name;
    v_bill_to_address := v_parent_client.billing_address;
  ELSIF v_client.id IS NOT NULL THEN
    v_bill_to_client_id := v_client.id;
    v_bill_to_name := v_client.name;
    v_bill_to_address := v_client.billing_address;
  ELSE
    v_bill_to_client_id := NULL;
    v_bill_to_name := v_quote.bill_to_name;
    v_bill_to_address := v_quote.bill_to_address;
  END IF;

  v_ship_to_address := COALESCE(v_project.location, v_quote.ship_to_address);

  -- EMAIL SWAP: Invoice send_to = client AP emails (NOT quote PM email)
  IF v_parent_client.id IS NOT NULL THEN
    v_send_to := COALESCE(v_parent_client.ap_email, v_parent_client.email);
  ELSIF v_client.id IS NOT NULL THEN
    v_send_to := COALESCE(v_client.ap_email, v_client.email);
  ELSE
    v_send_to := v_quote.bill_to_ap_email;
  END IF;

  v_inv_number := public.get_next_invoice_number(v_org_id);

  INSERT INTO public.invoices (
    organization_id, project_id, client_id,
    bill_to_client_id, bill_to_name, bill_to_address,
    ship_to_address, send_to_emails,
    invoice_number, created_by,
    subtotal, tax_amount, total,
    status, po_number, notes
  ) VALUES (
    v_org_id, v_quote.project_id, v_quote.client_id,
    v_bill_to_client_id, v_bill_to_name, v_bill_to_address,
    v_ship_to_address, v_send_to,
    v_inv_number, v_actor,
    v_quote.subtotal, v_quote.gst + v_quote.pst, v_quote.total,
    'draft', v_quote.customer_po_number, v_quote.note_for_customer
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO public.invoice_line_items (invoice_id, description, quantity, unit_price, amount, sort_order)
  SELECT v_invoice_id, COALESCE(qli.description, qli.product_or_service),
         qli.quantity, qli.rate, qli.amount, qli.sort_order
  FROM public.quote_line_items qli
  WHERE qli.quote_id = p_quote_id
  ORDER BY qli.sort_order;

  INSERT INTO public.quote_conversions (organization_id, quote_id, invoice_id, converted_by)
  VALUES (v_org_id, p_quote_id, v_invoice_id, v_actor);

  UPDATE public.quotes SET converted_invoice_id = v_invoice_id WHERE id = p_quote_id;

  INSERT INTO public.quote_events (quote_id, organization_id, actor_user_id, event_type, message, metadata)
  VALUES (p_quote_id, v_org_id, v_actor, 'converted_to_invoice',
    'Quote converted to Invoice ' || v_inv_number,
    jsonb_build_object('invoice_id', v_invoice_id, 'invoice_number', v_inv_number,
      'send_to_emails', v_send_to, 'bill_to_name', v_bill_to_name));

  IF EXISTS(SELECT 1 FROM public.project_workflows WHERE project_id = v_quote.project_id AND flow_mode = 'ai_optimized') THEN
    INSERT INTO public.notifications (user_id, project_id, type, title, message, link_url)
    SELECT DISTINCT pm.user_id, v_quote.project_id, 'general',
      'Quote Converted to Invoice',
      'Quote ' || v_quote.quote_number || ' converted to Invoice ' || v_inv_number || '. Next: build scope and generate tasks.',
      '/workflow?projectId=' || v_quote.project_id
    FROM public.project_members pm
    WHERE pm.project_id = v_quote.project_id AND pm.role IN ('admin','project_manager');
  END IF;

  RETURN v_invoice_id::text;
END;
$$;

-- ============================================================
-- 3) Helper RPC: log quote events
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_log_quote_event(
  p_quote_id uuid,
  p_event_type text,
  p_message text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org_id uuid;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote not found' USING ERRCODE = 'P0001'; END IF;

  IF NOT public.has_org_membership_for_user(v_org_id, v_actor) THEN
    RAISE EXCEPTION 'Not in organization' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.quote_events (quote_id, organization_id, actor_user_id, event_type, message, metadata)
  VALUES (p_quote_id, v_org_id, v_actor, p_event_type, p_message, p_metadata);
END;
$$;

-- ============================================================
-- 4) Updated rpc_get_project_workflow with require_quote_approved
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_get_project_workflow(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_org_id uuid;
  v_wf public.project_workflows;
  v_phases jsonb := '[]'::jsonb;
  v_phase RECORD;
  v_step RECORD;
  v_reqs jsonb;
  v_req RECORD;
  v_req_pass boolean;
  v_req_msg text;
  v_count int;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.projects WHERE id = p_project_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0001'; END IF;

  IF NOT public.has_org_membership_for_user(v_org_id, v_actor_id) THEN
    RAISE EXCEPTION 'Not in organization' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_wf FROM public.project_workflows WHERE project_id = p_project_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('flow_mode','standard','current_phase',null,'phases','[]'::jsonb);
  END IF;

  FOR v_phase IN SELECT * FROM public.workflow_phases ORDER BY sort_order LOOP
    SELECT * INTO v_step FROM public.project_workflow_steps
      WHERE project_id = p_project_id AND phase_key = v_phase.key;

    v_reqs := '[]'::jsonb;
    FOR v_req IN SELECT * FROM public.workflow_phase_requirements WHERE phase_key = v_phase.key LOOP
      v_req_pass := false;
      v_req_msg := '';

      CASE v_req.requirement_type
        WHEN 'require_estimate_exists' THEN
          SELECT EXISTS(SELECT 1 FROM public.estimates WHERE project_id = p_project_id) INTO v_req_pass;
          IF NOT v_req_pass THEN v_req_msg := 'No estimate found'; END IF;
        WHEN 'require_estimate_line_items_min' THEN
          SELECT COUNT(*) INTO v_count FROM public.estimate_line_items eli
            JOIN public.estimates e ON e.id = eli.estimate_id WHERE e.project_id = p_project_id;
          v_req_pass := v_count >= COALESCE((v_req.meta->>'min')::int, 1);
          IF NOT v_req_pass THEN v_req_msg := format('Need at least %s line items, found %s', COALESCE((v_req.meta->>'min')::int, 1), v_count); END IF;
        WHEN 'require_quote_exists' THEN
          SELECT EXISTS(SELECT 1 FROM public.quotes WHERE project_id = p_project_id) INTO v_req_pass;
          IF NOT v_req_pass THEN v_req_msg := 'No quote found'; END IF;
        WHEN 'require_quote_approved' THEN
          SELECT EXISTS(SELECT 1 FROM public.quotes WHERE project_id = p_project_id AND status = 'approved') INTO v_req_pass;
          IF NOT v_req_pass THEN v_req_msg := 'No approved quote found'; END IF;
        WHEN 'require_scope_items_exist' THEN
          SELECT COUNT(*) INTO v_count FROM public.project_scope_items WHERE project_id = p_project_id AND is_archived = false;
          v_req_pass := v_count >= COALESCE((v_req.meta->>'min')::int, 1);
          IF NOT v_req_pass THEN v_req_msg := format('Need at least %s scope items, found %s', COALESCE((v_req.meta->>'min')::int, 1), v_count); END IF;
        WHEN 'require_tasks_generated_from_scope' THEN
          SELECT EXISTS(SELECT 1 FROM public.tasks WHERE project_id = p_project_id AND scope_item_id IS NOT NULL) INTO v_req_pass;
          IF NOT v_req_pass THEN v_req_msg := 'No tasks generated from scope items'; END IF;
        WHEN 'require_foreman_assigned' THEN
          SELECT EXISTS(SELECT 1 FROM public.project_members WHERE project_id = p_project_id AND role = 'foreman') INTO v_req_pass;
          IF NOT v_req_pass THEN v_req_msg := 'No foreman assigned'; END IF;
        WHEN 'require_trades_assigned' THEN
          SELECT EXISTS(SELECT 1 FROM public.task_assignments ta JOIN public.tasks t ON t.id = ta.task_id WHERE t.project_id = p_project_id) INTO v_req_pass;
          IF NOT v_req_pass THEN v_req_msg := 'No trade workers assigned'; END IF;
        WHEN 'require_safety_form_submitted' THEN
          SELECT EXISTS(SELECT 1 FROM public.safety_forms WHERE project_id = p_project_id AND status IN ('submitted','reviewed')) INTO v_req_pass;
          IF NOT v_req_pass THEN v_req_msg := 'No safety forms submitted'; END IF;
        WHEN 'require_time_entries_exist' THEN
          SELECT EXISTS(SELECT 1 FROM public.time_entries WHERE project_id = p_project_id) INTO v_req_pass;
          IF NOT v_req_pass THEN v_req_msg := 'No time entries found'; END IF;
        WHEN 'require_receipt_submitted' THEN
          SELECT EXISTS(SELECT 1 FROM public.receipts WHERE project_id = p_project_id) INTO v_req_pass;
          IF NOT v_req_pass THEN v_req_msg := 'No receipts submitted'; END IF;
        ELSE
          v_req_pass := false;
          v_req_msg := 'Unknown: ' || v_req.requirement_type;
      END CASE;

      v_reqs := v_reqs || jsonb_build_object(
        'id', v_req.id, 'type', v_req.requirement_type,
        'label', v_req.requirement_label, 'passed', v_req_pass, 'message', v_req_msg);
    END LOOP;

    v_phases := v_phases || jsonb_build_object(
      'key', v_phase.key, 'label', v_phase.label, 'sort_order', v_phase.sort_order,
      'description', v_phase.description, 'is_approval_required', v_phase.is_approval_required,
      'allowed_requester_roles', to_jsonb(v_phase.allowed_requester_roles),
      'allowed_approver_roles', to_jsonb(v_phase.allowed_approver_roles),
      'status', COALESCE(v_step.status, 'not_started'),
      'requested_by', v_step.requested_by, 'requested_at', v_step.requested_at,
      'approved_by', v_step.approved_by, 'approved_at', v_step.approved_at,
      'notes', v_step.notes, 'requirements', v_reqs);
  END LOOP;

  RETURN jsonb_build_object('flow_mode', v_wf.flow_mode, 'current_phase', v_wf.current_phase, 'phases', v_phases);
END;
$$;

-- ============================================================
-- 5) Updated rpc_request_phase_advance with require_quote_approved
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_request_phase_advance(
  p_project_id uuid,
  p_phase_key text,
  p_notes text DEFAULT NULL
)
RETURNS public.project_workflow_steps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
