
CREATE OR REPLACE FUNCTION public.rpc_exec_report_sanity(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_hr_from_data       int;
  v_unstable_from_data int;
  v_rev_at_risk_pct    numeric;
  v_report             jsonb;
  v_hr_from_report     int;
  v_unstable_from_rpt  int;
BEGIN
  -- 1) High-risk from raw data: latest snapshot per project, risk_score >= 60
  SELECT COUNT(*)::int
    INTO v_hr_from_data
    FROM (
      SELECT DISTINCT ON (s.project_id) s.risk_score
        FROM project_economic_snapshots s
       WHERE s.org_id = p_org_id
       ORDER BY s.project_id ASC, s.snapshot_date DESC, s.id ASC
    ) latest
   WHERE latest.risk_score >= 60;

  -- 2) Unstable from raw volatility data: projects with label volatile/critical (30-day window)
  WITH windowed AS (
    SELECT
      s.project_id, s.risk_score, s.projected_margin, s.realized_margin,
      s.flags_hash,
      LAG(s.flags_hash) OVER (PARTITION BY s.project_id ORDER BY s.snapshot_date ASC, s.id ASC) AS prev_flags_hash
    FROM project_economic_snapshots s
    WHERE s.org_id = p_org_id AND s.snapshot_date >= (CURRENT_DATE - 30)
  ),
  agg AS (
    SELECT w.project_id,
      COUNT(*)::int AS n,
      MAX(w.risk_score) - MIN(w.risk_score) AS risk_delta,
      MAX(w.projected_margin) - MIN(w.projected_margin) AS pm_delta,
      MAX(w.realized_margin) - MIN(w.realized_margin) AS rm_delta,
      COUNT(*) FILTER (WHERE w.prev_flags_hash IS NOT NULL AND w.flags_hash IS DISTINCT FROM w.prev_flags_hash)::int AS fc
    FROM windowed w GROUP BY w.project_id
  ),
  scored AS (
    SELECT a.project_id,
      CASE WHEN a.n < 2 THEN 'insufficient_data'
        WHEN ROUND(
          LEAST(1, GREATEST(0, a.risk_delta / 100.0)) * 40
          + LEAST(1, GREATEST(0, a.pm_delta)) * 30
          + LEAST(1, GREATEST(0, a.rm_delta)) * 20
          + LEAST(1, GREATEST(0, a.fc::numeric / GREATEST(a.n - 1, 1))) * 10
        , 2) >= 75 THEN 'critical'
        WHEN ROUND(
          LEAST(1, GREATEST(0, a.risk_delta / 100.0)) * 40
          + LEAST(1, GREATEST(0, a.pm_delta)) * 30
          + LEAST(1, GREATEST(0, a.rm_delta)) * 20
          + LEAST(1, GREATEST(0, a.fc::numeric / GREATEST(a.n - 1, 1))) * 10
        , 2) >= 50 THEN 'volatile'
        ELSE 'other'
      END AS label
    FROM agg a
  )
  SELECT COUNT(*)::int INTO v_unstable_from_data
    FROM scored WHERE label IN ('volatile', 'critical');

  -- 3) Revenue at risk from raw data
  SELECT CASE WHEN COALESCE(SUM(projected_revenue), 0) = 0 THEN 0
    ELSE ROUND(
      COALESCE(SUM(projected_revenue) FILTER (WHERE risk_score >= 60), 0)
      / SUM(projected_revenue) * 100, 2)
    END
    INTO v_rev_at_risk_pct
    FROM (
      SELECT DISTINCT ON (s.project_id) s.projected_revenue, s.risk_score
        FROM project_economic_snapshots s
       WHERE s.org_id = p_org_id
       ORDER BY s.project_id ASC, s.snapshot_date DESC, s.id ASC
    ) latest;

  -- 4) Get report numbers for comparison
  BEGIN
    v_report := public.rpc_generate_executive_report(p_org_id);
    v_hr_from_report    := COALESCE((v_report->'summary'->>'high_risk_projects')::int, 0);
    v_unstable_from_rpt := COALESCE((v_report->'summary'->>'unstable_projects')::int, 0);
  EXCEPTION WHEN OTHERS THEN
    v_hr_from_report    := -1;
    v_unstable_from_rpt := -1;
  END;

  RETURN jsonb_build_object(
    'high_risk_projects_from_report', v_hr_from_report,
    'high_risk_projects_from_data',   v_hr_from_data,
    'unstable_from_report',           v_unstable_from_rpt,
    'unstable_from_volatility',       v_unstable_from_data,
    'revenue_at_risk_percent',        v_rev_at_risk_pct
  );
END;
$function$;
