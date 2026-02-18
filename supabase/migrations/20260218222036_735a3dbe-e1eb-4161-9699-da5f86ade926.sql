
-- =============================================
-- Estimates Module v1: Schema + RPCs
-- =============================================

-- 1) Add missing columns to estimates
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pst_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_cost_rate numeric DEFAULT NULL;

-- 2) FORCE ROW LEVEL SECURITY on both tables
ALTER TABLE public.estimates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_line_items FORCE ROW LEVEL SECURITY;

-- 3) Deny direct writes (authenticated role) on estimates
DO $$
BEGIN
  -- Drop existing permissive write policies if any
  DROP POLICY IF EXISTS "Users can create their own estimates" ON public.estimates;
  DROP POLICY IF EXISTS "Users can update their own estimates" ON public.estimates;
  DROP POLICY IF EXISTS "Users can delete their own estimates" ON public.estimates;
  DROP POLICY IF EXISTS "deny_insert_estimates" ON public.estimates;
  DROP POLICY IF EXISTS "deny_update_estimates" ON public.estimates;
  DROP POLICY IF EXISTS "deny_delete_estimates" ON public.estimates;
END$$;

CREATE POLICY "deny_insert_estimates" ON public.estimates
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "deny_update_estimates" ON public.estimates
  FOR UPDATE TO authenticated USING (false);
CREATE POLICY "deny_delete_estimates" ON public.estimates
  FOR DELETE TO authenticated USING (false);

-- Keep SELECT open for org members
DROP POLICY IF EXISTS "select_estimates_org" ON public.estimates;
CREATE POLICY "select_estimates_org" ON public.estimates
  FOR SELECT TO authenticated
  USING (public.has_org_membership(organization_id));

-- 4) Deny direct writes on estimate_line_items
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can create estimate line items" ON public.estimate_line_items;
  DROP POLICY IF EXISTS "Users can update estimate line items" ON public.estimate_line_items;
  DROP POLICY IF EXISTS "Users can delete estimate line items" ON public.estimate_line_items;
  DROP POLICY IF EXISTS "deny_insert_eli" ON public.estimate_line_items;
  DROP POLICY IF EXISTS "deny_update_eli" ON public.estimate_line_items;
  DROP POLICY IF EXISTS "deny_delete_eli" ON public.estimate_line_items;
END$$;

CREATE POLICY "deny_insert_eli" ON public.estimate_line_items
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "deny_update_eli" ON public.estimate_line_items
  FOR UPDATE TO authenticated USING (false);
CREATE POLICY "deny_delete_eli" ON public.estimate_line_items
  FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS "select_eli_org" ON public.estimate_line_items;
CREATE POLICY "select_eli_org" ON public.estimate_line_items
  FOR SELECT TO authenticated
  USING (public.has_org_membership(organization_id));

