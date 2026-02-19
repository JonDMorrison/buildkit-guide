-- Drop the old void-returning function and recreate with jsonb return
DROP FUNCTION IF EXISTS public.rpc_request_invoice_approval(uuid);

CREATE OR REPLACE FUNCTION public.rpc_request_invoice_approval(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_org_role text;
  v_caller uuid := auth.uid();
  v_approver_roles text[];
  v_approver record;
  v_notified_count int := 0;
  v_skipped_count int := 0;
  v_link text;
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
    RAISE EXCEPTION 'Unauthorized to request invoice approval' USING ERRCODE = '42501';
  END IF;

  IF v_invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be submitted for approval';
  END IF;

  -- Idempotency: already pending/approved → return early
  IF v_invoice.approval_status IN ('pending', 'approved') THEN
    RETURN jsonb_build_object(
      'status', 'already_' || v_invoice.approval_status,
      'invoice_id', p_invoice_id,
      'notified_count', 0,
      'skipped_count', 0
    );
  END IF;

  UPDATE invoices
  SET approval_status = 'pending', updated_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO invoice_activity_log (invoice_id, user_id, action, details)
  VALUES (p_invoice_id, v_caller, 'approval_requested', 'Approval requested by ' || v_org_role);

  v_link := '/invoicing?invoice=' || p_invoice_id::text;

  SELECT COALESCE(os.invoice_send_approver_roles, '{admin}')
  INTO v_approver_roles
  FROM organization_settings os
  WHERE os.organization_id = v_invoice.organization_id;

  IF v_approver_roles IS NULL THEN
    v_approver_roles := '{admin}';
  END IF;

  FOR v_approver IN
    SELECT om.user_id
    FROM organization_memberships om
    WHERE om.organization_id = v_invoice.organization_id
      AND om.is_active = true
      AND om.role = ANY(v_approver_roles)
      AND om.user_id != v_caller
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = v_approver.user_id
        AND n.type = 'invoice_approval_requested'
        AND n.link_url = v_link
    ) THEN
      INSERT INTO notifications (user_id, project_id, type, title, message, link_url)
      VALUES (
        v_approver.user_id,
        v_invoice.project_id,
        'invoice_approval_requested',
        'Invoice Approval Requested',
        'Invoice ' || v_invoice.invoice_number || ' needs your approval.',
        v_link
      );
      v_notified_count := v_notified_count + 1;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'pending',
    'invoice_id', p_invoice_id,
    'notified_count', v_notified_count,
    'skipped_count', v_skipped_count,
    'link_url', v_link
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_request_invoice_approval(uuid) TO authenticated;