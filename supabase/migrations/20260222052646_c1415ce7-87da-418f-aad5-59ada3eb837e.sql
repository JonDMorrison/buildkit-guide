
-- Reconcile status divergence: snapshot labor CTE now calls is_valid_time_entry()
-- so there is exactly ONE canonical definition of valid labor.

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
    -- CANONICAL: delegates to is_valid_time_entry() — single source of truth
    SELECT te.project_id,
           COALESCE(SUM(te.duration_hours * COALESCE(pm.cost_rate, om.hourly_cost_rate, 0::numeric)), 0::numeric) AS labor_cost
    FROM time_entries te
        LEFT JOIN project_members pm ON pm.project_id = te.project_id AND pm.user_id = te.user_id
        LEFT JOIN organization_memberships om ON om.organization_id = te.organization_id AND om.user_id = te.user_id
    WHERE public.is_valid_time_entry(te.*) = true
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

COMMENT ON VIEW public.v_project_economic_snapshot IS
  'Economic snapshot view. Labor filter delegates to is_valid_time_entry() — single canonical definition of valid labor.';
