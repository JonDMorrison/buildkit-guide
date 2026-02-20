
-- ═══════════════════════════════════════════════════════════════════════════
-- rpc_debug_margin_control_inputs  (v3: Economic Input Verification)
--
-- Purpose: Expose the EXACT raw inputs consumed by
--          rpc_generate_project_margin_control, structured into canonical
--          sections required by the Economic Input Verification phase.
--
-- Sections returned:
--   revenue_inputs           — projected_revenue / contract_value path
--   labor_actual_inputs      — time_entries aggregation detail
--   estimate_inputs          — estimate_line_items aggregation
--   cost_aggregation_trace   — what the engine actually uses
--   derived_intermediates    — numerators/denominators before division
--   validation_flags         — boolean guards on data presence/zero-division
--
-- Constraints:
--   SECURITY DEFINER
--   SET search_path = public, pg_temp
--   No dynamic SQL
--   No schema changes
--   No RLS weakening
--   Deterministic ORDER BY everywhere
--   No time-based heuristics
--   No silent COALESCE on counts/nulls in validation section
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_debug_margin_control_inputs(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id      uuid;
  v_user_id     uuid;
  v_is_member   boolean;

  -- ── Snapshot scalars (what the engine reads from v_project_economic_snapshot)
  v_snap_found                boolean := false;
  v_projected_revenue         numeric; -- intentionally nullable to detect missing
  v_realized_margin_ratio     numeric;
  v_actual_labor_cost_snap    numeric;
  v_actual_material_cost_snap numeric;
  v_actual_cost_snap          numeric;
  v_cost_to_revenue_ratio     numeric;

  -- ── Labor burn index scalars (v_project_labor_burn_index)
  v_burn_found                boolean := false;
  v_labor_cost_ratio          numeric; -- nullable
  v_labor_risk_flag           boolean;
  -- numerator/denominator from burn view (re-derived here for traceability)
  v_burn_numerator            numeric;
  v_burn_denominator          numeric;

  -- ── Margin projection scalars (v_project_margin_projection)
  v_proj_found                            boolean := false;
  v_projected_margin_at_completion_ratio  numeric; -- nullable
  v_margin_declining_flag                 boolean;
  -- numerator/denominator re-derived
  v_margin_proj_numerator    numeric;
  v_margin_proj_denominator  numeric;

  -- ── Estimate resolution
  v_estimate_id         uuid;
  v_estimate_status     text;
  v_estimate_row_count  int := 0;
  v_est_total           numeric := 0;
  v_est_labor           numeric := 0;
  v_est_material        numeric := 0;
  v_est_other           numeric := 0;
  v_est_machine         numeric := 0;

  -- ── Labor actuals from time_entries
  v_labor_row_count     int     := 0;
  v_total_labor_hours   numeric := 0;
  v_total_labor_cost    numeric := 0;
  v_min_cost_row_id     uuid;
  v_max_cost_row_id     uuid;
  v_has_timesheet_rate  boolean := false;
  v_has_trade_rate      boolean := false;
  v_has_missing_rate    boolean := false;
  v_rate_resolution_mode text;

  -- ── Validation flags
  v_labor_missing               boolean;
  v_estimate_missing            boolean;
  v_revenue_missing             boolean;
  v_zero_denominator_detected   boolean;

BEGIN
  -- ── 1. Auth
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 2. Resolve org
  SELECT organization_id INTO v_org_id
  FROM public.projects
  WHERE id = p_project_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'project_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- ── 3. Membership check
  SELECT public.rpc_is_org_member(v_org_id) INTO v_is_member;
  IF NOT COALESCE(v_is_member, false) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 4. Economic snapshot (exactly what the engine reads in block 3a)
  SELECT
    s.projected_revenue,
    s.realized_margin_ratio,
    s.actual_labor_cost,
    s.actual_material_cost,
    s.actual_cost,
    s.cost_to_revenue_ratio
  INTO
    v_projected_revenue,
    v_realized_margin_ratio,
    v_actual_labor_cost_snap,
    v_actual_material_cost_snap,
    v_actual_cost_snap,
    v_cost_to_revenue_ratio
  FROM public.v_project_economic_snapshot s
  WHERE s.project_id = p_project_id;

  IF FOUND THEN
    v_snap_found := true;
  END IF;

  -- ── 5. Labor burn index (block 3c in engine)
  SELECT
    b.labor_cost_ratio,
    b.labor_risk_flag
  INTO
    v_labor_cost_ratio,
    v_labor_risk_flag
  FROM public.v_project_labor_burn_index b
  WHERE b.project_id = p_project_id;

  IF FOUND THEN
    v_burn_found := true;
    -- Re-derive numerator/denominator so UI can trace the ratio
    -- numerator = actual_labor_cost (from snapshot), denominator = projected_labor_cost (from snapshot)
    -- The burn view computes: actual_labor_cost / planned_labor_bill_amount
    -- We expose what we can trace without re-reading the view internals
    v_burn_numerator   := COALESCE(v_actual_labor_cost_snap, 0);
    v_burn_denominator := CASE
      WHEN COALESCE(v_labor_cost_ratio, 0) <> 0
      THEN ROUND(COALESCE(v_actual_labor_cost_snap, 0) / v_labor_cost_ratio, 2)
      ELSE NULL
    END;
  END IF;

  -- ── 6. Margin projection (block 3d in engine)
  SELECT
    mp.projected_margin_at_completion_ratio,
    mp.margin_declining_flag
  INTO
    v_projected_margin_at_completion_ratio,
    v_margin_declining_flag
  FROM public.v_project_margin_projection mp
  WHERE mp.project_id = p_project_id;

  IF FOUND THEN
    v_proj_found := true;
    -- Re-derive margin intermediates
    -- projected_margin_at_completion_ratio = (revenue - projected_total_cost) / revenue
    -- numerator = projected_revenue * ratio, denominator = projected_revenue
    v_margin_proj_numerator   := ROUND(
      COALESCE(v_projected_revenue, 0) * COALESCE(v_projected_margin_at_completion_ratio, 0),
      2
    );
    v_margin_proj_denominator := COALESCE(v_projected_revenue, 0);
  END IF;

  -- ── 7. Estimate resolution (same deterministic tie-break as engine)
  SELECT id, status
  INTO v_estimate_id, v_estimate_status
  FROM public.estimates
  WHERE project_id = p_project_id
  ORDER BY
    CASE WHEN status = 'approved' THEN 0 ELSE 1 END,
    id ASC
  LIMIT 1;

  -- ── 8. Estimate line item aggregation
  IF v_estimate_id IS NOT NULL THEN
    SELECT
      COUNT(*)::int,
      COALESCE(SUM(amount), 0),
      COALESCE(SUM(CASE WHEN item_type = 'labor'    THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN item_type = 'material' THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN item_type = 'machine'  THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN item_type NOT IN ('labor','material','machine') THEN amount ELSE 0 END), 0)
    INTO
      v_estimate_row_count,
      v_est_total,
      v_est_labor,
      v_est_material,
      v_est_machine,
      v_est_other
    FROM public.estimate_line_items
    WHERE estimate_id = v_estimate_id;
  END IF;

  -- ── 9. Labor actual aggregation with rate-resolution tracing
  --      Mirrors the engine's tiered fallback:
  --        project_members.cost_rate → organization_memberships.hourly_cost_rate → 0
  SELECT
    COUNT(*)::int,
    COALESCE(SUM(te.duration_hours), 0),
    COALESCE(SUM(
      te.duration_hours * COALESCE(pm.cost_rate, om.hourly_cost_rate, 0)
    ), 0),
    -- min/max row ids for traceability (deterministic: order by id ASC)
    (SELECT id FROM public.time_entries
      WHERE project_id = p_project_id
        AND check_out_at IS NOT NULL
        AND duration_hours > 0
      ORDER BY duration_hours * COALESCE(
        (SELECT cost_rate FROM public.project_members
          WHERE project_id = p_project_id AND user_id = te2.user_id LIMIT 1),
        (SELECT hourly_cost_rate FROM public.organization_memberships
          WHERE organization_id = v_org_id AND user_id = te2.user_id LIMIT 1),
        0
      ) ASC, id ASC LIMIT 1
    ),
    (SELECT id FROM public.time_entries te2
      WHERE project_id = p_project_id
        AND check_out_at IS NOT NULL
        AND duration_hours > 0
      ORDER BY duration_hours * COALESCE(
        (SELECT cost_rate FROM public.project_members
          WHERE project_id = p_project_id AND user_id = te2.user_id LIMIT 1),
        (SELECT hourly_cost_rate FROM public.organization_memberships
          WHERE organization_id = v_org_id AND user_id = te2.user_id LIMIT 1),
        0
      ) DESC, id DESC LIMIT 1
    ),
    -- rate resolution mode flags
    bool_or(pm.cost_rate IS NOT NULL),
    bool_or(pm.cost_rate IS NULL AND om.hourly_cost_rate IS NOT NULL),
    bool_or(pm.cost_rate IS NULL AND om.hourly_cost_rate IS NULL)
  INTO
    v_labor_row_count,
    v_total_labor_hours,
    v_total_labor_cost,
    v_min_cost_row_id,
    v_max_cost_row_id,
    v_has_timesheet_rate,
    v_has_trade_rate,
    v_has_missing_rate
  FROM public.time_entries te
  LEFT JOIN public.project_members pm
    ON pm.project_id = te.project_id AND pm.user_id = te.user_id
  LEFT JOIN public.organization_memberships om
    ON om.organization_id = v_org_id AND om.user_id = te.user_id
  WHERE te.project_id = p_project_id
    AND te.check_out_at IS NOT NULL
    AND te.duration_hours > 0;

  -- ── 10. Rate resolution mode — most specific mode wins
  v_rate_resolution_mode :=
    CASE
      WHEN v_labor_row_count = 0 THEN 'no_rows'
      WHEN v_has_timesheet_rate IS TRUE AND v_has_trade_rate IS FALSE
            AND v_has_missing_rate IS FALSE THEN 'timesheet_rate'
      WHEN v_has_timesheet_rate IS FALSE AND v_has_trade_rate IS TRUE
            AND v_has_missing_rate IS FALSE THEN 'trade_rate_table'
      WHEN v_has_missing_rate IS TRUE AND v_has_timesheet_rate IS FALSE
            AND v_has_trade_rate IS FALSE THEN 'missing_rate'
      ELSE 'mixed'
    END;

  -- ── 11. Validation flags (no silent COALESCE — explicit null exposure)
  v_labor_missing             := (v_labor_row_count = 0);
  v_estimate_missing          := (v_estimate_id IS NULL);
  v_revenue_missing           := (v_projected_revenue IS NULL OR v_projected_revenue = 0);
  v_zero_denominator_detected := (
    COALESCE(v_projected_revenue, 0) = 0
    OR (v_labor_cost_ratio IS NOT NULL AND v_burn_denominator IS NULL)
  );

  -- ── 12. Return full structured payload
  RETURN jsonb_build_object(

    -- ── Section A: Revenue Inputs
    'revenue_inputs', jsonb_build_object(
      'projected_revenue',     v_projected_revenue,          -- raw nullable
      'contract_value',        v_projected_revenue,          -- alias: engine reads projected_revenue as contract_value
      'revenue_source',        'v_project_economic_snapshot.projected_revenue',
      'revenue_rows_count',    CASE WHEN v_snap_found THEN 1 ELSE 0 END,
      'snapshot_row_present',  v_snap_found
    ),

    -- ── Section B: Labor Actual Inputs
    'labor_actual_inputs', jsonb_build_object(
      'total_labor_hours',            ROUND(COALESCE(v_total_labor_hours, 0)::numeric, 4),
      'total_labor_cost',             ROUND(COALESCE(v_total_labor_cost,  0)::numeric, 2),
      'labor_row_count',              v_labor_row_count,
      'labor_rate_resolution_mode',   v_rate_resolution_mode,
      'has_timesheet_rate_rows',      COALESCE(v_has_timesheet_rate, false),
      'has_trade_rate_rows',          COALESCE(v_has_trade_rate, false),
      'has_missing_rate_rows',        COALESCE(v_has_missing_rate, false),
      'min_cost_row_id',              v_min_cost_row_id,
      'max_cost_row_id',              v_max_cost_row_id,
      'rate_fallback_chain',          'project_members.cost_rate → organization_memberships.hourly_cost_rate → 0'
    ),

    -- ── Section C: Estimate Inputs
    'estimate_inputs', jsonb_build_object(
      'estimate_id',            v_estimate_id,
      'estimate_status',        v_estimate_status,
      'estimate_row_count',     v_estimate_row_count,
      'estimate_source_table',  CASE WHEN v_estimate_id IS NOT NULL THEN 'estimate_line_items' ELSE 'no_estimate_found' END,
      'estimated_labor_cost',   ROUND(v_est_labor,    2),
      'estimated_material_cost',ROUND(v_est_material, 2),
      'estimated_machine_cost', ROUND(v_est_machine,  2),
      'estimated_other_cost',   ROUND(v_est_other,    2),
      'estimated_total_cost',   ROUND(v_est_total,    2),
      'selection_tiebreak',     'approved status first, then id ASC'
    ),

    -- ── Section D: Cost Aggregation Trace
    'cost_aggregation_trace', jsonb_build_object(
      'actual_total_cost_used_by_engine',     ROUND(COALESCE(v_actual_cost_snap, 0)::numeric, 2),
      'actual_labor_cost_used_by_engine',     ROUND(COALESCE(v_actual_labor_cost_snap, 0)::numeric, 2),
      'actual_material_cost_used_by_engine',  ROUND(COALESCE(v_actual_material_cost_snap, 0)::numeric, 2),
      'projected_total_cost_used_by_engine',  ROUND(COALESCE(v_est_total, 0)::numeric, 2),
      'cost_source_for_actuals',              'v_project_economic_snapshot (actual_cost, actual_labor_cost, actual_material_cost)',
      'cost_source_for_projections',          'estimate_line_items SUM(amount)',
      'cost_bucket_breakdown', jsonb_build_object(
        'labor',    ROUND(COALESCE(v_actual_labor_cost_snap, 0)::numeric, 2),
        'material', ROUND(COALESCE(v_actual_material_cost_snap, 0)::numeric, 2),
        'machine',  0,
        'other',    0,
        'unclassified', ROUND(
          GREATEST(
            COALESCE(v_actual_cost_snap, 0) - COALESCE(v_actual_labor_cost_snap, 0) - COALESCE(v_actual_material_cost_snap, 0),
            0
          )::numeric, 2)
      ),
      'coalesce_applied', jsonb_build_object(
        'projected_revenue_defaulted_to_zero',  (v_projected_revenue IS NULL),
        'actual_cost_defaulted_to_zero',        (v_actual_cost_snap IS NULL),
        'labor_cost_ratio_defaulted_to_zero',   (v_labor_cost_ratio IS NULL),
        'margin_ratio_defaulted_to_zero',       (v_projected_margin_at_completion_ratio IS NULL)
      )
    ),

    -- ── Section E: Derived Intermediates
    'derived_intermediates', jsonb_build_object(
      -- Labor burn ratio: actual_labor_cost / planned_labor_bill_amount
      'computed_labor_burn_ratio_numerator',   v_burn_numerator,
      'computed_labor_burn_ratio_denominator', v_burn_denominator,
      'labor_burn_ratio_from_view',            v_labor_cost_ratio,
      'labor_burn_view_present',               v_burn_found,
      -- Projected margin: (revenue - projected_cost) / revenue
      'computed_projected_margin_numerator',   v_margin_proj_numerator,
      'computed_projected_margin_denominator', v_margin_proj_denominator,
      'projected_margin_ratio_from_view',      v_projected_margin_at_completion_ratio,
      'margin_projection_view_present',        v_proj_found,
      -- Realized margin from snapshot
      'realized_margin_ratio_from_snapshot',   v_realized_margin_ratio,
      'cost_to_revenue_ratio_from_snapshot',   v_cost_to_revenue_ratio,
      -- Margin declining flag (drives +30 risk)
      'margin_declining_flag',                 v_margin_declining_flag,
      -- Labor risk flag (drives +25 risk)
      'labor_risk_flag',                       v_labor_risk_flag
    ),

    -- ── Section F: Validation Flags
    'validation_flags', jsonb_build_object(
      'labor_missing',              v_labor_missing,
      'estimate_missing',           v_estimate_missing,
      'revenue_missing',            v_revenue_missing,
      'zero_denominator_detected',  v_zero_denominator_detected
    ),

    -- ── Meta
    'meta', jsonb_build_object(
      'project_id',           p_project_id,
      'org_id',               v_org_id,
      'diagnostic_version',   'v3',
      'sources', jsonb_build_object(
        'snapshot',   'v_project_economic_snapshot',
        'burn_index', 'v_project_labor_burn_index',
        'margin_proj','v_project_margin_projection',
        'estimates',  'estimates + estimate_line_items',
        'labor_cost', 'time_entries × tiered cost rate fallback'
      )
    )

  );

EXCEPTION
  WHEN SQLSTATE '42501' THEN RAISE;
  WHEN SQLSTATE 'P0002' THEN RAISE;
  WHEN OTHERS THEN
    RAISE;  -- diagnostic RPC: always surface errors, never swallow them
END;
$$;

-- ── Grants
REVOKE ALL ON FUNCTION public.rpc_debug_margin_control_inputs(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_debug_margin_control_inputs(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_debug_margin_control_inputs(uuid) TO authenticated;

COMMENT ON FUNCTION public.rpc_debug_margin_control_inputs(uuid) IS
  'Economic Input Verification v3. STABLE SECURITY DEFINER. search_path pinned. '
  'Exposes raw inputs for rpc_generate_project_margin_control in six structured sections: '
  'revenue_inputs, labor_actual_inputs, estimate_inputs, cost_aggregation_trace, '
  'derived_intermediates, validation_flags. No dynamic SQL. Deterministic. '
  'Errors are always surfaced (never swallowed).';
