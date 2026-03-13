-- Section 5: Link estimates to playbooks
-- Adds playbook_id FK to estimates and updates rpc_update_estimate_header to persist it.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS playbook_id uuid REFERENCES public.playbooks(id) ON DELETE SET NULL;

-- Update rpc_update_estimate_header to accept and persist playbook_id
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
    contract_value         = COALESCE((p_patch->>'contract_value')::numeric, contract_value),
    planned_labor_hours    = COALESCE((p_patch->>'planned_labor_hours')::numeric, planned_labor_hours),
    planned_labor_bill_rate = COALESCE((p_patch->>'planned_labor_bill_rate')::numeric, planned_labor_bill_rate),
    labor_cost_rate        = COALESCE((p_patch->>'labor_cost_rate')::numeric, labor_cost_rate),
    planned_material_cost  = COALESCE((p_patch->>'planned_material_cost')::numeric, planned_material_cost),
    planned_machine_cost   = COALESCE((p_patch->>'planned_machine_cost')::numeric, planned_machine_cost),
    planned_other_cost     = COALESCE((p_patch->>'planned_other_cost')::numeric, planned_other_cost),
    note_for_customer      = COALESCE(p_patch->>'note_for_customer', note_for_customer),
    memo_on_statement      = COALESCE(p_patch->>'memo_on_statement', memo_on_statement),
    internal_notes         = COALESCE(p_patch->>'internal_notes', internal_notes),
    bill_to_name           = COALESCE(p_patch->>'bill_to_name', bill_to_name),
    bill_to_address        = COALESCE(p_patch->>'bill_to_address', bill_to_address),
    bill_to_ap_email       = COALESCE(p_patch->>'bill_to_ap_email', bill_to_ap_email),
    ship_to_name           = COALESCE(p_patch->>'ship_to_name', ship_to_name),
    ship_to_address        = COALESCE(p_patch->>'ship_to_address', ship_to_address),
    client_id              = COALESCE((p_patch->>'client_id')::uuid, client_id),
    parent_client_id       = COALESCE((p_patch->>'parent_client_id')::uuid, parent_client_id),
    customer_po_number     = COALESCE(p_patch->>'customer_po_number', customer_po_number),
    customer_pm_name       = COALESCE(p_patch->>'customer_pm_name', customer_pm_name),
    customer_pm_email      = COALESCE(p_patch->>'customer_pm_email', customer_pm_email),
    customer_pm_phone      = COALESCE(p_patch->>'customer_pm_phone', customer_pm_phone),
    playbook_id            = CASE
                               WHEN p_patch ? 'playbook_id'
                               THEN (p_patch->>'playbook_id')::uuid
                               ELSE playbook_id
                             END,
    updated_at             = now()
  WHERE id = p_estimate_id
  RETURNING row_to_json(estimates.*) INTO v_result;

  RETURN v_result;
END;
$$;
