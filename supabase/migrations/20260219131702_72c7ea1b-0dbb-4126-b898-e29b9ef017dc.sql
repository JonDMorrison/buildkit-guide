
-- =============================================================
-- rpc_get_project_cost_rollup
-- Canonical read-only RPC: actuals + billed + outstanding flags
-- SECURITY DEFINER, org-scoped via has_project_access
-- =============================================================

CREATE OR REPLACE FUNCTION public.rpc_get_project_cost_rollup(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project record;
  v_labor record;
  v_materials numeric := 0;
  v_machine numeric := 0;
  v_other numeric := 0;
  v_unclassified numeric := 0;
  v_total_receipt_count int := 0;
  v_reviewed_receipt_count int := 0;
  v_invoiced numeric := 0;
  v_paid numeric := 0;
  v_result jsonb;
  v_flags jsonb;
  v_score numeric;
BEGIN
  -- ── Auth & access check ──
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT has_project_access(p_project_id, ARRAY['admin','pm','worker','accounting']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- ── Load project ──
  SELECT id, organization_id, currency
    INTO v_project
    FROM projects
   WHERE id = p_project_id AND is_deleted = false;

  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501';
  END IF;

  -- ── Labor actuals ──
  -- Uses tiered rate: project_members.cost_rate → organization_memberships.hourly_cost_rate
  -- Applies Time Entry Inclusion Contract: status='closed', check_out_at IS NOT NULL, duration_hours > 0
  -- Excludes: missing rate OR currency mismatch
  SELECT
    COALESCE(SUM(
      CASE
        WHEN pm.cost_rate IS NOT NULL AND pm.cost_rate > 0 THEN te.duration_hours
        WHEN om.hourly_cost_rate IS NOT NULL AND om.hourly_cost_rate > 0 THEN te.duration_hours
        ELSE 0
      END
    ), 0) AS rated_hours,
    COALESCE(SUM(
      CASE
        WHEN pm.cost_rate IS NOT NULL AND pm.cost_rate > 0
          THEN ROUND((te.duration_hours * pm.cost_rate)::numeric, 2)
        WHEN om.hourly_cost_rate IS NOT NULL AND om.hourly_cost_rate > 0
          THEN ROUND((te.duration_hours * om.hourly_cost_rate)::numeric, 2)
        ELSE 0
      END
    ), 0) AS rated_cost,
    COALESCE(SUM(te.duration_hours), 0) AS total_hours,
    COUNT(*)::int AS total_entries,
    -- Unrated: no rate at either tier
    COALESCE(SUM(
      CASE
        WHEN (pm.cost_rate IS NULL OR pm.cost_rate = 0)
         AND (om.hourly_cost_rate IS NULL OR om.hourly_cost_rate = 0)
          THEN te.duration_hours
        ELSE 0
      END
    ), 0) AS unrated_hours,
    COUNT(*) FILTER (
      WHERE (pm.cost_rate IS NULL OR pm.cost_rate = 0)
        AND (om.hourly_cost_rate IS NULL OR om.hourly_cost_rate = 0)
    )::int AS unrated_entries,
    -- Currency mismatch: rate exists but org membership rates_currency != project currency
    COALESCE(SUM(
      CASE
        WHEN (pm.cost_rate IS NOT NULL AND pm.cost_rate > 0) THEN 0  -- project_members has no separate currency; assumed project currency
        WHEN (om.hourly_cost_rate IS NOT NULL AND om.hourly_cost_rate > 0)
         AND om.rates_currency != v_project.currency
          THEN te.duration_hours
        ELSE 0
      END
    ), 0) AS mismatch_hours,
    COUNT(*) FILTER (
      WHERE (pm.cost_rate IS NULL OR pm.cost_rate = 0)
        AND (om.hourly_cost_rate IS NOT NULL AND om.hourly_cost_rate > 0)
        AND om.rates_currency != v_project.currency
    )::int AS mismatch_entries
  INTO v_labor
  FROM time_entries te
  LEFT JOIN project_members pm
    ON pm.project_id = te.project_id AND pm.user_id = te.user_id
  LEFT JOIN organization_memberships om
    ON om.organization_id = v_project.organization_id AND om.user_id = te.user_id AND om.is_active = true
  WHERE te.project_id = p_project_id
    AND te.status = 'closed'
    AND te.check_out_at IS NOT NULL
    AND te.duration_hours IS NOT NULL
    AND te.duration_hours > 0;

  -- ── Receipt actuals (reviewed/processed only, by cost_type) ──
  SELECT
    COALESCE(SUM(CASE WHEN r.cost_type = 'material' THEN COALESCE(r.amount, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type = 'machine'  THEN COALESCE(r.amount, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type = 'other'    THEN COALESCE(r.amount, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type NOT IN ('material','machine','other') THEN COALESCE(r.amount, 0) ELSE 0 END), 0)
  INTO v_materials, v_machine, v_other, v_unclassified
  FROM receipts r
  WHERE r.project_id = p_project_id
    AND r.review_status IN ('reviewed', 'processed')
    AND r.currency = v_project.currency;

  -- Receipt completeness counts
  SELECT COUNT(*)::int, COUNT(*) FILTER (WHERE review_status IN ('reviewed','processed'))::int
    INTO v_total_receipt_count, v_reviewed_receipt_count
    FROM receipts
   WHERE project_id = p_project_id;

  -- ── Invoicing totals ──
  -- Canonical statuses for "invoiced": sent, paid, overdue (exclude draft, void)
  SELECT
    COALESCE(SUM(total), 0),
    COALESCE(SUM(amount_paid), 0)
  INTO v_invoiced, v_paid
  FROM invoices
  WHERE project_id = p_project_id
    AND organization_id = v_project.organization_id
    AND status IN ('sent', 'paid', 'overdue');

  -- ── Flags ──
  v_flags := jsonb_build_object(
    'missing_rates', (v_labor.unrated_entries > 0),
    'currency_mismatch', (v_labor.mismatch_entries > 0),
    'missing_receipts', (v_total_receipt_count > 0 AND v_reviewed_receipt_count < v_total_receipt_count)
  );

  -- ── Data completeness score (0–100) ──
  -- Deductions: missing rates (-30 max), currency mismatch (-20 max), unreviewed receipts (-20 max), no invoices (-10)
  v_score := 100;

  IF v_labor.total_entries > 0 THEN
    v_score := v_score - LEAST(30, ROUND(30.0 * v_labor.unrated_entries / v_labor.total_entries));
    v_score := v_score - LEAST(20, ROUND(20.0 * v_labor.mismatch_entries / v_labor.total_entries));
  END IF;

  IF v_total_receipt_count > 0 THEN
    v_score := v_score - LEAST(20, ROUND(20.0 * (v_total_receipt_count - v_reviewed_receipt_count) / v_total_receipt_count));
  END IF;

  IF v_invoiced = 0 THEN
    v_score := v_score - 10;
  END IF;

  v_score := GREATEST(0, v_score);

  -- ── Build result ──
  v_result := jsonb_build_object(
    'project_id', p_project_id,
    'currency', v_project.currency,
    'actual_labor_hours', ROUND(v_labor.rated_hours::numeric, 2),
    'actual_labor_cost', ROUND(v_labor.rated_cost::numeric, 2),
    'actual_material_cost', ROUND(v_materials::numeric, 2),
    'actual_machine_cost', ROUND(v_machine::numeric, 2),
    'actual_other_cost', ROUND(v_other::numeric, 2),
    'actual_total_cost', ROUND((v_labor.rated_cost + v_materials + v_machine + v_other)::numeric, 2),
    'unrated_labor_hours', ROUND(v_labor.unrated_hours::numeric, 2),
    'unrated_labor_entries_count', v_labor.unrated_entries,
    'currency_mismatch_hours', ROUND(v_labor.mismatch_hours::numeric, 2),
    'currency_mismatch_count', v_labor.mismatch_entries,
    'invoiced_total', ROUND(v_invoiced::numeric, 2),
    'paid_total', ROUND(v_paid::numeric, 2),
    'outstanding_total', ROUND((v_invoiced - v_paid)::numeric, 2),
    'data_completeness_score', v_score,
    'flags', v_flags
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.rpc_get_project_cost_rollup(uuid) TO authenticated;
