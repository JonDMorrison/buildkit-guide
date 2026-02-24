
CREATE OR REPLACE FUNCTION public.rpc_revenue_trace(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id                  uuid;
  v_contract_value          numeric;
  v_estimate_revenue        numeric;
  v_approved_co_total       numeric;
  v_invoice_total           numeric;
  v_snapshot_projected_rev  numeric;
  v_revenue_source          text;
BEGIN
  -- 1) Resolve project directly
  SELECT p.organization_id, COALESCE(p.contract_value, 0)
    INTO v_org_id, v_contract_value
    FROM projects p
   WHERE p.id = p_project_id
     AND p.is_deleted = false;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'project_not_found');
  END IF;

  -- 2) Estimate revenue
  SELECT COALESCE(e.contract_value, 0)
    INTO v_estimate_revenue
    FROM estimates e
   WHERE e.project_id = p_project_id
     AND e.status = 'approved'
   ORDER BY e.created_at DESC
   LIMIT 1;

  v_estimate_revenue := COALESCE(v_estimate_revenue, 0);

  -- 3) Approved change orders
  SELECT COALESCE(SUM(co.amount), 0)
    INTO v_approved_co_total
    FROM change_orders co
   WHERE co.project_id = p_project_id
     AND co.status IN ('approved', 'completed');

  -- 4) Invoice total
  SELECT COALESCE(SUM(i.total), 0)
    INTO v_invoice_total
    FROM invoices i
   WHERE i.project_id = p_project_id
     AND i.status <> 'voided';

  -- 5) Latest capture snapshot
  SELECT COALESCE(s.projected_revenue, 0)
    INTO v_snapshot_projected_rev
    FROM project_economic_snapshots s
   WHERE s.project_id = p_project_id
     AND s.org_id = v_org_id
     AND s.source = 'capture'
   ORDER BY s.snapshot_date DESC, s.id DESC
   LIMIT 1;

  v_snapshot_projected_rev := COALESCE(v_snapshot_projected_rev, 0);

  -- 6) Source determination
  v_revenue_source := CASE
    WHEN v_estimate_revenue > 0 THEN 'estimate + change_orders'
    WHEN v_contract_value > 0   THEN 'project_contract_value'
    ELSE 'none'
  END;

  RETURN jsonb_build_object(
    'success',                     true,
    'project_id',                  p_project_id,
    'contract_value',              round(v_contract_value, 2),
    'estimate_revenue',            round(v_estimate_revenue, 2),
    'approved_change_orders',      round(v_approved_co_total, 2),
    'canonical_projected_revenue', round(v_estimate_revenue + v_approved_co_total, 2),
    'invoice_total',               round(v_invoice_total, 2),
    'snapshot_projected_revenue',  round(v_snapshot_projected_rev, 2),
    'revenue_source_used',         v_revenue_source
  );
END;
$$;
