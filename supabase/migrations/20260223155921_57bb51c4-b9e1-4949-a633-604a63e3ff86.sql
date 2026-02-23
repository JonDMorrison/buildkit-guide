
-- =============================================================
-- MODULE: EXECUTIVE REPORT V1
-- RPC: public.rpc_generate_executive_report(p_org_id uuid)
-- =============================================================

CREATE OR REPLACE FUNCTION public.rpc_generate_executive_report(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_volatility_result jsonb;
  v_volatility_ok     boolean := true;
  v_volatility_err    text;
  v_result            jsonb;
BEGIN
  -- ═══════════════════════════════════════════════════════════
  -- 1. MEMBERSHIP GUARD
  -- ═══════════════════════════════════════════════════════════
  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_authorized'
      USING ERRCODE = '42501';
  END IF;

  -- ═══════════════════════════════════════════════════════════
  -- 2. FETCH VOLATILITY (graceful degradation)
  -- ═══════════════════════════════════════════════════════════
  BEGIN
    v_volatility_result := public.rpc_get_project_volatility_index(p_org_id, 30);
  EXCEPTION WHEN OTHERS THEN
    v_volatility_ok  := false;
    v_volatility_err := SQLERRM;
    v_volatility_result := '{"projects":[]}'::jsonb;
  END;

  -- ═══════════════════════════════════════════════════════════
  -- 3. ASSEMBLE REPORT via CTE pipeline
  -- ═══════════════════════════════════════════════════════════
  WITH
  -- 3a. Latest snapshot per project (deterministic tie-break)
  latest_snap AS (
    SELECT DISTINCT ON (s.project_id)
      s.project_id,
      s.snapshot_date,
      s.risk_score,
      s.economic_position,
      s.projected_margin,
      s.realized_margin,
      s.contract_value,
      s.projected_revenue,
      s.flags
    FROM project_economic_snapshots s
    WHERE s.org_id = p_org_id
    ORDER BY s.project_id ASC, s.snapshot_date DESC, s.id ASC
  ),

  -- 3b. High-risk projects (risk_score >= 60)
  high_risk AS (
    SELECT
      ls.project_id,
      ls.risk_score,
      ls.economic_position,
      ls.projected_margin,
      ls.realized_margin,
      ls.projected_revenue,
      ls.contract_value,
      ls.snapshot_date,
      ls.flags
    FROM latest_snap ls
    WHERE ls.risk_score >= 60
  ),

  -- 3c. Improving projects: risk decreased across last 3 snapshots
  --     i.e. snap[n-2].risk > snap[n-1].risk > snap[n].risk
  last_three AS (
    SELECT
      s.project_id,
      s.risk_score,
      s.snapshot_date,
      ROW_NUMBER() OVER (
        PARTITION BY s.project_id
        ORDER BY s.snapshot_date DESC, s.id ASC
      ) AS rn
    FROM project_economic_snapshots s
    WHERE s.org_id = p_org_id
  ),
  improving_candidates AS (
    SELECT
      l3.project_id,
      MAX(CASE WHEN l3.rn = 3 THEN l3.risk_score END) AS risk_oldest,
      MAX(CASE WHEN l3.rn = 2 THEN l3.risk_score END) AS risk_middle,
      MAX(CASE WHEN l3.rn = 1 THEN l3.risk_score END) AS risk_latest
    FROM last_three l3
    WHERE l3.rn <= 3
    GROUP BY l3.project_id
    HAVING COUNT(*) = 3
  ),
  improving AS (
    SELECT
      ic.project_id,
      ic.risk_oldest,
      ic.risk_latest,
      ROUND(ic.risk_oldest - ic.risk_latest, 2) AS improvement_delta
    FROM improving_candidates ic
    WHERE ic.risk_oldest > ic.risk_middle
      AND ic.risk_middle > ic.risk_latest
  ),

  -- 3d. Unstable projects from volatility RPC result
  vol_projects AS (
    SELECT
      (vp->>'project_id')::uuid                     AS project_id,
      ROUND((vp->>'volatility_score')::numeric, 2)  AS volatility_score,
      vp->>'volatility_label'                       AS volatility_label,
      (vp->>'latest_snapshot_date')::date            AS latest_snapshot_date,
      ROUND((vp->>'latest_risk_score')::numeric, 2) AS latest_risk_score
    FROM jsonb_array_elements(
      COALESCE(v_volatility_result->'projects', '[]'::jsonb)
    ) AS vp
  ),
  unstable AS (
    SELECT *
    FROM vol_projects vp
    WHERE vp.volatility_label IN ('volatile', 'critical')
  ),

  -- 3e. Revenue exposure
  rev_totals AS (
    SELECT
      COALESCE(SUM(ls.projected_revenue), 0)                           AS total_revenue,
      COALESCE(SUM(ls.projected_revenue) FILTER (WHERE ls.risk_score >= 60), 0) AS high_risk_revenue
    FROM latest_snap ls
  ),

  -- 3f. Summary counts
  summary AS (
    SELECT
      (SELECT COUNT(*)::int FROM latest_snap)                    AS project_count,
      (SELECT COUNT(*)::int FROM high_risk)                      AS high_risk_projects,
      (SELECT COUNT(*)::int FROM unstable)                       AS unstable_projects,
      (SELECT COUNT(*)::int FROM improving)                      AS improving_projects,
      CASE
        WHEN rt.total_revenue = 0 THEN 0
        ELSE ROUND((rt.high_risk_revenue / rt.total_revenue) * 100, 2)
      END                                                        AS revenue_at_risk_percent
    FROM rev_totals rt
  ),

  -- 3g. Build arrays (deterministic ordering)
  top_risks_arr AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'project_id',        hr.project_id,
        'risk_score',        hr.risk_score,
        'economic_position', hr.economic_position,
        'projected_margin',  hr.projected_margin,
        'realized_margin',   hr.realized_margin,
        'projected_revenue', COALESCE(hr.projected_revenue, 0),
        'contract_value',    COALESCE(hr.contract_value, 0),
        'snapshot_date',     hr.snapshot_date,
        'flags',             hr.flags
      ) ORDER BY hr.risk_score DESC, hr.project_id ASC
    ), '[]'::jsonb) AS arr
    FROM high_risk hr
  ),
  unstable_arr AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'project_id',           u.project_id,
        'volatility_score',     u.volatility_score,
        'volatility_label',     u.volatility_label,
        'latest_snapshot_date',  u.latest_snapshot_date,
        'latest_risk_score',     u.latest_risk_score
      ) ORDER BY u.volatility_score DESC, u.project_id ASC
    ), '[]'::jsonb) AS arr
    FROM unstable u
  ),
  improving_arr AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'project_id',        i.project_id,
        'risk_oldest',       i.risk_oldest,
        'risk_latest',       i.risk_latest,
        'improvement_delta', i.improvement_delta
      ) ORDER BY i.improvement_delta DESC, i.project_id ASC
    ), '[]'::jsonb) AS arr
    FROM improving i
  ),

  -- 3h. Financial exposure object
  fin_exposure AS (
    SELECT jsonb_build_object(
      'total_projected_revenue',     rt.total_revenue,
      'high_risk_projected_revenue', rt.high_risk_revenue,
      'revenue_at_risk_percent',     CASE
        WHEN rt.total_revenue = 0 THEN 0
        ELSE ROUND((rt.high_risk_revenue / rt.total_revenue) * 100, 2)
      END
    ) AS obj
    FROM rev_totals rt
  ),

  -- 3i. Notes
  notes_arr AS (
    SELECT jsonb_agg(n.note ORDER BY n.sort_key ASC) AS arr
    FROM (
      -- note if no snapshots
      SELECT 1 AS sort_key, 'No snapshot data available for this organization.'::text AS note
      WHERE (SELECT COUNT(*) FROM latest_snap) = 0
      UNION ALL
      -- note if volatility failed
      SELECT 2, 'Volatility data unavailable: ' || v_volatility_err
      WHERE NOT v_volatility_ok
      UNION ALL
      -- note if no improving projects
      SELECT 3, 'No projects show consistent risk improvement over the last 3 snapshots.'
      WHERE (SELECT COUNT(*) FROM improving) = 0
    ) n
  )

  -- 4. FINAL ASSEMBLY
  SELECT jsonb_build_object(
    'success',              true,
    'org_id',               p_org_id,
    'as_of',                CURRENT_DATE,
    'summary',              jsonb_build_object(
      'project_count',          sm.project_count,
      'high_risk_projects',     sm.high_risk_projects,
      'unstable_projects',      sm.unstable_projects,
      'improving_projects',     sm.improving_projects,
      'revenue_at_risk_percent', sm.revenue_at_risk_percent
    ),
    'top_risks',            tra.arr,
    'most_unstable_projects', ua.arr,
    'improving_projects',   ia.arr,
    'financial_exposure',   fe.obj,
    'notes',                COALESCE(na.arr, '[]'::jsonb)
  )
  INTO v_result
  FROM summary sm
  CROSS JOIN top_risks_arr tra
  CROSS JOIN unstable_arr ua
  CROSS JOIN improving_arr ia
  CROSS JOIN fin_exposure fe
  CROSS JOIN notes_arr na;

  RETURN v_result;
END;
$function$;
