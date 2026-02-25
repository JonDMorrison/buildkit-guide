
CREATE FUNCTION public.rpc_revenue_trace_v2(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id                    uuid;
  v_contract_value_project    numeric;
  v_contract_value_estimate   numeric;
  v_snapshot_projected_rev    numeric;
  v_invoice_total             numeric;
  v_revenue_source            text;
BEGIN
  SELECT p.organization_id, p.contract_value
    INTO v_org_id, v_contract_value_project
    FROM projects p
   WHERE p.id = p_project_id
     AND p.is_deleted = false;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'success',    false,
      'project_id', p_project_id,
      'reason',     'project_not_found'
    );
  END IF;

  SELECT e.contract_value
    INTO v_contract_value_estimate
    FROM estimates e
   WHERE e.project_id = p_project_id
     AND e.status = 'approved'
   ORDER BY e.approved_at DESC NULLS LAST, e.id ASC
   LIMIT 1;

  SELECT s.projected_revenue
    INTO v_snapshot_projected_rev
    FROM project_economic_snapshots s
   WHERE s.project_id = p_project_id
     AND s.org_id = v_org_id
     AND s.source = 'capture'
   ORDER BY s.snapshot_date DESC, s.id ASC
   LIMIT 1;

  SELECT SUM(i.total)
    INTO v_invoice_total
    FROM invoices i
   WHERE i.project_id = p_project_id
     AND i.status <> 'voided';

  v_revenue_source := CASE
    WHEN v_snapshot_projected_rev IS NOT NULL THEN 'snapshot.projected_revenue'
    WHEN v_contract_value_estimate IS NOT NULL THEN 'estimate.contract_value'
    WHEN v_contract_value_project IS NOT NULL THEN 'projects.contract_value'
    WHEN v_invoice_total IS NOT NULL THEN 'invoices.total'
    ELSE 'missing'
  END;

  RETURN jsonb_build_object(
    'success',                         true,
    'project_id',                      p_project_id,
    'org_id',                          v_org_id,
    'contract_value_from_project',     v_contract_value_project,
    'contract_value_from_estimate',    v_contract_value_estimate,
    'projected_revenue_from_snapshot', v_snapshot_projected_rev,
    'invoice_total',                   v_invoice_total,
    'revenue_source_used_by_engine',   v_revenue_source
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_revenue_trace_v2(uuid) IS
  'Read-only revenue provenance trace v2. STABLE SECURITY DEFINER, deterministic, no RPC dependencies. Nulls preserved.';
