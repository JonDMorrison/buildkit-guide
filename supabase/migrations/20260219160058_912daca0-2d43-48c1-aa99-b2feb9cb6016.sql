
CREATE OR REPLACE VIEW public.v_project_labor_burn_index AS
WITH archetype_bench AS (
  SELECT
    p.archetype_id,
    snap.org_id,
    AVG(
      CASE WHEN snap.projected_revenue > 0
        THEN snap.actual_labor_cost / snap.projected_revenue
        ELSE 0
      END
    ) AS expected_labor_ratio
  FROM public.v_project_economic_snapshot snap
  JOIN public.projects p ON p.id = snap.project_id
  WHERE p.status IN ('completed', 'closed')
    AND p.archetype_id IS NOT NULL
  GROUP BY p.archetype_id, snap.org_id
)
SELECT
  snap.project_id,
  snap.org_id,
  CASE WHEN snap.projected_revenue > 0
    THEN snap.actual_labor_cost / snap.projected_revenue
    ELSE 0
  END AS labor_cost_ratio,
  CASE WHEN snap.projected_revenue > 0
    THEN (snap.actual_labor_cost / snap.projected_revenue) - COALESCE(ab.expected_labor_ratio, 0)
    ELSE 0
  END AS labor_variance_from_archetype,
  CASE WHEN snap.projected_revenue > 0
    THEN (snap.actual_labor_cost / snap.projected_revenue) - COALESCE(ab.expected_labor_ratio, 0) > 0.10
    ELSE false
  END AS labor_risk_flag
FROM public.v_project_economic_snapshot snap
JOIN public.projects p ON p.id = snap.project_id
LEFT JOIN archetype_bench ab
  ON ab.archetype_id = p.archetype_id AND ab.org_id = snap.org_id;
