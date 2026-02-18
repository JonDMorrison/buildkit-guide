
-- ============================================================
-- 1) proposals table
-- ============================================================
CREATE TYPE public.proposal_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'archived');

CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  estimate_id uuid REFERENCES public.estimates(id),
  status public.proposal_status NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  customer_po_or_contract_number text,
  summary text NOT NULL DEFAULT '',
  assumptions text NOT NULL DEFAULT '',
  exclusions text NOT NULL DEFAULT '',
  timeline_text text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals FORCE ROW LEVEL SECURITY;

CREATE POLICY "proposals_select" ON public.proposals FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT om.organization_id FROM organization_memberships om WHERE om.user_id = auth.uid()
  ));

CREATE POLICY "proposals_insert" ON public.proposals FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_memberships om WHERE om.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "proposals_update" ON public.proposals FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT om.organization_id FROM organization_memberships om WHERE om.user_id = auth.uid()
  ));

CREATE POLICY "proposals_delete" ON public.proposals FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT om.organization_id FROM organization_memberships om WHERE om.user_id = auth.uid()
  ));

CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2) proposal_sections table
-- ============================================================
CREATE TABLE public.proposal_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  section_type text NOT NULL DEFAULT 'notes',
  content text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE public.proposal_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_sections FORCE ROW LEVEL SECURITY;

