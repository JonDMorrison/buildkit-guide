
-- ================================================================
-- CHANGE ORDERS HARDENING — RPCs + recalculate
-- Schema + policies already applied in prior migration.
-- ================================================================

-- Drop and recreate RPCs with correct return types (jsonb)
DROP FUNCTION IF EXISTS public.rpc_recalculate_change_order_totals(uuid);

CREATE OR REPLACE FUNCTION public.rpc_recalculate_change_order_totals(
  p_change_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_subtotal numeric;
  v_tax numeric;
  v_tax_rate numeric;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM change_orders WHERE id = p_change_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change order not found' USING ERRCODE = '42501';
  END IF;
  IF NOT has_org_membership(v_org_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(tax_rate, 0) INTO v_tax_rate
  FROM invoice_settings WHERE organization_id = v_org_id;
  IF NOT FOUND THEN v_tax_rate := 0; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_subtotal
  FROM change_order_line_items WHERE change_order_id = p_change_order_id;

  SELECT COALESCE(SUM(amount), 0) * (v_tax_rate / 100.0) INTO v_tax
  FROM change_order_line_items
  WHERE change_order_id = p_change_order_id AND taxable = true;

  UPDATE change_orders SET
    subtotal = v_subtotal,
    tax = ROUND(v_tax, 2),
    total = v_subtotal + ROUND(v_tax, 2),
    updated_at = now()
  WHERE id = p_change_order_id;
END;
$$;

-- rpc_create_change_order (returns jsonb, existing signature)
CREATE OR REPLACE FUNCTION public.rpc_create_change_order(
  p_project_id uuid,
  p_payload_json jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_project_currency text;
  v_co_currency text;
  v_co_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT organization_id INTO v_org_id FROM projects WHERE id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501';
  END IF;

  IF NOT has_project_access(p_project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Only admin or PM can create change orders' USING ERRCODE = '42501';
  END IF;

  -- Get project currency from estimates or default
  SELECT COALESCE(currency, 'CAD') INTO v_project_currency
  FROM estimates WHERE project_id = p_project_id LIMIT 1;
  IF NOT FOUND THEN v_project_currency := 'CAD'; END IF;

  v_co_currency := COALESCE(p_payload_json->>'currency', v_project_currency);
  IF v_co_currency NOT IN ('CAD', 'USD') THEN
    RAISE EXCEPTION 'Invalid currency: %', v_co_currency USING ERRCODE = 'P0001';
  END IF;

  v_co_id := gen_random_uuid();
  INSERT INTO change_orders (id, organization_id, project_id, title, reason, status, currency, created_by,
    change_order_number, description, amount)
  VALUES (
    v_co_id, v_org_id, p_project_id,
    COALESCE(p_payload_json->>'title', 'Untitled Change Order'),
    COALESCE(p_payload_json->>'reason', ''),
    'draft', v_co_currency, v_user_id,
    p_payload_json->>'change_order_number',
    COALESCE(p_payload_json->>'description', ''),
    0
  );

  RETURN jsonb_build_object('id', v_co_id, 'status', 'created');
END;
$$;

-- rpc_update_change_order
CREATE OR REPLACE FUNCTION public.rpc_update_change_order(
  p_change_order_id uuid,
  p_payload_json jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_co record;
  v_new_currency text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_co FROM change_orders WHERE id = p_change_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change order not found' USING ERRCODE = '42501';
  END IF;

  IF NOT has_project_access(v_co.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF v_co.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Cannot update a % change order', v_co.status USING ERRCODE = 'P0001';
  END IF;

  v_new_currency := p_payload_json->>'currency';
  IF v_new_currency IS NOT NULL AND v_new_currency NOT IN ('CAD', 'USD') THEN
    RAISE EXCEPTION 'Invalid currency' USING ERRCODE = 'P0001';
  END IF;

  UPDATE change_orders SET
    title = COALESCE(p_payload_json->>'title', title),
    reason = COALESCE(p_payload_json->>'reason', reason),
    description = COALESCE(p_payload_json->>'description', description),
    change_order_number = COALESCE(p_payload_json->>'change_order_number', change_order_number),
    currency = COALESCE(v_new_currency, currency),
    estimate_id = COALESCE((p_payload_json->>'estimate_id')::uuid, estimate_id),
    updated_at = now()
  WHERE id = p_change_order_id;

  PERFORM rpc_recalculate_change_order_totals(p_change_order_id);
  RETURN jsonb_build_object('status', 'updated');
END;
$$;

-- rpc_approve_change_order
CREATE OR REPLACE FUNCTION public.rpc_approve_change_order(
  p_change_order_id uuid,
  p_approved boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_co record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_co FROM change_orders WHERE id = p_change_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change order not found' USING ERRCODE = '42501';
  END IF;

  IF NOT has_org_role(v_co.organization_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Only admin can approve change orders' USING ERRCODE = '42501';
  END IF;

  IF v_co.status NOT IN ('sent', 'submitted') THEN
    RAISE EXCEPTION 'Can only approve sent/submitted change orders' USING ERRCODE = 'P0001';
  END IF;

  PERFORM rpc_recalculate_change_order_totals(p_change_order_id);

  UPDATE change_orders SET
    status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
    approved_by = v_user_id,
    amount = total,
    updated_at = now()
  WHERE id = p_change_order_id;

  RETURN jsonb_build_object('status', CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END);
END;
$$;

-- rpc_add_change_order_line_item
CREATE OR REPLACE FUNCTION public.rpc_add_change_order_line_item(
  p_change_order_id uuid,
  p_name text,
  p_description text DEFAULT '',
  p_quantity numeric DEFAULT 1,
  p_rate numeric DEFAULT 0,
  p_sort_order integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_co record;
  v_li_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_co FROM change_orders WHERE id = p_change_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change order not found' USING ERRCODE = '42501';
  END IF;

  IF NOT has_project_access(v_co.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF v_co.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Cannot modify a % change order', v_co.status USING ERRCODE = 'P0001';
  END IF;

  v_li_id := gen_random_uuid();
  INSERT INTO change_order_line_items (id, change_order_id, name, description, quantity, rate, amount, sort_order)
  VALUES (v_li_id, p_change_order_id, p_name, p_description, p_quantity, p_rate, p_quantity * p_rate, p_sort_order);

  PERFORM rpc_recalculate_change_order_totals(p_change_order_id);
  RETURN jsonb_build_object('id', v_li_id, 'status', 'created');
END;
$$;

-- rpc_update_change_order_line_item
CREATE OR REPLACE FUNCTION public.rpc_update_change_order_line_item(
  p_line_item_id uuid,
  p_payload_json jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_li record;
  v_co record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_li FROM change_order_line_items WHERE id = p_line_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Line item not found' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_co FROM change_orders WHERE id = v_li.change_order_id;
  IF NOT has_project_access(v_co.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF v_co.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Cannot modify a % change order', v_co.status USING ERRCODE = 'P0001';
  END IF;

  UPDATE change_order_line_items SET
    name = COALESCE(p_payload_json->>'name', name),
    description = COALESCE(p_payload_json->>'description', description),
    quantity = COALESCE((p_payload_json->>'quantity')::numeric, quantity),
    rate = COALESCE((p_payload_json->>'rate')::numeric, rate),
    amount = COALESCE((p_payload_json->>'quantity')::numeric, quantity) * COALESCE((p_payload_json->>'rate')::numeric, rate),
    item_type = COALESCE(p_payload_json->>'item_type', item_type),
    unit = COALESCE(p_payload_json->>'unit', unit),
    taxable = COALESCE((p_payload_json->>'taxable')::boolean, taxable),
    sort_order = COALESCE((p_payload_json->>'sort_order')::int, sort_order),
    updated_at = now()
  WHERE id = p_line_item_id;

  PERFORM rpc_recalculate_change_order_totals(v_li.change_order_id);
  RETURN jsonb_build_object('status', 'updated');
END;
$$;

-- rpc_delete_change_order_line_item
CREATE OR REPLACE FUNCTION public.rpc_delete_change_order_line_item(
  p_line_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_li record;
  v_co record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_li FROM change_order_line_items WHERE id = p_line_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Line item not found' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_co FROM change_orders WHERE id = v_li.change_order_id;
  IF NOT has_project_access(v_co.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF v_co.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Cannot modify a % change order', v_co.status USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM change_order_line_items WHERE id = p_line_item_id;
  PERFORM rpc_recalculate_change_order_totals(v_li.change_order_id);
  RETURN jsonb_build_object('status', 'deleted');
END;
$$;

-- rpc_send_change_order (submit)
CREATE OR REPLACE FUNCTION public.rpc_send_change_order(
  p_change_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_co record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_co FROM change_orders WHERE id = p_change_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change order not found' USING ERRCODE = '42501';
  END IF;

  IF NOT has_project_access(v_co.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Only admin or PM can submit change orders' USING ERRCODE = '42501';
  END IF;

  IF v_co.status != 'draft' THEN
    RAISE EXCEPTION 'Can only submit draft change orders' USING ERRCODE = 'P0001';
  END IF;

  PERFORM rpc_recalculate_change_order_totals(p_change_order_id);

  UPDATE change_orders SET
    status = 'sent',
    amount = total,
    updated_at = now()
  WHERE id = p_change_order_id;

  RETURN jsonb_build_object('status', 'sent');
END;
$$;
