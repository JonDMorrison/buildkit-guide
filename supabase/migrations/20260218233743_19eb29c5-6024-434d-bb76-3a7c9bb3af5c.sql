
-- A) RPC to update project currency with financial activity guard
CREATE OR REPLACE FUNCTION public.rpc_update_project_currency(p_project_id uuid, p_currency text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_invoice_count int;
BEGIN
  -- Validate currency
  IF p_currency NOT IN ('CAD', 'USD') THEN
    RAISE EXCEPTION 'Currency must be CAD or USD' USING ERRCODE = '22023';
  END IF;

  -- Get org from project
  SELECT organization_id INTO v_org_id
  FROM projects WHERE id = p_project_id AND is_deleted = false;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501';
  END IF;

  -- Check caller has admin or pm access
  IF NOT public.has_org_role(v_org_id, ARRAY['admin', 'pm']) THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  -- Block if sent or paid invoices exist
  SELECT COUNT(*) INTO v_invoice_count
  FROM invoices
  WHERE project_id = p_project_id
    AND status IN ('sent', 'paid', 'partially_paid');

  IF v_invoice_count > 0 THEN
    RAISE EXCEPTION 'Cannot change currency: % sent/paid invoice(s) exist', v_invoice_count
      USING ERRCODE = '22023';
  END IF;

  -- Update
  UPDATE projects SET currency = p_currency WHERE id = p_project_id;
END;
$$;

-- B) RPC to update org base currency with financial activity guard
CREATE OR REPLACE FUNCTION public.rpc_update_org_base_currency(p_org_id uuid, p_currency text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_count int;
BEGIN
  -- Validate currency
  IF p_currency NOT IN ('CAD', 'USD') THEN
    RAISE EXCEPTION 'Currency must be CAD or USD' USING ERRCODE = '22023';
  END IF;

  -- Check caller is org admin
  IF NOT public.has_org_role(p_org_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  -- Block if any sent/paid invoices exist org-wide
  SELECT COUNT(*) INTO v_invoice_count
  FROM invoices i
  JOIN projects p ON p.id = i.project_id AND p.organization_id = p_org_id
  WHERE i.status IN ('sent', 'paid', 'partially_paid');

  IF v_invoice_count > 0 THEN
    RAISE EXCEPTION 'Cannot change base currency: % sent/paid invoice(s) exist across the organization', v_invoice_count
      USING ERRCODE = '22023';
  END IF;

  -- Update
  UPDATE organizations SET base_currency = p_currency WHERE id = p_org_id;
END;
$$;
