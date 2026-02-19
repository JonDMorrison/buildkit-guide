
-- ============================================
-- Change Orders: tables, RLS, RPCs
-- ============================================

-- 1. change_orders table
CREATE TABLE public.change_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  estimate_id uuid NULL REFERENCES public.estimates(id),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','approved','rejected','archived')),
  currency text NOT NULL DEFAULT 'CAD'
    CHECK (currency IN ('CAD','USD')),
  title text NOT NULL,
  reason text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. change_order_line_items table
CREATE TABLE public.change_order_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  change_order_id uuid NOT NULL REFERENCES public.change_orders(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  rate numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_change_orders_project ON public.change_orders(project_id);
CREATE INDEX idx_change_orders_org ON public.change_orders(organization_id);
CREATE INDEX idx_co_line_items_co ON public.change_order_line_items(change_order_id);

-- 3. RLS + FORCE
ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.change_order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_order_line_items FORCE ROW LEVEL SECURITY;

-- SELECT: org-scoped
CREATE POLICY "co_select" ON public.change_orders
  FOR SELECT USING (public.has_org_membership(organization_id));

CREATE POLICY "co_li_select" ON public.change_order_line_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.change_orders co
      WHERE co.id = change_order_id
        AND public.has_org_membership(co.organization_id)
    )
  );

-- Deny direct writes
CREATE POLICY "co_deny_insert" ON public.change_orders FOR INSERT WITH CHECK (false);
CREATE POLICY "co_deny_update" ON public.change_orders FOR UPDATE USING (false);
CREATE POLICY "co_deny_delete" ON public.change_orders FOR DELETE USING (false);

CREATE POLICY "co_li_deny_insert" ON public.change_order_line_items FOR INSERT WITH CHECK (false);
CREATE POLICY "co_li_deny_update" ON public.change_order_line_items FOR UPDATE USING (false);
CREATE POLICY "co_li_deny_delete" ON public.change_order_line_items FOR DELETE USING (false);

-- Updated_at trigger
CREATE TRIGGER update_change_orders_updated_at
  BEFORE UPDATE ON public.change_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_co_line_items_updated_at
  BEFORE UPDATE ON public.change_order_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RPCs
-- ============================================

