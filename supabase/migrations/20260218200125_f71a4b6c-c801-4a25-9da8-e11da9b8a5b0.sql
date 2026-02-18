
-- ============================================================
-- 1) workflow_phases — canonical template (text PK)
-- ============================================================
CREATE TABLE public.workflow_phases (
  key text PRIMARY KEY,
  label text NOT NULL,
  sort_order int NOT NULL,
  description text,
  allowed_requester_roles text[] NOT NULL DEFAULT '{}',
  allowed_approver_roles text[] NOT NULL DEFAULT '{}'
,  is_approval_required boolean NOT NULL DEFAULT true
);

ALTER TABLE public.workflow_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_phases FORCE ROW LEVEL SECURITY;

-- Read-only for all authenticated users
CREATE POLICY "Authenticated users can read workflow phases"
  ON public.workflow_phases FOR SELECT TO authenticated
  USING (true);

-- No insert/update/delete for authenticated (admin seeds via migration)
CREATE POLICY "Deny insert workflow_phases"
  ON public.workflow_phases FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny update workflow_phases"
  ON public.workflow_phases FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny delete workflow_phases"
  ON public.workflow_phases FOR DELETE TO authenticated
  USING (false);

-- Seed 10 phases
INSERT INTO public.workflow_phases (key, label, sort_order, description, allowed_requester_roles, allowed_approver_roles, is_approval_required) VALUES
  ('setup',                'Setup',                 1,  'Initial project setup and configuration',           '{"admin","project_manager"}', '{"admin","project_manager"}', false),
  ('estimate',             'Estimate',              2,  'Create internal cost estimate',                     '{"admin","project_manager"}', '{"admin","project_manager"}', true),
  ('quote',                'Quote / Proposal',      3,  'Generate customer-facing quote or proposal',        '{"admin","project_manager"}', '{"admin","project_manager"}', true),
  ('scope',                'Scope',                 4,  'Define scope items and generate tasks',             '{"admin","project_manager"}', '{"admin","project_manager"}', true),
  ('pm_assign_foreman',    'PM Assigns Foreman',    5,  'Project manager assigns a foreman to the project',  '{"admin","project_manager"}', '{"admin","project_manager"}', true),
  ('foreman_assign_trades','Foreman Assigns Trades', 6, 'Foreman assigns trades to tasks',                   '{"admin","project_manager","foreman"}', '{"admin","project_manager"}', true),
  ('trades_execute',       'Trades Execute',        7,  'Trade workers execute: time, safety, receipts',     '{"admin","project_manager","foreman"}', '{"admin","project_manager","foreman"}', false),
  ('foreman_review',       'Foreman Review',        8,  'Foreman reviews completed work',                    '{"admin","project_manager","foreman"}', '{"admin","project_manager","foreman"}', true),
  ('foreman_approve',      'Foreman Approve',       9,  'Foreman approves and signs off on work',            '{"foreman"}', '{"admin","project_manager"}', true),
  ('pm_closeout',          'PM Closeout',          10,  'Project manager closes out the project',            '{"admin","project_manager"}', '{"admin","project_manager"}', true);

-- ============================================================
-- 2) workflow_phase_requirements — rule system
-- ============================================================
CREATE TABLE public.workflow_phase_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_key text NOT NULL REFERENCES public.workflow_phases(key) ON DELETE CASCADE,
  requirement_type text NOT NULL,
  requirement_label text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE public.workflow_phase_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_phase_requirements FORCE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read workflow requirements"
  ON public.workflow_phase_requirements FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Deny insert workflow_phase_requirements"
  ON public.workflow_phase_requirements FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny update workflow_phase_requirements"
  ON public.workflow_phase_requirements FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny delete workflow_phase_requirements"
  ON public.workflow_phase_requirements FOR DELETE TO authenticated
  USING (false);

