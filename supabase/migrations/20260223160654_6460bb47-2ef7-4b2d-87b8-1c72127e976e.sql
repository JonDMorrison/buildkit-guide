
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
  v_notes             jsonb := '[]'::jsonb;
  v_self_tests        jsonb;
BEGIN
  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_authorized'
      USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_volatility_result := public.rpc_get_project_volatility_index(p_org_id, 30);
  EXCEPTION WHEN OTHERS THEN
    v_volatility_ok  := false;
    v_volatility_err := SQLERRM;
    v_volatility_result := '{"projects":[]}'::jsonb;
    v_notes := v_notes || to_jsonb('volatility_unavailable'::text);
  END;

  WITH
  latest_snap AS (
    SELECT DISTINCT ON (s.project_id)
      s.*
    FROM public.project_economic_snapshots s
    WHERE s.org_id = p_org_id
    ORDER BY
      s.project_id ASC,
      s.snapshot_date DESC,
      s.id ASC
  ),

  high_risk AS (
    SELECT
      ls.project_id, ls.risk_score, ls.economic_position,
      ls.projected_margin, ls.realized_margin, ls.projected_revenue,
      ls.contract_value, ls.snapshot_date, ls.flags
    FROM latest_snap ls
    WHERE ls.risk_score >= 60
  ),

  last_three AS (
    SELECT
      s.project_id, s.risk_score, s.snapshot_date,
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
      ic.project_id, ic.risk_oldest, ic.risk_latest,
      ROUND(ic.risk_oldest - ic.risk_latest, 2) AS improvement_delta
    FROM improving_candidates ic
    WHERE ic.risk_oldest > ic.risk_middle
      AND ic.risk_middle > ic.risk_latest
  ),

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
    SELECT * FROM vol_projects vp
    WHERE vp.volatility_label IN ('volatile', 'critical')
  ),

  rev_totals AS (
    SELECT
      COALESCE(SUM(ls.projected_revenue), 0)                                    AS total_revenue,
      COALESCE(SUM(ls.projected_revenue) FILTER (WHERE ls.risk_score >= 60), 0) AS high_risk_revenue
    FROM latest_snap ls
  ),

  summary AS (
    SELECT
      (SELECT COUNT(*)::int FROM latest_snap)    AS project_count,
      (SELECT COUNT(*)::int FROM high_risk)      AS high_risk_projects,
      (SELECT COUNT(*)::int FROM unstable)       AS unstable_projects,
      (SELECT COUNT(*)::int FROM improving)      AS improving_projects,
      CASE WHEN rt.total_revenue = 0 THEN 0
        ELSE ROUND((rt.high_risk_revenue / rt.total_revenue) * 100, 2)
      END AS revenue_at_risk_percent
    FROM rev_totals rt
  ),

  top_risks_arr AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'project_id', hr.project_id, 'risk_score', hr.risk_score,
        'economic_position', hr.economic_position, 'projected_margin', hr.projected_margin,
        'realized_margin', hr.realized_margin,
        'projected_revenue', COALESCE(hr.projected_revenue, 0),
        'contract_value', COALESCE(hr.contract_value, 0),
        'snapshot_date', hr.snapshot_date, 'flags', hr.flags
      ) ORDER BY hr.risk_score DESC, hr.project_id ASC
    ), '[]'::jsonb) AS arr
    FROM high_risk hr
  ),
  unstable_arr AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'project_id', u.project_id, 'volatility_score', u.volatility_score,
        'volatility_label', u.volatility_label,
        'latest_snapshot_date', u.latest_snapshot_date,
        'latest_risk_score', u.latest_risk_score
      ) ORDER BY u.volatility_score DESC, u.project_id ASC
    ), '[]'::jsonb) AS arr
    FROM unstable u
  ),
  improving_arr AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'project_id', i.project_id, 'risk_oldest', i.risk_oldest,
        'risk_latest', i.risk_latest, 'improvement_delta', i.improvement_delta
      ) ORDER BY i.improvement_delta DESC, i.project_id ASC
    ), '[]'::jsonb) AS arr
    FROM improving i
  ),

  fin_exposure AS (
    SELECT jsonb_build_object(
      'total_projected_revenue', rt.total_revenue,
      'high_risk_projected_revenue', rt.high_risk_revenue,
      'revenue_at_risk_percent', CASE WHEN rt.total_revenue = 0 THEN 0
        ELSE ROUND((rt.high_risk_revenue / rt.total_revenue) * 100, 2) END
    ) AS obj
    FROM rev_totals rt
  ),

  note_keys AS (
    SELECT v_notes
      || CASE WHEN (SELECT COUNT(*) FROM latest_snap) = 0
              THEN to_jsonb('no_snapshots'::text) ELSE '[]'::jsonb END
      || CASE WHEN (SELECT COUNT(*) FROM high_risk) = 0
              THEN to_jsonb('no_high_risk_projects'::text) ELSE '[]'::jsonb END
      || CASE WHEN (SELECT COUNT(*) FROM unstable) = 0 AND v_volatility_ok
              THEN to_jsonb('no_unstable_projects'::text) ELSE '[]'::jsonb END
      || CASE WHEN (SELECT COUNT(*) FROM improving) = 0
              THEN to_jsonb('no_improving_projects'::text) ELSE '[]'::jsonb END
      AS raw_notes
  ),
  deduped_notes AS (
    SELECT COALESCE(
      (SELECT jsonb_agg(x ORDER BY x)
       FROM (SELECT DISTINCT jsonb_array_elements(nk.raw_notes) AS x) sub),
      '[]'::jsonb
    ) AS arr
    FROM note_keys nk
  )

  SELECT jsonb_build_object(
    'success',                true,
    'org_id',                 p_org_id,
    'as_of',                  CURRENT_DATE,
    'summary',                jsonb_build_object(
      'project_count',          sm.project_count,
      'high_risk_projects',     sm.high_risk_projects,
      'unstable_projects',      sm.unstable_projects,
      'improving_projects',     sm.improving_projects,
      'revenue_at_risk_percent', sm.revenue_at_risk_percent
    ),
    'top_risks',              tra.arr,
    'most_unstable_projects', ua.arr,
    'improving_projects',     ia.arr,
    'financial_exposure',     fe.obj,
    'notes',                  dn.arr
  )
  INTO v_result
  FROM summary sm
  CROSS JOIN top_risks_arr tra
  CROSS JOIN unstable_arr ua
  CROSS JOIN improving_arr ia
  CROSS JOIN fin_exposure fe
  CROSS JOIN deduped_notes dn;

  -- ═══════════════════════════════════════════════════════════
  -- SELF-TESTS: verify structural invariants on v_result
  -- ═══════════════════════════════════════════════════════════
  v_self_tests := jsonb_build_object(
    'success_is_boolean',
      jsonb_typeof(v_result->'success') = 'boolean',

    'notes_is_json_array',
      jsonb_typeof(v_result->'notes') = 'array',

    'top_risks_sorted',
      CASE
        WHEN jsonb_array_length(v_result->'top_risks') < 2 THEN true
        ELSE (
          -- e0.risk_score >= e1.risk_score, tie-break: e0.project_id <= e1.project_id
          ((v_result->'top_risks'->0->>'risk_score')::numeric
            > (v_result->'top_risks'->1->>'risk_score')::numeric)
          OR (
            (v_result->'top_risks'->0->>'risk_score')::numeric
              = (v_result->'top_risks'->1->>'risk_score')::numeric
            AND (v_result->'top_risks'->0->>'project_id')
              <= (v_result->'top_risks'->1->>'project_id')
          )
        )
      END,

    'unstable_sorted',
      CASE
        WHEN jsonb_array_length(v_result->'most_unstable_projects') < 2 THEN true
        ELSE (
          ((v_result->'most_unstable_projects'->0->>'volatility_score')::numeric
            > (v_result->'most_unstable_projects'->1->>'volatility_score')::numeric)
          OR (
            (v_result->'most_unstable_projects'->0->>'volatility_score')::numeric
              = (v_result->'most_unstable_projects'->1->>'volatility_score')::numeric
            AND (v_result->'most_unstable_projects'->0->>'project_id')
              <= (v_result->'most_unstable_projects'->1->>'project_id')
          )
        )
      END,

    'improving_sorted',
      CASE
        WHEN jsonb_array_length(v_result->'improving_projects') < 2 THEN true
        ELSE (
          ((v_result->'improving_projects'->0->>'improvement_delta')::numeric
            > (v_result->'improving_projects'->1->>'improvement_delta')::numeric)
          OR (
            (v_result->'improving_projects'->0->>'improvement_delta')::numeric
              = (v_result->'improving_projects'->1->>'improvement_delta')::numeric
            AND (v_result->'improving_projects'->0->>'project_id')
              <= (v_result->'improving_projects'->1->>'project_id')
          )
        )
      END,

    'ordering_contract', jsonb_build_object(
      'top_risks',    'risk_score DESC, project_id ASC',
      'unstable',     'volatility_score DESC, project_id ASC',
      'improving',    'improvement_delta DESC, project_id ASC'
    )
  );

  v_result := v_result || jsonb_build_object('self_tests', v_self_tests);

  RETURN v_result;
END;
$function$;
