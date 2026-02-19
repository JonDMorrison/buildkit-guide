
CREATE OR REPLACE VIEW public.v_project_economic_snapshot AS
WITH estimate_rev AS (
  SELECT
    e.project_id,
    e.organization_id,
    e.contract_value AS estimate_total
  FROM public.estimates e
  WHERE e.status = 'approved'
),
co_rev AS (
  SELECT
    co.project_id,
    COALESCE(SUM(co.amount), 0) AS approved_co_total
  FROM public.change_orders co
  WHERE co.status IN ('approved', 'completed')
  GROUP BY co.project_id
),
labor AS (
  SELECT
    te.project_id,
    COALESCE(SUM(
      te.duration_hours * COALESCE(pm.cost_rate, om.hourly_cost_rate, 0)
    ), 0) AS labor_cost
  FROM public.time_entries te
  LEFT JOIN public.project_members pm
    ON pm.project_id = te.project_id AND pm.user_id = te.user_id
  LEFT JOIN public.organization_memberships om
    ON om.organization_id = te.organization_id AND om.user_id = te.user_id
  WHERE te.status IN ('approved', 'locked', 'posted')
    AND te.check_out_at IS NOT NULL
    AND te.duration_hours > 0
  GROUP BY te.project_id
)
SELECT
  p.id                                        AS project_id,
  p.organization_id                           AS org_id,
  COALESCE(er.estimate_total, 0)
    + COALESCE(cr.approved_co_total, 0)       AS projected_revenue,
  COALESCE(l.labor_cost, 0)                   AS actual_labor_cost,
  0::numeric                                  AS actual_material_cost,
  COALESCE(l.labor_cost, 0)                   AS actual_cost,
  (COALESCE(er.estimate_total, 0) + COALESCE(cr.approved_co_total, 0) - COALESCE(l.labor_cost, 0))
    / nullif(COALESCE(er.estimate_total, 0) + COALESCE(cr.approved_co_total, 0), 0)
                                              AS realized_margin_ratio,
  COALESCE(l.labor_cost, 0)
    / nullif(COALESCE(er.estimate_total, 0) + COALESCE(cr.approved_co_total, 0), 0)
                                              AS cost_to_revenue_ratio,
  COALESCE(cr.approved_co_total, 0)           AS revenue_delta_from_estimate
FROM public.projects p
LEFT JOIN estimate_rev er ON er.project_id = p.id
LEFT JOIN co_rev cr       ON cr.project_id = p.id
LEFT JOIN labor l         ON l.project_id = p.id;