-- 5) RPC: Create Estimate
CREATE OR REPLACE FUNCTION public.rpc_create_estimate(p_project_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid := auth.uid();
  v_est_num text;
  v_result json;
BEGIN
  -- Get org from project
  SELECT organization_id INTO v_org_id
  FROM projects WHERE id = p_project_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501';
  END IF;

  -- Check PM/Admin access
  IF NOT has_project_access(p_project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden: PM or Admin required' USING ERRCODE = '42501';
  END IF;

  -- Generate estimate number
  SELECT COALESCE(
    (SELECT 'EST-' || lpad((COALESCE(MAX(CAST(NULLIF(regexp_replace(estimate_number, '[^0-9]', '', 'g'), '') AS int)), 0) + 1)::text, 4, '0')
     FROM estimates WHERE organization_id = v_org_id),
    'EST-0001'
  ) INTO v_est_num;

  INSERT INTO estimates (
    project_id, organization_id, created_by, estimate_number, status,
    contract_value, planned_labor_hours, planned_labor_bill_rate, planned_labor_bill_amount,
    planned_material_cost, planned_machine_cost, planned_other_cost,
    planned_total_cost, planned_profit, planned_margin_percent,
    subtotal, gst_total, pst_total
  ) VALUES (
    p_project_id, v_org_id, v_user_id, v_est_num, 'draft',
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
  )
  RETURNING row_to_json(estimates.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- 6) RPC: Update Estimate Header
CREATE OR REPLACE FUNCTION public.rpc_update_estimate_header(p_estimate_id uuid, p_patch jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_est record;
  v_result json;
BEGIN
  SELECT * INTO v_est FROM estimates WHERE id = p_estimate_id;
  IF v_est IS NULL THEN
    RAISE EXCEPTION 'Estimate not found' USING ERRCODE = '42501';
  END IF;
  IF v_est.status = 'approved' THEN
    RAISE EXCEPTION 'Cannot edit approved estimate' USING ERRCODE = '42501';
  END IF;
  IF NOT has_project_access(v_est.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE estimates SET
    contract_value = COALESCE((p_patch->>'contract_value')::numeric, contract_value),
    planned_labor_hours = COALESCE((p_patch->>'planned_labor_hours')::numeric, planned_labor_hours),
    planned_labor_bill_rate = COALESCE((p_patch->>'planned_labor_bill_rate')::numeric, planned_labor_bill_rate),
    labor_cost_rate = COALESCE((p_patch->>'labor_cost_rate')::numeric, labor_cost_rate),
    planned_material_cost = COALESCE((p_patch->>'planned_material_cost')::numeric, planned_material_cost),
    planned_machine_cost = COALESCE((p_patch->>'planned_machine_cost')::numeric, planned_machine_cost),
    planned_other_cost = COALESCE((p_patch->>'planned_other_cost')::numeric, planned_other_cost),
    note_for_customer = COALESCE(p_patch->>'note_for_customer', note_for_customer),
    memo_on_statement = COALESCE(p_patch->>'memo_on_statement', memo_on_statement),
    internal_notes = COALESCE(p_patch->>'internal_notes', internal_notes),
    bill_to_name = COALESCE(p_patch->>'bill_to_name', bill_to_name),
    bill_to_address = COALESCE(p_patch->>'bill_to_address', bill_to_address),
    bill_to_ap_email = COALESCE(p_patch->>'bill_to_ap_email', bill_to_ap_email),
    ship_to_name = COALESCE(p_patch->>'ship_to_name', ship_to_name),
    ship_to_address = COALESCE(p_patch->>'ship_to_address', ship_to_address),
    client_id = COALESCE((p_patch->>'client_id')::uuid, client_id),
    parent_client_id = COALESCE((p_patch->>'parent_client_id')::uuid, parent_client_id),
    customer_po_number = COALESCE(p_patch->>'customer_po_number', customer_po_number),
    customer_pm_name = COALESCE(p_patch->>'customer_pm_name', customer_pm_name),
    customer_pm_email = COALESCE(p_patch->>'customer_pm_email', customer_pm_email),
    customer_pm_phone = COALESCE(p_patch->>'customer_pm_phone', customer_pm_phone),
    updated_at = now()
  WHERE id = p_estimate_id
  RETURNING row_to_json(estimates.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- 7) RPC: Upsert Estimate Line Item
CREATE OR REPLACE FUNCTION public.rpc_upsert_estimate_line_item(
  p_estimate_id uuid,
  p_line_item_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_est record;
  v_qty numeric;
  v_rate numeric;
  v_amount numeric;
  v_tax_rate numeric;
  v_tax_amount numeric;
  v_result json;
  v_sort int;
BEGIN
  SELECT * INTO v_est FROM estimates WHERE id = p_estimate_id;
  IF v_est IS NULL THEN RAISE EXCEPTION 'Estimate not found' USING ERRCODE = '42501'; END IF;
  IF v_est.status = 'approved' THEN RAISE EXCEPTION 'Cannot edit approved estimate' USING ERRCODE = '42501'; END IF;
  IF NOT has_project_access(v_est.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_qty := COALESCE((p_payload->>'quantity')::numeric, 0);
  v_rate := COALESCE((p_payload->>'rate')::numeric, 0);
  v_amount := round(v_qty * v_rate, 2);
  v_tax_rate := COALESCE((p_payload->>'sales_tax_rate')::numeric, 0);
  v_tax_amount := round(v_amount * (v_tax_rate / 100), 2);

  IF p_line_item_id IS NOT NULL THEN
    UPDATE estimate_line_items SET
      item_type = COALESCE(p_payload->>'item_type', item_type),
      name = COALESCE(p_payload->>'name', name),
      description = COALESCE(p_payload->>'description', description),
      quantity = v_qty,
      unit = COALESCE(p_payload->>'unit', unit),
      rate = v_rate,
      amount = v_amount,
      sales_tax_rate = v_tax_rate,
      sales_tax_amount = v_tax_amount,
      sort_order = COALESCE((p_payload->>'sort_order')::int, sort_order)
    WHERE id = p_line_item_id AND estimate_id = p_estimate_id
    RETURNING row_to_json(estimate_line_items.*) INTO v_result;
  ELSE
    SELECT COALESCE(MAX(sort_order), -1) + 1 INTO v_sort
    FROM estimate_line_items WHERE estimate_id = p_estimate_id;

    INSERT INTO estimate_line_items (
      estimate_id, organization_id, item_type, name, description,
      quantity, unit, rate, amount, sales_tax_rate, sales_tax_amount, sort_order
    ) VALUES (
      p_estimate_id, v_est.organization_id,
      COALESCE(p_payload->>'item_type', 'labor'),
      COALESCE(p_payload->>'name', 'New Item'),
      p_payload->>'description',
      v_qty, p_payload->>'unit', v_rate, v_amount, v_tax_rate, v_tax_amount, v_sort
    )
    RETURNING row_to_json(estimate_line_items.*) INTO v_result;
  END IF;

  -- Auto-recalculate
  PERFORM rpc_recalculate_estimate_totals(p_estimate_id);

  RETURN v_result;
END;
$$;

-- 8) RPC: Delete Estimate Line Item
CREATE OR REPLACE FUNCTION public.rpc_delete_estimate_line_item(p_line_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_est_id uuid;
  v_proj_id uuid;
  v_status text;
BEGIN
  SELECT eli.estimate_id, e.project_id, e.status
  INTO v_est_id, v_proj_id, v_status
  FROM estimate_line_items eli
  JOIN estimates e ON e.id = eli.estimate_id
  WHERE eli.id = p_line_item_id;

  IF v_est_id IS NULL THEN RAISE EXCEPTION 'Line item not found' USING ERRCODE = '42501'; END IF;
  IF v_status = 'approved' THEN RAISE EXCEPTION 'Cannot edit approved estimate' USING ERRCODE = '42501'; END IF;
  IF NOT has_project_access(v_proj_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  DELETE FROM estimate_line_items WHERE id = p_line_item_id;
  PERFORM rpc_recalculate_estimate_totals(v_est_id);
END;
$$;

-- 9) RPC: Recalculate Estimate Totals
CREATE OR REPLACE FUNCTION public.rpc_recalculate_estimate_totals(p_estimate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric;
  v_gst numeric;
  v_pst numeric;
  v_labor_hours numeric;
  v_labor_amount numeric;
  v_labor_rate numeric;
  v_material numeric;
  v_machine numeric;
  v_other numeric;
  v_total_cost numeric;
  v_contract numeric;
  v_profit numeric;
  v_margin numeric;
BEGIN
  SELECT
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(CASE WHEN sales_tax_rate > 0 THEN sales_tax_amount ELSE 0 END), 0),
    COALESCE(SUM(quantity) FILTER (WHERE item_type = 'labor'), 0),
    COALESCE(SUM(amount) FILTER (WHERE item_type = 'labor'), 0),
    COALESCE(SUM(amount) FILTER (WHERE item_type = 'material'), 0),
    COALESCE(SUM(amount) FILTER (WHERE item_type = 'machine'), 0),
    COALESCE(SUM(amount) FILTER (WHERE item_type = 'other'), 0)
  INTO v_subtotal, v_gst, v_labor_hours, v_labor_amount, v_material, v_machine, v_other
  FROM estimate_line_items
  WHERE estimate_id = p_estimate_id;

  v_pst := 0; -- PST tracked separately if needed
  v_labor_rate := CASE WHEN v_labor_hours > 0 THEN round(v_labor_amount / v_labor_hours, 2) ELSE 0 END;
  v_total_cost := v_labor_amount + v_material + v_machine + v_other;

  SELECT contract_value INTO v_contract FROM estimates WHERE id = p_estimate_id;
  v_profit := round(v_contract - v_total_cost, 2);
  v_margin := CASE WHEN v_contract > 0 THEN round((v_profit / v_contract) * 100, 1) ELSE 0 END;

  UPDATE estimates SET
    subtotal = v_subtotal,
    gst_total = v_gst,
    pst_total = v_pst,
    planned_labor_hours = v_labor_hours,
    planned_labor_bill_rate = v_labor_rate,
    planned_labor_bill_amount = v_labor_amount,
    planned_material_cost = v_material,
    planned_machine_cost = v_machine,
    planned_other_cost = v_other,
    planned_total_cost = v_total_cost,
    planned_profit = v_profit,
    planned_margin_percent = v_margin,
    updated_at = now()
  WHERE id = p_estimate_id;
END;
$$;

-- 10) RPC: Approve Estimate
CREATE OR REPLACE FUNCTION public.rpc_approve_estimate(p_estimate_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_est record;
  v_result json;
BEGIN
  SELECT * INTO v_est FROM estimates WHERE id = p_estimate_id;
  IF v_est IS NULL THEN RAISE EXCEPTION 'Estimate not found' USING ERRCODE = '42501'; END IF;
  IF v_est.status != 'draft' THEN RAISE EXCEPTION 'Only draft estimates can be approved' USING ERRCODE = '42501'; END IF;
  IF NOT has_project_access(v_est.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE estimates SET status = 'approved', approved_at = now(), updated_at = now()
  WHERE id = p_estimate_id
  RETURNING row_to_json(estimates.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- 11) RPC: Delete Estimate (draft only)
CREATE OR REPLACE FUNCTION public.rpc_delete_estimate(p_estimate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_est record;
BEGIN
  SELECT * INTO v_est FROM estimates WHERE id = p_estimate_id;
  IF v_est IS NULL THEN RAISE EXCEPTION 'Estimate not found' USING ERRCODE = '42501'; END IF;
  IF v_est.status = 'approved' THEN RAISE EXCEPTION 'Cannot delete approved estimate' USING ERRCODE = '42501'; END IF;
  IF NOT has_project_access(v_est.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  DELETE FROM estimate_line_items WHERE estimate_id = p_estimate_id;
  DELETE FROM estimates WHERE id = p_estimate_id;
END;
$$;

-- 12) RPC: Duplicate Estimate
CREATE OR REPLACE FUNCTION public.rpc_duplicate_estimate(p_estimate_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_est record;
  v_org_id uuid;
  v_user_id uuid := auth.uid();
  v_est_num text;
  v_new_id uuid;
  v_result json;
BEGIN
  SELECT * INTO v_est FROM estimates WHERE id = p_estimate_id;
  IF v_est IS NULL THEN RAISE EXCEPTION 'Estimate not found' USING ERRCODE = '42501'; END IF;
  IF NOT has_project_access(v_est.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_org_id := v_est.organization_id;
  SELECT 'EST-' || lpad((COALESCE(MAX(CAST(NULLIF(regexp_replace(estimate_number, '[^0-9]', '', 'g'), '') AS int)), 0) + 1)::text, 4, '0')
  INTO v_est_num FROM estimates WHERE organization_id = v_org_id;

  INSERT INTO estimates (
    project_id, organization_id, created_by, estimate_number, status,
    contract_value, planned_labor_hours, planned_labor_bill_rate, planned_labor_bill_amount,
    planned_material_cost, planned_machine_cost, planned_other_cost,
    planned_total_cost, planned_profit, planned_margin_percent,
    subtotal, gst_total, pst_total, labor_cost_rate,
    client_id, parent_client_id,
    customer_po_number, customer_pm_name, customer_pm_email, customer_pm_phone,
    bill_to_name, bill_to_address, bill_to_ap_email,
    ship_to_name, ship_to_address,
    note_for_customer, memo_on_statement, internal_notes
  ) VALUES (
    v_est.project_id, v_org_id, v_user_id, v_est_num, 'draft',
    v_est.contract_value, v_est.planned_labor_hours, v_est.planned_labor_bill_rate, v_est.planned_labor_bill_amount,
    v_est.planned_material_cost, v_est.planned_machine_cost, v_est.planned_other_cost,
    v_est.planned_total_cost, v_est.planned_profit, v_est.planned_margin_percent,
    v_est.subtotal, v_est.gst_total, v_est.pst_total, v_est.labor_cost_rate,
    v_est.client_id, v_est.parent_client_id,
    v_est.customer_po_number, v_est.customer_pm_name, v_est.customer_pm_email, v_est.customer_pm_phone,
    v_est.bill_to_name, v_est.bill_to_address, v_est.bill_to_ap_email,
    v_est.ship_to_name, v_est.ship_to_address,
    v_est.note_for_customer, v_est.memo_on_statement, v_est.internal_notes
  )
  RETURNING id INTO v_new_id;

  -- Copy line items
  INSERT INTO estimate_line_items (
    estimate_id, organization_id, item_type, name, description,
    quantity, unit, rate, amount, sales_tax_rate, sales_tax_amount, sort_order
  )
  SELECT v_new_id, organization_id, item_type, name, description,
    quantity, unit, rate, amount, sales_tax_rate, sales_tax_amount, sort_order
  FROM estimate_line_items WHERE estimate_id = p_estimate_id
  ORDER BY sort_order;

  SELECT row_to_json(e.*) INTO v_result FROM estimates e WHERE e.id = v_new_id;
  RETURN v_result;
END;
$$;

-- 13) RPC: Generate Tasks from Estimate (labor line items → scope items → tasks)
CREATE OR REPLACE FUNCTION public.rpc_generate_tasks_from_estimate(p_estimate_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_est record;
  v_li record;
  v_scope_id uuid;
  v_created_scope int := 0;
  v_skipped int := 0;
  v_existing_scope_id uuid;
BEGIN
  SELECT * INTO v_est FROM estimates WHERE id = p_estimate_id;
  IF v_est IS NULL THEN RAISE EXCEPTION 'Estimate not found' USING ERRCODE = '42501'; END IF;
  IF NOT has_project_access(v_est.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Iterate labor line items
  FOR v_li IN
    SELECT * FROM estimate_line_items
    WHERE estimate_id = p_estimate_id
      AND item_type = 'labor'
      AND TRIM(name) != ''
    ORDER BY sort_order
  LOOP
    -- Check if scope item already linked to this line item
    SELECT id INTO v_existing_scope_id
    FROM project_scope_items
    WHERE project_id = v_est.project_id
      AND estimate_line_item_id = v_li.id;

    IF v_existing_scope_id IS NOT NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO project_scope_items (
      project_id, organization_id, item_type, name, description,
      estimated_hours, estimated_cost, estimate_line_item_id
    ) VALUES (
      v_est.project_id, v_est.organization_id, 'labor', v_li.name, v_li.description,
      v_li.quantity, v_li.amount, v_li.id
    )
    RETURNING id INTO v_scope_id;

    v_created_scope := v_created_scope + 1;
  END LOOP;

  -- Now generate tasks from scope
  DECLARE
    v_task_result json;
  BEGIN
    SELECT generate_tasks_from_scope(
      p_project_id := v_est.project_id,
      p_mode := 'create_missing'
    ) INTO v_task_result;
  EXCEPTION WHEN OTHERS THEN
    -- generate_tasks_from_scope may not exist yet
    NULL;
  END;

  RETURN json_build_object(
    'created_scope_items', v_created_scope,
    'skipped_existing', v_skipped,
    'estimate_id', p_estimate_id,
    'project_id', v_est.project_id
  );
END;
$$;

-- 14) Add estimate_line_item_id column to project_scope_items for idempotent linking
ALTER TABLE public.project_scope_items
  ADD COLUMN IF NOT EXISTS estimate_line_item_id uuid REFERENCES public.estimate_line_items(id) ON DELETE SET NULL;

-- Add unique index for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_scope_items_estimate_line
  ON public.project_scope_items(estimate_line_item_id)
  WHERE estimate_line_item_id IS NOT NULL;
