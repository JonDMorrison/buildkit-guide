-- Fix v_project_economic_snapshot: align labor status filter with is_valid_time_entry()
-- The labor CTE incorrectly filtered on ('approved','locked','posted') which are NOT
-- actual time_entries.status values. The canonical status for countable entries is 'closed',
-- as defined by public.is_valid_time_entry(). The status column is plain text, not an enum.
--
-- CHANGE: labor WHERE clause only. All other CTEs and output columns unchanged.

CREATE OR REPLACE VIEW public.v_project_economic_snapshot
WITH (security_invoker = false)
AS
WITH estimate_rev AS (
    SELECT e.project_id,
           e.organization_id,
           e.contract_value AS estimate_total
    FROM estimates e
    WHERE e.status = 'approved'
),
co_rev AS (
    SELECT co.project_id,
           COALESCE(SUM(co.amount), 0::numeric) AS approved_co_total
    FROM change_orders co
    WHERE co.status IN ('approved', 'completed')
    GROUP BY co.project_id
),
labor AS (
    -- FIXED: use canonical 'closed' status matching is_valid_time_entry()
    -- Previous filter: status IN ('approved','locked','posted') — never matched any rows
    -- time_entries.status is plain text; the only value used in production is 'closed'
    SELECT te.project_id,
           COALESCE(SUM(te.duration_hours * COALESCE(pm.cost_rate, om.hourly_cost_rate, 0::numeric)), 0::numeric) AS labor_cost
    FROM time_entries te
        LEFT JOIN project_members pm ON pm.project_id = te.project_id AND pm.user_id = te.user_id
        LEFT JOIN organization_memberships om ON om.organization_id = te.organization_id AND om.user_id = te.user_id
    WHERE te.status = 'closed'
      AND te.check_out_at IS NOT NULL
      AND te.duration_hours IS NOT NULL
      AND te.duration_hours > 0
    GROUP BY te.project_id
)
SELECT p.id AS project_id,
       p.organization_id AS org_id,
       COALESCE(er.estimate_total, 0::numeric) + COALESCE(cr.approved_co_total, 0::numeric) AS projected_revenue,
       COALESCE(l.labor_cost, 0::numeric) AS actual_labor_cost,
       0::numeric AS actual_material_cost,
       COALESCE(l.labor_cost, 0::numeric) AS actual_cost,
       (COALESCE(er.estimate_total, 0::numeric) + COALESCE(cr.approved_co_total, 0::numeric) - COALESCE(l.labor_cost, 0::numeric))
         / NULLIF(COALESCE(er.estimate_total, 0::numeric) + COALESCE(cr.approved_co_total, 0::numeric), 0::numeric) AS realized_margin_ratio,
       COALESCE(l.labor_cost, 0::numeric)
         / NULLIF(COALESCE(er.estimate_total, 0::numeric) + COALESCE(cr.approved_co_total, 0::numeric), 0::numeric) AS cost_to_revenue_ratio,
       COALESCE(cr.approved_co_total, 0::numeric) AS revenue_delta_from_estimate
FROM projects p
    LEFT JOIN estimate_rev er ON er.project_id = p.id
    LEFT JOIN co_rev cr ON cr.project_id = p.id
    LEFT JOIN labor l ON l.project_id = p.id;

-- Also add is_valid_time_entry alignment comment for future maintainers
COMMENT ON VIEW public.v_project_economic_snapshot IS
  'Economic snapshot view. Labor filter aligned with is_valid_time_entry(): status=closed, check_out_at NOT NULL, duration_hours NOT NULL and > 0.';