-- Seed requirements
INSERT INTO public.workflow_phase_requirements (phase_key, requirement_type, requirement_label, meta) VALUES
  ('estimate', 'require_estimate_exists',           'An estimate must exist for this project',               '{}'),
  ('estimate', 'require_estimate_line_items_min',   'Estimate must have at least 1 line item',               '{"min":1}'),
  ('quote',    'require_quote_exists',              'A quote must exist for this project',                   '{}'),
  ('scope',    'require_scope_items_exist',         'At least 1 active scope item must exist',               '{"min":1}'),
  ('scope',    'require_tasks_generated_from_scope','Tasks must be generated from scope items',              '{}'),
  ('pm_assign_foreman', 'require_foreman_assigned', 'A foreman must be assigned to the project',            '{}'),
  ('foreman_assign_trades', 'require_trades_assigned', 'Trade workers must be assigned to tasks',            '{}'),
  ('trades_execute', 'require_safety_form_submitted', 'At least one safety form must be submitted',         '{}'),
  ('trades_execute', 'require_time_entries_exist',    'Time entries must exist for this project',            '{}'),
  ('foreman_review', 'require_receipt_submitted',     'At least one receipt must be submitted',              '{}');

-- ============================================================
-- 3) project_workflows — per-project workflow config
-- ============================================================
CREATE TABLE public.project_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  flow_mode text NOT NULL DEFAULT 'standard' CHECK (flow_mode IN ('standard','ai_optimized')),
  current_phase text NOT NULL DEFAULT 'setup' REFERENCES public.workflow_phases(key),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_workflows FORCE ROW LEVEL SECURITY;

CREATE TRIGGER set_project_workflows_updated_at
  BEFORE UPDATE ON public.project_workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SELECT: org members can read
CREATE POLICY "Org members can read project workflows"
  ON public.project_workflows FOR SELECT TO authenticated
  USING (public.has_org_membership(organization_id));

-- INSERT/UPDATE/DELETE denied for authenticated (RPCs only)
CREATE POLICY "Deny direct insert project_workflows"
  ON public.project_workflows FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny direct update project_workflows"
  ON public.project_workflows FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny direct delete project_workflows"
  ON public.project_workflows FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- 4) project_workflow_steps — per-project per-phase progress
-- ============================================================
CREATE TABLE public.project_workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  phase_key text NOT NULL REFERENCES public.workflow_phases(key),
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','blocked','requested','approved')),
  requested_by uuid REFERENCES public.profiles(id),
  requested_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, phase_key)
);

ALTER TABLE public.project_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_workflow_steps FORCE ROW LEVEL SECURITY;

CREATE TRIGGER set_project_workflow_steps_updated_at
  BEFORE UPDATE ON public.project_workflow_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SELECT: org members can read
CREATE POLICY "Org members can read project workflow steps"
  ON public.project_workflow_steps FOR SELECT TO authenticated
  USING (public.has_org_membership(organization_id));

-- All writes denied (RPCs only)
CREATE POLICY "Deny direct insert project_workflow_steps"
  ON public.project_workflow_steps FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny direct update project_workflow_steps"
  ON public.project_workflow_steps FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny direct delete project_workflow_steps"
  ON public.project_workflow_steps FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- 5) RPC: rpc_set_project_flow_mode
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_set_project_flow_mode(
  p_project_id uuid,
  p_flow_mode text
)
RETURNS public.project_workflows
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_org_id uuid;
  v_role text;
  v_wf public.project_workflows;
BEGIN
  IF p_flow_mode NOT IN ('standard','ai_optimized') THEN
    RAISE EXCEPTION 'Invalid flow_mode: %', p_flow_mode USING ERRCODE = 'P0001';
  END IF;

  -- Get project org
  SELECT organization_id INTO v_org_id FROM public.projects WHERE id = p_project_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0001';
  END IF;

  -- Check org membership
  IF NOT public.has_org_membership_for_user(v_org_id, v_actor_id) THEN
    RAISE EXCEPTION 'Not in organization' USING ERRCODE = 'P0001';
  END IF;

  -- Check project role (admin or PM)
  v_role := public.get_user_project_role(v_actor_id, p_project_id);
  IF v_role IS NULL THEN
    -- Check if org admin
    IF NOT public.is_org_admin(v_actor_id, v_org_id) AND NOT public.is_admin(v_actor_id) THEN
      RAISE EXCEPTION 'Must be project admin or PM' USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_role NOT IN ('admin','project_manager') THEN
    RAISE EXCEPTION 'Must be project admin or PM' USING ERRCODE = 'P0001';
  END IF;

  -- Upsert project_workflows
  INSERT INTO public.project_workflows (project_id, organization_id, flow_mode, current_phase)
  VALUES (p_project_id, v_org_id, p_flow_mode, 'setup')
  ON CONFLICT (project_id) DO UPDATE SET flow_mode = p_flow_mode, updated_at = now()
  RETURNING * INTO v_wf;

  -- If ai_optimized, initialize steps
  IF p_flow_mode = 'ai_optimized' THEN
    INSERT INTO public.project_workflow_steps (project_id, organization_id, phase_key, status)
    SELECT p_project_id, v_org_id, wp.key,
      CASE WHEN wp.key = 'setup' THEN 'in_progress' ELSE 'not_started' END
    FROM public.workflow_phases wp
    ON CONFLICT (project_id, phase_key) DO NOTHING;
  END IF;

  RETURN v_wf;
