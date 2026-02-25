
CREATE OR REPLACE FUNCTION public.rpc_executive_change_feed(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest_date date;
  v_prev_date   date;
  v_result      jsonb;
BEGIN
  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT max(s.snapshot_date) INTO v_latest_date
  FROM project_economic_snapshots s
  WHERE s.org_id = p_org_id;

  IF v_latest_date IS NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'not_enough_history');
  END IF;

  SELECT max(s.snapshot_date) INTO v_prev_date
  FROM project_economic_snapshots s
  WHERE s.org_id = p_org_id AND s.snapshot_date < v_latest_date;

  IF v_prev_date IS NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'not_enough_history');
  END IF;

  WITH comparison AS (
    SELECT
      l.project_id,
      pr.name AS project_name,
      ROUND((COALESCE(l.risk_score,0) - COALESCE(p.risk_score,0))::numeric, 2) AS risk_change,
      ROUND((COALESCE(l.projected_margin,0) - COALESCE(p.projected_margin,0))::numeric, 2) AS margin_change,
      ROUND((COALESCE(l.labor_burn_ratio,0) - COALESCE(p.labor_burn_ratio,0))::numeric, 2) AS burn_change,
      ROUND(COALESCE(l.risk_score,0)::numeric, 2) AS latest_risk,
      ROUND(COALESCE(p.risk_score,0)::numeric, 2) AS prev_risk,
      ROUND(COALESCE(l.projected_margin,0)::numeric, 2) AS latest_margin,
      ROUND(COALESCE(p.projected_margin,0)::numeric, 2) AS prev_margin,
      ROUND(COALESCE(l.labor_burn_ratio,0)::numeric, 2) AS latest_burn,
      ROUND(COALESCE(p.labor_burn_ratio,0)::numeric, 2) AS prev_burn
    FROM project_economic_snapshots l
    JOIN project_economic_snapshots p
      ON p.project_id = l.project_id
      AND p.org_id = p_org_id
      AND p.snapshot_date = v_prev_date
    JOIN projects pr
      ON pr.id = l.project_id
      AND pr.is_deleted = false
      AND pr.status IN ('active','in_progress','open')
    WHERE l.org_id = p_org_id
      AND l.snapshot_date = v_latest_date
  ),
  classified AS (
    SELECT
      c.*,
      CASE
        WHEN c.latest_risk >= 60 AND c.prev_risk < 60 THEN 'new_risks'
        WHEN c.latest_risk < 60 AND c.prev_risk >= 60 THEN 'resolved_risks'
        WHEN c.burn_change > 0.05 THEN 'burn_increase'
        WHEN c.risk_change > 0 THEN 'worsening'
        WHEN c.risk_change < 0 THEN 'improving'
        ELSE 'stable'
      END AS classification
    FROM comparison c
  ),
  counts AS (
    SELECT
      COUNT(*) FILTER (WHERE classification = 'new_risks') AS new_risks,
      COUNT(*) FILTER (WHERE classification = 'resolved_risks') AS resolved_risks,
      COUNT(*) FILTER (WHERE classification = 'improving') AS improving,
      COUNT(*) FILTER (WHERE classification = 'worsening') AS worsening,
      COUNT(*) FILTER (WHERE classification = 'burn_increase') AS burn_increases
    FROM classified
  ),
  top_changes AS (
    SELECT COALESCE(jsonb_agg(t.row_obj ORDER BY t.abs_risk DESC, t.project_id ASC), '[]'::jsonb) AS arr
    FROM (
      SELECT
        c.project_id,
        ABS(c.risk_change) AS abs_risk,
        jsonb_build_object(
          'project_id', c.project_id,
          'project_name', c.project_name,
          'prev_risk', c.prev_risk,
          'curr_risk', c.latest_risk,
          'risk_change', c.risk_change,
          'prev_margin', c.prev_margin,
          'curr_margin', c.latest_margin,
          'margin_change', c.margin_change,
          'prev_burn', c.prev_burn,
          'curr_burn', c.latest_burn,
          'burn_change', c.burn_change,
          'classification', c.classification
        ) AS row_obj
      FROM classified c
      WHERE c.classification != 'stable'
      ORDER BY ABS(c.risk_change) DESC, c.project_id ASC
      LIMIT 10
    ) t
  ),
  attention_ranked AS (
    SELECT COALESCE(jsonb_agg(a.row_obj ORDER BY a.score DESC, a.project_id ASC), '[]'::jsonb) AS arr
    FROM (
      SELECT
        c.project_id,
        ROUND((ABS(c.risk_change) * 2 + ABS(c.margin_change) + c.burn_change * 50)::numeric, 2) AS score,
        jsonb_build_object(
          'project_id', c.project_id,
          'project_name', c.project_name,
          'risk_change', c.risk_change,
          'margin_change', c.margin_change,
          'burn_change', c.burn_change,
          'attention_score', ROUND((ABS(c.risk_change) * 2 + ABS(c.margin_change) + c.burn_change * 50)::numeric, 2)
        ) AS row_obj
      FROM classified c
      ORDER BY ROUND((ABS(c.risk_change) * 2 + ABS(c.margin_change) + c.burn_change * 50)::numeric, 2) DESC, c.project_id ASC
      LIMIT 5
    ) a
  )
  SELECT jsonb_build_object(
    'latest_snapshot_date', v_latest_date,
    'previous_snapshot_date', v_prev_date,
    'new_risks', cn.new_risks,
    'resolved_risks', cn.resolved_risks,
    'improving', cn.improving,
    'worsening', cn.worsening,
    'burn_increases', cn.burn_increases,
    'top_changes', tc.arr,
    'attention_ranked_projects', ar.arr
  )
  INTO v_result
  FROM counts cn
  CROSS JOIN top_changes tc
  CROSS JOIN attention_ranked ar;

  RETURN v_result;
END;
$$;
