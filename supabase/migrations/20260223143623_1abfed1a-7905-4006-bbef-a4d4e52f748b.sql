
CREATE OR REPLACE FUNCTION public.rpc_get_project_volatility_index(
  p_org_id uuid,
  p_days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Membership guard
  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Not a member of organization %', p_org_id
      USING ERRCODE = '42501';
  END IF;

  WITH windowed AS (
    SELECT
      s.project_id,
      s.snapshot_date,
      s.risk_score,
      s.projected_margin,
      s.realized_margin,
      s.flags_hash,
      LAG(s.flags_hash) OVER (
        PARTITION BY s.project_id ORDER BY s.snapshot_date ASC, s.id ASC
      ) AS prev_flags_hash
    FROM project_economic_snapshots s
    WHERE s.org_id = p_org_id
      AND s.snapshot_date >= (CURRENT_DATE - p_days)
  ),
  agg AS (
    SELECT
      w.project_id,
      COUNT(*)::int                                     AS n_snapshots,
      MIN(w.risk_score)                                 AS risk_min,
      MAX(w.risk_score)                                 AS risk_max,
      MAX(w.risk_score) - MIN(w.risk_score)             AS risk_delta,
      MIN(w.projected_margin)                           AS proj_margin_min,
      MAX(w.projected_margin)                           AS proj_margin_max,
      MAX(w.projected_margin) - MIN(w.projected_margin) AS proj_margin_delta,
      MIN(w.realized_margin)                            AS real_margin_min,
      MAX(w.realized_margin)                            AS real_margin_max,
      MAX(w.realized_margin) - MIN(w.realized_margin)   AS real_margin_delta,
      COUNT(*) FILTER (
        WHERE w.prev_flags_hash IS NOT NULL
          AND w.flags_hash IS DISTINCT FROM w.prev_flags_hash
      )::int                                            AS flags_changes_count,
      MAX(w.snapshot_date)                              AS latest_snapshot_date
    FROM windowed w
    GROUP BY w.project_id
  ),
  latest AS (
    SELECT DISTINCT ON (w.project_id)
      w.project_id,
      w.risk_score        AS latest_risk_score,
      w.projected_margin  AS latest_projected_margin,
      w.realized_margin   AS latest_realized_margin
    FROM windowed w
    ORDER BY w.project_id ASC, w.snapshot_date DESC
  ),
  scored AS (
    SELECT
      a.project_id,
      a.n_snapshots,
      a.risk_delta,
      a.proj_margin_delta   AS projected_margin_delta,
      a.real_margin_delta   AS realized_margin_delta,
      a.flags_changes_count,
      a.latest_snapshot_date,
      l.latest_risk_score,
      l.latest_projected_margin,
      l.latest_realized_margin,
      CASE WHEN a.n_snapshots < 2 THEN 0
      ELSE ROUND(
        LEAST(1, GREATEST(0, a.risk_delta / 100.0)) * 40
        + LEAST(1, GREATEST(0, a.proj_margin_delta)) * 30
        + LEAST(1, GREATEST(0, a.real_margin_delta)) * 20
        + LEAST(1, GREATEST(0, a.flags_changes_count::numeric / GREATEST(a.n_snapshots - 1, 1))) * 10
      , 2) END AS volatility_score,
      CASE
        WHEN a.n_snapshots < 2 THEN 'insufficient_data'
        WHEN ROUND(
          LEAST(1, GREATEST(0, a.risk_delta / 100.0)) * 40
          + LEAST(1, GREATEST(0, a.proj_margin_delta)) * 30
          + LEAST(1, GREATEST(0, a.real_margin_delta)) * 20
          + LEAST(1, GREATEST(0, a.flags_changes_count::numeric / GREATEST(a.n_snapshots - 1, 1))) * 10
        , 2) >= 75 THEN 'critical'
        WHEN ROUND(
          LEAST(1, GREATEST(0, a.risk_delta / 100.0)) * 40
          + LEAST(1, GREATEST(0, a.proj_margin_delta)) * 30
          + LEAST(1, GREATEST(0, a.real_margin_delta)) * 20
          + LEAST(1, GREATEST(0, a.flags_changes_count::numeric / GREATEST(a.n_snapshots - 1, 1))) * 10
        , 2) >= 50 THEN 'volatile'
        WHEN ROUND(
          LEAST(1, GREATEST(0, a.risk_delta / 100.0)) * 40
          + LEAST(1, GREATEST(0, a.proj_margin_delta)) * 30
          + LEAST(1, GREATEST(0, a.real_margin_delta)) * 20
          + LEAST(1, GREATEST(0, a.flags_changes_count::numeric / GREATEST(a.n_snapshots - 1, 1))) * 10
        , 2) >= 20 THEN 'watch'
        ELSE 'stable'
      END AS volatility_label
    FROM agg a
    JOIN latest l ON l.project_id = a.project_id
  )
  SELECT jsonb_build_object(
    'success',       true,
    'org_id',        p_org_id,
    'window_days',   p_days,
    'as_of',         CURRENT_DATE,
    'project_count', COALESCE((SELECT COUNT(*)::int FROM scored), 0),
    'projects',      COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'project_id',              sc.project_id,
          'n_snapshots',             sc.n_snapshots,
          'volatility_score',        sc.volatility_score,
          'volatility_label',        sc.volatility_label,
          'risk_delta',              sc.risk_delta,
          'projected_margin_delta',  sc.projected_margin_delta,
          'realized_margin_delta',   sc.realized_margin_delta,
          'flags_changes_count',     sc.flags_changes_count,
          'latest_snapshot_date',    sc.latest_snapshot_date,
          'latest_risk_score',       sc.latest_risk_score,
          'latest_projected_margin', sc.latest_projected_margin,
          'latest_realized_margin',  sc.latest_realized_margin
        )
        ORDER BY sc.volatility_score DESC, sc.latest_snapshot_date DESC, sc.project_id ASC
      ) FROM scored sc),
      '[]'::jsonb
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