END;
$$;

-- ============================================================
-- 6) RPC: rpc_get_project_workflow
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
  v_result jsonb;
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
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_org_membership_for_user(v_org_id, v_actor_id) THEN
    RAISE EXCEPTION 'Not in organization' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_wf FROM public.project_workflows WHERE project_id = p_project_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('flow_mode','standard','current_phase',null,'phases','[]'::jsonb);
  END IF;

  FOR v_phase IN SELECT * FROM public.workflow_phases ORDER BY sort_order LOOP
    -- Get step status
    SELECT * INTO v_step FROM public.project_workflow_steps
      WHERE project_id = p_project_id AND phase_key = v_phase.key;

    -- Evaluate requirements
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

        WHEN 'require_scope_items_exist' THEN
          SELECT COUNT(*) INTO v_count FROM public.project_scope_items WHERE project_id = p_project_id AND is_archived = false;
          v_req_pass := v_count >= COALESCE((v_req.meta->>'min')::int, 1);
          IF NOT v_req_pass THEN v_req_msg := format('Need at least %s scope items, found %s', COALESCE((v_req.meta->>'min')::int, 1), v_count); END IF;

        WHEN 'require_tasks_generated_from_scope' THEN
          SELECT EXISTS(SELECT 1 FROM public.tasks WHERE project_id = p_project_id AND scope_item_id IS NOT NULL) INTO v_req_pass;
          IF NOT v_req_pass THEN v_req_msg := 'No tasks generated from scope items'; END IF;

        WHEN 'require_foreman_assigned' THEN
          SELECT EXISTS(SELECT 1 FROM public.project_members WHERE project_id = p_project_id AND role = 'foreman') INTO v_req_pass;
          IF NOT v_req_pass THEN v_req_msg := 'No foreman assigned to this project'; END IF;

        WHEN 'require_trades_assigned' THEN
          SELECT EXISTS(SELECT 1 FROM public.task_assignments ta JOIN public.tasks t ON t.id = ta.task_id WHERE t.project_id = p_project_id) INTO v_req_pass;
          IF NOT v_req_pass THEN v_req_msg := 'No trade workers assigned to tasks'; END IF;

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
          v_req_msg := 'Unknown requirement type: ' || v_req.requirement_type;
      END CASE;

      v_reqs := v_reqs || jsonb_build_object(
        'id', v_req.id,
        'type', v_req.requirement_type,
        'label', v_req.requirement_label,
        'passed', v_req_pass,
        'message', v_req_msg
      );
    END LOOP;

    v_phases := v_phases || jsonb_build_object(
      'key', v_phase.key,
      'label', v_phase.label,
      'sort_order', v_phase.sort_order,
      'description', v_phase.description,
      'is_approval_required', v_phase.is_approval_required,
      'allowed_requester_roles', to_jsonb(v_phase.allowed_requester_roles),
      'allowed_approver_roles', to_jsonb(v_phase.allowed_approver_roles),
      'status', COALESCE(v_step.status, 'not_started'),
      'requested_by', v_step.requested_by,
      'requested_at', v_step.requested_at,
      'approved_by', v_step.approved_by,
      'approved_at', v_step.approved_at,
      'notes', v_step.notes,
      'requirements', v_reqs
    );
  END LOOP;

  RETURN jsonb_build_object(
    'flow_mode', v_wf.flow_mode,
    'current_phase', v_wf.current_phase,
    'phases', v_phases
  );
END;
$$;

