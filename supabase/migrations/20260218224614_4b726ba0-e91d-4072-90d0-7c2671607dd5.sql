
-- Add invoice sending permission columns to organization_settings
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS invoice_send_roles text[] NOT NULL DEFAULT '{admin}',
  ADD COLUMN IF NOT EXISTS invoice_send_requires_approval boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_send_approver_roles text[] NOT NULL DEFAULT '{admin}',
  ADD COLUMN IF NOT EXISTS invoice_send_blocked_message text NOT NULL DEFAULT 'Invoice requires approval before sending.';

COMMENT ON COLUMN public.organization_settings.invoice_send_roles IS 'Org roles allowed to send invoices (e.g. admin, pm, hr)';
COMMENT ON COLUMN public.organization_settings.invoice_send_requires_approval IS 'Whether invoices must be approved before sending';
COMMENT ON COLUMN public.organization_settings.invoice_send_approver_roles IS 'Org roles allowed to approve invoices for sending';
COMMENT ON COLUMN public.organization_settings.invoice_send_blocked_message IS 'Message shown when user cannot send an invoice';

-- Update rpc_send_invoice to use configurable org settings instead of hardcoded roles
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
BEGIN
  -- Fetch invoice
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- Verify org membership and get role
  SELECT om.role INTO v_org_role
  FROM organization_memberships om
  WHERE om.organization_id = v_invoice.organization_id
    AND om.user_id = v_caller
    AND om.is_active = true;

  IF v_org_role IS NULL THEN
    RAISE EXCEPTION 'forbidden: not a member of this organization'
      USING ERRCODE = '42501';
  END IF;

  -- Fetch org invoice send settings
  SELECT
    COALESCE(os.invoice_send_roles, '{admin}'),
    COALESCE(os.invoice_send_requires_approval, true),
    COALESCE(os.invoice_send_blocked_message, 'Invoice requires approval before sending.')
  INTO v_send_roles, v_requires_approval, v_blocked_message
  FROM organization_settings os
  WHERE os.organization_id = v_invoice.organization_id;

  -- If no settings row, default to admin only
  IF v_send_roles IS NULL THEN
    v_send_roles := '{admin}';
    v_requires_approval := true;
    v_blocked_message := 'Invoice requires approval before sending.';
  END IF;

  -- Check if caller's role is in allowed send roles
  IF NOT (v_org_role = ANY(v_send_roles)) THEN
    RAISE EXCEPTION 'Your role (%) is not authorized to send invoices. %', v_org_role, v_blocked_message
      USING ERRCODE = '42501';
  END IF;

  -- If approval required, check invoice approval status
  IF v_requires_approval AND v_invoice.approval_status != 'approved' THEN
    RAISE EXCEPTION '%', v_blocked_message
      USING ERRCODE = '42501';
  END IF;

  -- Invoice must be in draft or sent status
  IF v_invoice.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'Invoice must be in draft or sent status to send. Current: %', v_invoice.status;
  END IF;

  -- Update invoice status
  UPDATE invoices
  SET status = 'sent', sent_at = now(), updated_at = now()
  WHERE id = p_invoice_id;

  -- Log activity
  INSERT INTO invoice_activity_log (invoice_id, user_id, action, details)
  VALUES (p_invoice_id, v_caller, 'sent', 'Invoice sent via email');

  -- Notify creator that invoice was sent
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

-- Create RPC to request invoice approval
CREATE OR REPLACE FUNCTION public.rpc_request_invoice_approval(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_org_role text;
  v_caller uuid := auth.uid();
  v_approver_roles text[];
  v_approver record;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- Verify org membership
  SELECT om.role INTO v_org_role
  FROM organization_memberships om
  WHERE om.organization_id = v_invoice.organization_id
    AND om.user_id = v_caller
    AND om.is_active = true;

  IF v_org_role IS NULL THEN
    RAISE EXCEPTION 'forbidden: not a member of this organization'
      USING ERRCODE = '42501';
  END IF;

  -- Invoice must be draft
  IF v_invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be submitted for approval';
  END IF;

  -- Already pending or approved
  IF v_invoice.approval_status IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'Invoice already has approval status: %', v_invoice.approval_status;
  END IF;

  -- Set to pending
  UPDATE invoices
  SET approval_status = 'pending', updated_at = now()
  WHERE id = p_invoice_id;

  -- Log activity
  INSERT INTO invoice_activity_log (invoice_id, user_id, action, details)
  VALUES (p_invoice_id, v_caller, 'approval_requested', 'Approval requested by ' || v_org_role);

  -- Fetch approver roles from settings
  SELECT COALESCE(os.invoice_send_approver_roles, '{admin}')
  INTO v_approver_roles
  FROM organization_settings os
  WHERE os.organization_id = v_invoice.organization_id;

  IF v_approver_roles IS NULL THEN
    v_approver_roles := '{admin}';
  END IF;

  -- Notify all approvers
  FOR v_approver IN
    SELECT om.user_id
    FROM organization_memberships om
    WHERE om.organization_id = v_invoice.organization_id
      AND om.is_active = true
      AND om.role = ANY(v_approver_roles)
      AND om.user_id != v_caller
  LOOP
    INSERT INTO notifications (user_id, project_id, type, title, message, link_url)
    VALUES (
      v_approver.user_id,
      v_invoice.project_id,
      'general',
      'Invoice Approval Requested',
      'Invoice ' || v_invoice.invoice_number || ' needs your approval.',
      '/invoicing'
    );
  END LOOP;
END;
$$;
