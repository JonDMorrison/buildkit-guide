
CREATE OR REPLACE FUNCTION public.rpc_revenue_trace(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id                    uuid;
  v_contract_value_project    numeric;
  v_project_name              text;
  v_project_status            text;

  v_estimate_id               uuid;
  v_contract_value_estimate   numeric;
  v_estimate_number           text;
  v_estimate_status           text;
  v_estimate_approved_at      timestamptz;

  v_snapshot_id               uuid;
  v_snapshot_projected_rev    numeric;
  v_snapshot_date             date;
  v_snapshot_risk_score       numeric;
  v_snapshot_source           text;

  v_invoice_total             numeric;

  v_revenue_source            text;
BEGIN
  -- 1) Verify project exists
  SELECT p.organization_id, p.contract_value, p.name, p.status
    INTO v_org_id, v_contract_value_project, v_project_name, v_project_status
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

  -- 2) Latest approved estimate
  SELECT e.id, e.contract_value, e.estimate_number, e.status, e.approved_at
    INTO v_estimate_id, v_contract_value_estimate, v_estimate_number, v_estimate_status, v_estimate_approved_at
    FROM estimates e
   WHERE e.project_id = p_project_id
     AND e.status = 'approved'
   ORDER BY e.approved_at DESC NULLS LAST, e.id ASC
   LIMIT 1;

  -- 3) Latest capture snapshot
  SELECT s.id, s.projected_revenue, s.snapshot_date, s.risk_score, s.source
    INTO v_snapshot_id, v_snapshot_projected_rev, v_snapshot_date, v_snapshot_risk_score, v_snapshot_source
    FROM project_economic_snapshots s
   WHERE s.project_id = p_project_id
     AND s.org_id = v_org_id
     AND s.source = 'capture'
   ORDER BY s.snapshot_date DESC, s.id ASC
   LIMIT 1;

  -- 4) Invoice total
  SELECT SUM(i.total)
    INTO v_invoice_total
    FROM invoices i
   WHERE i.project_id = p_project_id
     AND i.status <> 'voided';

  -- 5) Determine revenue source
  v_revenue_source := CASE
    WHEN v_snapshot_projected_rev IS NOT NULL THEN 'snapshot.projected_revenue'
    WHEN v_contract_value_estimate IS NOT NULL THEN 'estimate.contract_value'
    WHEN v_contract_value_project IS NOT NULL THEN 'projects.contract_value'
    WHEN v_invoice_total IS NOT NULL THEN 'invoices.total'
    ELSE 'missing'
  END;

  -- 6) Return
  RETURN jsonb_build_object(
    'success',                        true,
    'project_id',                     p_project_id,
    'org_id',                         v_org_id,
    'contract_value_from_project',    v_contract_value_project,
    'contract_value_from_estimate',   v_contract_value_estimate,
    'projected_revenue_from_snapshot', v_snapshot_projected_rev,
    'invoice_total',                  v_invoice_total,
    'revenue_source_used_by_engine',  v_revenue_source,
    'raw', jsonb_build_object(
      'project_row', CASE WHEN v_org_id IS NOT NULL THEN jsonb_build_object(
        'id',             p_project_id,
        'name',           v_project_name,
        'status',         v_project_status,
        'contract_value', v_contract_value_project
      ) ELSE NULL END,
      'estimate_row', CASE WHEN v_estimate_id IS NOT NULL THEN jsonb_build_object(
        'id',              v_estimate_id,
        'estimate_number', v_estimate_number,
        'status',          v_estimate_status,
        'contract_value',  v_contract_value_estimate,
        'approved_at',     v_estimate_approved_at
      ) ELSE NULL END,
      'snapshot_row', CASE WHEN v_snapshot_id IS NOT NULL THEN jsonb_build_object(
        'id',                 v_snapshot_id,
        'snapshot_date',      v_snapshot_date,
        'projected_revenue',  v_snapshot_projected_rev,
        'risk_score',         v_snapshot_risk_score,
        'source',             v_snapshot_source
      ) ELSE NULL END
    )
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_revenue_trace(uuid) IS
  'Read-only diagnostic: traces projected_revenue provenance for a project. STABLE SECURITY DEFINER, deterministic. No RPC dependencies.';