CREATE POLICY "proposal_sections_select" ON public.proposal_sections FOR SELECT TO authenticated
  USING (proposal_id IN (
    SELECT p.id FROM proposals p
    JOIN organization_memberships om ON om.organization_id = p.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "proposal_sections_insert" ON public.proposal_sections FOR INSERT TO authenticated
  WITH CHECK (proposal_id IN (
    SELECT p.id FROM proposals p
    JOIN organization_memberships om ON om.organization_id = p.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "proposal_sections_update" ON public.proposal_sections FOR UPDATE TO authenticated
  USING (proposal_id IN (
    SELECT p.id FROM proposals p
    JOIN organization_memberships om ON om.organization_id = p.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "proposal_sections_delete" ON public.proposal_sections FOR DELETE TO authenticated
  USING (proposal_id IN (
    SELECT p.id FROM proposals p
    JOIN organization_memberships om ON om.organization_id = p.organization_id AND om.user_id = auth.uid()
  ));

-- ============================================================
-- 3) Proposal events (audit trail)
-- ============================================================
CREATE TABLE public.proposal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  event_type text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proposal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_events FORCE ROW LEVEL SECURITY;

CREATE POLICY "proposal_events_select" ON public.proposal_events FOR SELECT TO authenticated
  USING (proposal_id IN (
    SELECT p.id FROM proposals p
    JOIN organization_memberships om ON om.organization_id = p.organization_id AND om.user_id = auth.uid()
  ));

CREATE POLICY "proposal_events_insert" ON public.proposal_events FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

-- ============================================================
-- 4) Add converted_proposal_id to quotes
-- ============================================================
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS converted_proposal_id uuid REFERENCES public.proposals(id);

-- ============================================================
-- 5) Workflow requirement: require_proposal_approved
-- ============================================================
INSERT INTO public.workflow_phase_requirements (phase_key, requirement_type, requirement_label, meta)
VALUES ('quote', 'require_proposal_approved', 'Internal proposal must be approved', '{}'::jsonb);

-- ============================================================
-- 6) RPC: convert proposal to quote
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_convert_proposal_to_quote(
  p_proposal_id uuid,
  p_include_estimate_lines boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal proposals%ROWTYPE;
  v_project projects%ROWTYPE;
  v_client clients%ROWTYPE;
  v_parent_client clients%ROWTYPE;
  v_quote_id uuid;
  v_quote_number text;
  v_pm_email text;
  v_bill_to_name text;
  v_bill_to_address text;
  v_ship_to_name text;
  v_ship_to_address text;
BEGIN
  SELECT * INTO v_proposal FROM proposals WHERE id = p_proposal_id;
  IF v_proposal.id IS NULL THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;
  IF v_proposal.status != 'approved' THEN
    RAISE EXCEPTION 'Proposal must be approved before converting to quote';
  END IF;

  SELECT * INTO v_project FROM projects WHERE id = v_proposal.project_id;

  IF v_project.client_id IS NOT NULL THEN
    SELECT * INTO v_client FROM clients WHERE id = v_project.client_id;
  END IF;

  v_pm_email := COALESCE(v_client.pm_email, v_client.email, '');

  IF v_client.parent_client_id IS NOT NULL THEN
    SELECT * INTO v_parent_client FROM clients WHERE id = v_client.parent_client_id;
    v_bill_to_name := COALESCE(v_parent_client.name, v_client.name);
    v_bill_to_address := COALESCE(v_parent_client.billing_address, v_client.billing_address);
  ELSE
    v_bill_to_name := COALESCE(v_client.name, '');
    v_bill_to_address := COALESCE(v_client.billing_address, '');
  END IF;

  v_ship_to_name := COALESCE(v_project.name, '');
  v_ship_to_address := COALESCE(v_project.location, '');

  SELECT get_next_quote_number(v_proposal.organization_id) INTO v_quote_number;

  INSERT INTO quotes (
    organization_id, project_id, client_id, parent_client_id,
    quote_number, status,
    customer_po_number, customer_pm_email,
    bill_to_name, bill_to_address,
    ship_to_name, ship_to_address,
    subtotal, gst, pst, total,
    note_for_customer, internal_notes,
    created_by, converted_proposal_id
  ) VALUES (
    v_proposal.organization_id, v_proposal.project_id,
    v_project.client_id,
    CASE WHEN v_client.parent_client_id IS NOT NULL THEN v_client.parent_client_id ELSE v_project.client_id END,
    COALESCE(v_quote_number, 'QTE-0001'), 'draft',
    v_proposal.customer_po_or_contract_number, v_pm_email,
    v_bill_to_name, v_bill_to_address,
    v_ship_to_name, v_ship_to_address,
    0, 0, 0, 0,
    'Converted from internal proposal: ' || v_proposal.title,
    v_proposal.assumptions,
    auth.uid(), p_proposal_id
  )
  RETURNING id INTO v_quote_id;

  IF p_include_estimate_lines AND v_proposal.estimate_id IS NOT NULL THEN
    INSERT INTO quote_line_items (
      organization_id, quote_id, sort_order,
      product_or_service, description, quantity, rate, amount,
      sales_tax_rate, sales_tax_amount
    )
    SELECT
      v_proposal.organization_id, v_quote_id, eli.sort_order,
      eli.name, eli.description, eli.quantity, eli.rate, eli.amount,
      eli.sales_tax_rate, eli.sales_tax_amount
    FROM estimate_line_items eli
    WHERE eli.estimate_id = v_proposal.estimate_id
    ORDER BY eli.sort_order;

    UPDATE quotes SET
      subtotal = (SELECT COALESCE(SUM(amount), 0) FROM quote_line_items WHERE quote_id = v_quote_id),
      total = (SELECT COALESCE(SUM(amount + sales_tax_amount), 0) FROM quote_line_items WHERE quote_id = v_quote_id)
    WHERE id = v_quote_id;
  END IF;

  INSERT INTO proposal_events (proposal_id, actor_user_id, event_type, message)
  VALUES (p_proposal_id, auth.uid(), 'converted_to_quote', 'Converted to Quote ' || COALESCE(v_quote_number, ''));

  RETURN v_quote_id;
END;
$$;

-- ============================================================
-- 7) Update rpc_get_project_workflow to evaluate require_proposal_approved
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_get_project_workflow(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
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
  SELECT * INTO v_pw FROM project_workflows WHERE project_id = p_project_id;
  IF v_pw.id IS NULL THEN
    INSERT INTO project_workflows (project_id) VALUES (p_project_id) RETURNING * INTO v_pw;
  END IF;

  FOR v_phase IN SELECT * FROM workflow_phases ORDER BY sort_order LOOP
    SELECT * INTO v_step FROM project_workflow_steps
      WHERE workflow_id = v_pw.id AND phase_key = v_phase.key;
    IF v_step.id IS NULL THEN
      INSERT INTO project_workflow_steps (workflow_id, phase_key)
        VALUES (v_pw.id, v_phase.key) RETURNING * INTO v_step;
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
