
CREATE OR REPLACE VIEW public.v_org_margin_performance AS
SELECT
  snap.org_id,
  COUNT(*)::int                                          AS completed_projects_count,
  AVG(snap.realized_margin_ratio)                        AS historical_avg_margin_ratio,
  COALESCE(STDDEV_SAMP(snap.realized_margin_ratio), 0)   AS historical_margin_stddev,
  AVG(snap.realized_margin_ratio)
    - COALESCE(STDDEV_SAMP(snap.realized_margin_ratio), 0) AS historical_margin_low_band,
  AVG(snap.realized_margin_ratio)
    + COALESCE(STDDEV_SAMP(snap.realized_margin_ratio), 0) AS historical_margin_high_band
FROM public.v_project_economic_snapshot snap
JOIN public.projects p ON p.id = snap.project_id
WHERE p.status IN ('completed', 'closed')
GROUP BY snap.org_id;