-- rpc_create_change_order
CREATE OR REPLACE FUNCTION public.rpc_create_change_order(
  p_project_id uuid,
  p_payload_json jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_proj_currency text;
  v_currency text;
  v_co_id uuid;
BEGIN
  SELECT organization_id, currency INTO v_org_id, v_proj_currency
    FROM projects WHERE id = p_project_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501';
  END IF;

  IF NOT has_project_access(p_project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_currency := COALESCE(p_payload_json->>'currency', v_proj_currency, 'CAD');
  IF v_currency <> v_proj_currency AND v_proj_currency IS NOT NULL THEN
    RAISE EXCEPTION 'Currency must match project currency (%)' , v_proj_currency USING ERRCODE = '22023';
  END IF;

  INSERT INTO change_orders (organization_id, project_id, estimate_id, title, reason, amount, currency, created_by)
  VALUES (
    v_org_id,
    p_project_id,
    (p_payload_json->>'estimate_id')::uuid,
    COALESCE(p_payload_json->>'title', 'Untitled Change Order'),
    COALESCE(p_payload_json->>'reason', ''),
    COALESCE((p_payload_json->>'amount')::numeric, 0),
    v_currency,
    v_uid
  ) RETURNING id INTO v_co_id;

  RETURN jsonb_build_object('id', v_co_id, 'status', 'draft');
END;
$$;

-- rpc_update_change_order
CREATE OR REPLACE FUNCTION public.rpc_update_change_order(
  p_change_order_id uuid,
  p_payload_json jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_co record;
BEGIN
  SELECT * INTO v_co FROM change_orders WHERE id = p_change_order_id;
  IF v_co IS NULL THEN
    RAISE EXCEPTION 'Change order not found' USING ERRCODE = '42501';
  END IF;
  IF v_co.status NOT IN ('draft') THEN
    RAISE EXCEPTION 'Only draft change orders can be edited' USING ERRCODE = '22023';
  END IF;
  IF NOT has_project_access(v_co.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE change_orders SET
    title = COALESCE(p_payload_json->>'title', title),
    reason = COALESCE(p_payload_json->>'reason', reason),
    amount = COALESCE((p_payload_json->>'amount')::numeric, amount),
    estimate_id = COALESCE((p_payload_json->>'estimate_id')::uuid, estimate_id)
  WHERE id = p_change_order_id;

  RETURN jsonb_build_object('id', p_change_order_id, 'updated', true);
END;
$$;

-- rpc_add_change_order_line_item
CREATE OR REPLACE FUNCTION public.rpc_add_change_order_line_item(
  p_change_order_id uuid,
  p_name text,
  p_description text DEFAULT '',
  p_quantity numeric DEFAULT 1,
  p_rate numeric DEFAULT 0,
  p_sort_order int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_co record;
  v_li_id uuid;
  v_amount numeric;
BEGIN
  SELECT * INTO v_co FROM change_orders WHERE id = p_change_order_id;
  IF v_co IS NULL THEN RAISE EXCEPTION 'Change order not found' USING ERRCODE = '42501'; END IF;
  IF v_co.status <> 'draft' THEN RAISE EXCEPTION 'Only draft COs can be modified' USING ERRCODE = '22023'; END IF;
  IF NOT has_project_access(v_co.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_amount := p_quantity * p_rate;
  INSERT INTO change_order_line_items (change_order_id, name, description, quantity, rate, amount, sort_order)
  VALUES (p_change_order_id, p_name, p_description, p_quantity, p_rate, v_amount, p_sort_order)
  RETURNING id INTO v_li_id;

  -- Update CO total
  UPDATE change_orders SET amount = (
    SELECT COALESCE(SUM(amount),0) FROM change_order_line_items WHERE change_order_id = p_change_order_id
  ) WHERE id = p_change_order_id;

  RETURN jsonb_build_object('id', v_li_id, 'amount', v_amount);
END;
$$;

-- rpc_update_change_order_line_item
CREATE OR REPLACE FUNCTION public.rpc_update_change_order_line_item(
  p_line_item_id uuid,
  p_payload_json jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_li record;
  v_co record;
BEGIN
  SELECT * INTO v_li FROM change_order_line_items WHERE id = p_line_item_id;
  IF v_li IS NULL THEN RAISE EXCEPTION 'Line item not found' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_co FROM change_orders WHERE id = v_li.change_order_id;
  IF v_co.status <> 'draft' THEN RAISE EXCEPTION 'Only draft COs can be modified' USING ERRCODE = '22023'; END IF;
  IF NOT has_project_access(v_co.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE change_order_line_items SET
    name = COALESCE(p_payload_json->>'name', name),
    description = COALESCE(p_payload_json->>'description', description),
    quantity = COALESCE((p_payload_json->>'quantity')::numeric, quantity),
    rate = COALESCE((p_payload_json->>'rate')::numeric, rate),
    amount = COALESCE((p_payload_json->>'quantity')::numeric, quantity) * COALESCE((p_payload_json->>'rate')::numeric, rate),
    sort_order = COALESCE((p_payload_json->>'sort_order')::int, sort_order)
  WHERE id = p_line_item_id;

  -- Recalc CO total
  UPDATE change_orders SET amount = (
    SELECT COALESCE(SUM(amount),0) FROM change_order_line_items WHERE change_order_id = v_li.change_order_id
  ) WHERE id = v_li.change_order_id;

  RETURN jsonb_build_object('id', p_line_item_id, 'updated', true);
END;
$$;

-- rpc_delete_change_order_line_item
CREATE OR REPLACE FUNCTION public.rpc_delete_change_order_line_item(
  p_line_item_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_li record;
  v_co record;
BEGIN
  SELECT * INTO v_li FROM change_order_line_items WHERE id = p_line_item_id;
  IF v_li IS NULL THEN RAISE EXCEPTION 'Line item not found' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_co FROM change_orders WHERE id = v_li.change_order_id;
  IF v_co.status <> 'draft' THEN RAISE EXCEPTION 'Only draft COs can be modified' USING ERRCODE = '22023'; END IF;
  IF NOT has_project_access(v_co.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  DELETE FROM change_order_line_items WHERE id = p_line_item_id;

  UPDATE change_orders SET amount = (
    SELECT COALESCE(SUM(amount),0) FROM change_order_line_items WHERE change_order_id = v_li.change_order_id
  ) WHERE id = v_li.change_order_id;

  RETURN jsonb_build_object('deleted', true);
END;
$$;

-- rpc_send_change_order (draft -> sent)
CREATE OR REPLACE FUNCTION public.rpc_send_change_order(
  p_change_order_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_co record;
  v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO v_co FROM change_orders WHERE id = p_change_order_id;
  IF v_co IS NULL THEN RAISE EXCEPTION 'Change order not found' USING ERRCODE = '42501'; END IF;
  IF v_co.status <> 'draft' THEN RAISE EXCEPTION 'Only draft change orders can be sent' USING ERRCODE = '22023'; END IF;
  IF NOT has_project_access(v_co.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE change_orders SET status = 'sent' WHERE id = p_change_order_id;

  -- Create notifications for project admins/PMs
  INSERT INTO notifications (user_id, title, message, type, project_id, link_url)
  SELECT pm.user_id,
    'Change Order Sent: ' || v_co.title,
    'A change order for ' || v_co.amount || ' ' || v_co.currency || ' has been sent for review.',
    'general',
    v_co.project_id,
    '/change-orders/' || p_change_order_id
  FROM project_members pm
  WHERE pm.project_id = v_co.project_id
    AND pm.role IN ('admin','project_manager')
    AND pm.user_id <> v_uid;

  -- Audit log
  INSERT INTO audit_log (user_id, action, table_name, record_id, project_id, new_data)
  VALUES (v_uid, 'change_order_sent', 'change_orders', p_change_order_id::text, v_co.project_id,
    jsonb_build_object('title', v_co.title, 'amount', v_co.amount, 'currency', v_co.currency));

  RETURN jsonb_build_object('id', p_change_order_id, 'status', 'sent');
END;
$$;

-- rpc_approve_change_order (sent -> approved)
CREATE OR REPLACE FUNCTION public.rpc_approve_change_order(
  p_change_order_id uuid,
  p_approved boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_co record;
  v_uid uuid := auth.uid();
  v_new_status text;
BEGIN
  SELECT * INTO v_co FROM change_orders WHERE id = p_change_order_id;
  IF v_co IS NULL THEN RAISE EXCEPTION 'Change order not found' USING ERRCODE = '42501'; END IF;
  IF v_co.status <> 'sent' THEN RAISE EXCEPTION 'Only sent change orders can be approved/rejected' USING ERRCODE = '22023'; END IF;
  IF NOT has_project_access(v_co.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_new_status := CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END;
  UPDATE change_orders SET status = v_new_status WHERE id = p_change_order_id;

  -- Notify creator
  INSERT INTO notifications (user_id, title, message, type, project_id, link_url)
  VALUES (v_co.created_by,
    'Change Order ' || initcap(v_new_status) || ': ' || v_co.title,
    'Your change order has been ' || v_new_status || '.',
    'general',
    v_co.project_id,
    '/change-orders/' || p_change_order_id);

  -- Audit log
  INSERT INTO audit_log (user_id, action, table_name, record_id, project_id, new_data)
  VALUES (v_uid, 'change_order_' || v_new_status, 'change_orders', p_change_order_id::text, v_co.project_id,
    jsonb_build_object('title', v_co.title, 'amount', v_co.amount, 'decision', v_new_status));

  RETURN jsonb_build_object('id', p_change_order_id, 'status', v_new_status);
END;
$$;
