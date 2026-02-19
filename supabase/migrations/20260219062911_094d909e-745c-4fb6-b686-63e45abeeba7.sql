-- 1. Create project_invoice_permissions table
CREATE TABLE IF NOT EXISTS public.project_invoice_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

ALTER TABLE public.project_invoice_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invoice_permissions FORCE ROW LEVEL SECURITY;

-- RLS: Only org admins/PMs can manage these permissions
CREATE POLICY "Org admins can manage project invoice permissions"
  ON public.project_invoice_permissions
  FOR ALL
  USING (
    public.has_project_access(project_id, ARRAY['admin','project_manager'])
  )
  WITH CHECK (
    public.has_project_access(project_id, ARRAY['admin','project_manager'])
  );

-- Read access for members to check their own permissions
CREATE POLICY "Users can view own invoice permissions"
  ON public.project_invoice_permissions
  FOR SELECT
  USING (user_id = auth.uid());

-- 2. Harden rpc_send_invoice with project-level permission fallback
CREATE OR REPLACE FUNCTION public.rpc_send_invoice(p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_org_role text;
  v_project_role text;
  v_caller uuid := auth.uid();
  v_send_roles text[];
  v_requires_approval boolean;
  v_blocked_message text;
  v_enforcement_level text;
  v_variance jsonb;
  v_integrity_status text;
  v_has_project_perm boolean := false;
BEGIN
  -- 1. Load invoice
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- 2. Verify org membership
  SELECT om.role INTO v_org_role
  FROM organization_memberships om
  WHERE om.organization_id = v_invoice.organization_id
    AND om.user_id = v_caller
    AND om.is_active = true;

  IF v_org_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized to send invoice' USING ERRCODE = '42501';
  END IF;

  -- 3. Financial integrity gate
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

  -- 4. Load org-level send policy
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

  -- 5. Check project-level role (project_manager or admin on project)
  IF v_invoice.project_id IS NOT NULL THEN
    SELECT pm.role INTO v_project_role
    FROM project_members pm
    WHERE pm.project_id = v_invoice.project_id
      AND pm.user_id = v_caller;

    -- Check explicit project_invoice_permissions
    SELECT EXISTS(
      SELECT 1 FROM project_invoice_permissions pip
      WHERE pip.project_id = v_invoice.project_id
        AND pip.user_id = v_caller
    ) INTO v_has_project_perm;
  END IF;

  -- 6. Authorization: org role in send_roles OR project_admin OR explicit project permission
  IF NOT (
    v_org_role = ANY(v_send_roles)
    OR v_org_role = 'admin'
    OR v_project_role = 'project_manager'
    OR v_has_project_perm
  ) THEN
    RAISE EXCEPTION 'Unauthorized to send invoice' USING ERRCODE = '42501';
  END IF;

  -- 7. Approval gate
  IF v_requires_approval AND v_invoice.approval_status != 'approved' THEN
    RAISE EXCEPTION '%', v_blocked_message USING ERRCODE = '42501';
  END IF;

  -- 8. Status gate
  IF v_invoice.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'Invoice must be in draft or sent status to send. Current: %', v_invoice.status;
  END IF;

  -- 9. Execute send
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
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_send_invoice(uuid) TO authenticated;