
CREATE OR REPLACE VIEW public.v_project_margin_projection AS
SELECT
  snap.project_id,
  snap.org_id,
  snap.realized_margin_ratio                          AS projected_margin_at_completion_ratio,
  snap.projected_revenue - snap.actual_cost           AS margin_break_point_ratio,
  COALESCE(
    snap.realized_margin_ratio < omp.historical_avg_margin_ratio,
    false
  )                                                   AS margin_declining_flag
FROM public.v_project_economic_snapshot snap
LEFT JOIN public.v_org_margin_performance omp
  ON omp.org_id = snap.org_id;
