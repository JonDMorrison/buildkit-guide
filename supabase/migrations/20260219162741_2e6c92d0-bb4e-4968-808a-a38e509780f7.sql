
CREATE OR REPLACE VIEW public.v_project_margin_projection AS
SELECT
  snap.project_id,
  snap.org_id,
  COALESCE(snap.realized_margin_ratio, 0)               AS projected_margin_at_completion_ratio,
  COALESCE(snap.projected_revenue, 0) - COALESCE(snap.actual_cost, 0)
                                                         AS margin_break_point_ratio,
  COALESCE(
    snap.realized_margin_ratio < COALESCE(omp.historical_avg_margin_ratio, snap.realized_margin_ratio),
    false
  )                                                      AS margin_declining_flag
FROM public.v_project_economic_snapshot snap
LEFT JOIN public.v_org_margin_performance omp
  ON omp.org_id = snap.org_id;
