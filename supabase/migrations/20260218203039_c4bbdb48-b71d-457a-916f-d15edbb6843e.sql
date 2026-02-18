
-- ============================================================
-- rpc_send_invoice: server-enforced invoice sending with role check
-- Only admin/hr can send. PM is explicitly blocked.
-- ============================================================
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
    AND om.user_id = v_caller;

  IF v_org_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  -- Block PM from sending
  IF v_org_role = 'pm' THEN
    RAISE EXCEPTION 'Project Managers cannot send invoices. Only Admin or Accounting/HR can send.';
  END IF;

  -- Only admin and hr can send
  IF v_org_role NOT IN ('admin', 'hr') THEN
    RAISE EXCEPTION 'Only Admin or Accounting/HR can send invoices';
  END IF;

  -- Invoice must be in draft or approved status to be sent
  IF v_invoice.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'Invoice must be in draft or sent status to send. Current: %', v_invoice.status;
  END IF;

  -- Update invoice status
  UPDATE invoices
  SET status = 'sent', sent_at = now(), updated_at = now()
  WHERE id = p_invoice_id;

  -- Log activity
  INSERT INTO invoice_activity_log (invoice_id, action, description, performed_by)
  VALUES (p_invoice_id, 'sent', 'Invoice sent via email', v_caller);

  -- Notify PM (creator) that invoice was sent
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