-- ============================================================
-- 7) RPC: rpc_request_phase_advance
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

  -- Get actor project role
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

  -- Check requirements
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

  -- Update step
  UPDATE public.project_workflow_steps
  SET status = 'requested', requested_by = v_actor_id, requested_at = now(), notes = p_notes
  WHERE project_id = p_project_id AND phase_key = p_phase_key
  RETURNING * INTO v_step;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workflow step not found. Is AI-Optimized flow enabled?' USING ERRCODE = 'P0001';
  END IF;

  -- Notify approver roles
  FOR v_approver IN
    SELECT DISTINCT pm.user_id FROM public.project_members pm
    WHERE pm.project_id = p_project_id AND pm.role = ANY(v_phase.allowed_approver_roles)
      AND pm.user_id <> v_actor_id
  LOOP
    INSERT INTO public.notifications (user_id, project_id, type, title, message, link_url)
    VALUES (
      v_approver.user_id, p_project_id, 'general',
      'Phase Advance Requested: ' || v_phase.label,
      'Approval requested for workflow phase: ' || v_phase.label,
      '/workflow?projectId=' || p_project_id
    );
  END LOOP;

  RETURN v_step;
END;
$$;

-- ============================================================
-- 8) RPC: rpc_approve_phase
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_approve_phase(
  p_project_id uuid,
  p_phase_key text,
  p_approve boolean,
  p_message text DEFAULT NULL
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
  v_next_phase RECORD;
  v_notify_target RECORD;
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

  IF NOT (v_role = ANY(v_phase.allowed_approver_roles)) THEN
    RAISE EXCEPTION 'Role % cannot approve phase %', v_role, p_phase_key USING ERRCODE = 'P0001';
  END IF;

  -- Check step is in requested state
  SELECT * INTO v_step FROM public.project_workflow_steps
    WHERE project_id = p_project_id AND phase_key = p_phase_key FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Step not found' USING ERRCODE = 'P0001'; END IF;
  IF v_step.status <> 'requested' THEN
    RAISE EXCEPTION 'Phase must be in requested status to approve/deny' USING ERRCODE = 'P0001';
  END IF;

  IF p_approve THEN
    -- Approve
    UPDATE public.project_workflow_steps
    SET status = 'approved', approved_by = v_actor_id, approved_at = now(), notes = COALESCE(p_message, notes)
    WHERE id = v_step.id RETURNING * INTO v_step;

    -- Advance to next phase
    SELECT * INTO v_next_phase FROM public.workflow_phases
      WHERE sort_order > v_phase.sort_order ORDER BY sort_order LIMIT 1;

    IF FOUND THEN
      UPDATE public.project_workflows SET current_phase = v_next_phase.key WHERE project_id = p_project_id;
      UPDATE public.project_workflow_steps SET status = 'in_progress'
        WHERE project_id = p_project_id AND phase_key = v_next_phase.key AND status = 'not_started';

      -- Notify next responsible roles
      FOR v_notify_target IN
        SELECT DISTINCT pm.user_id FROM public.project_members pm
        WHERE pm.project_id = p_project_id AND pm.role = ANY(v_next_phase.allowed_requester_roles)
      LOOP
        INSERT INTO public.notifications (user_id, project_id, type, title, message, link_url)
        VALUES (
          v_notify_target.user_id, p_project_id, 'general',
          'Workflow Phase Active: ' || v_next_phase.label,
          'The workflow has advanced to: ' || v_next_phase.label || '. Action may be required.',
          '/workflow?projectId=' || p_project_id
        );
      END LOOP;
    END IF;

    -- Notify requester of approval
    IF v_step.requested_by IS NOT NULL AND v_step.requested_by <> v_actor_id THEN
      INSERT INTO public.notifications (user_id, project_id, type, title, message, link_url)
      VALUES (
        v_step.requested_by, p_project_id, 'general',
        'Phase Approved: ' || v_phase.label,
        COALESCE(p_message, 'Your phase advance request has been approved.'),
        '/workflow?projectId=' || p_project_id
      );
    END IF;
  ELSE
    -- Deny / Send back
    UPDATE public.project_workflow_steps
    SET status = 'blocked', notes = COALESCE(p_message, notes)
    WHERE id = v_step.id RETURNING * INTO v_step;

    -- Notify requester
    IF v_step.requested_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, project_id, type, title, message, link_url)
      VALUES (
        v_step.requested_by, p_project_id, 'general',
        'Phase Sent Back: ' || v_phase.label,
        COALESCE(p_message, 'Your phase advance request was sent back for revision.'),
        '/workflow?projectId=' || p_project_id
      );
    END IF;
  END IF;

  RETURN v_step;
END;
$$;
