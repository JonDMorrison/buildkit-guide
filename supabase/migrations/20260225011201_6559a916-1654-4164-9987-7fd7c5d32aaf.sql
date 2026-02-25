
CREATE OR REPLACE FUNCTION public.rpc_executive_change_feed(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_latest_date date;
  v_prev_date   date;
  v_result      jsonb;
BEGIN
  -- 1. Membership guard
  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 2. Latest snapshot date
  SELECT max(s.snapshot_date) INTO v_latest_date
  FROM project_economic_snapshots s
  WHERE s.org_id = p_org_id;

  IF v_latest_date IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'not_enough_history'
    );
  END IF;

  -- 3. Previous snapshot date
  SELECT max(s.snapshot_date) INTO v_prev_date
  FROM project_economic_snapshots s
  WHERE s.org_id = p_org_id
    AND s.snapshot_date < v_latest_date;

  IF v_prev_date IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'not_enough_history'
    );
  END IF;

  -- 4-9. Build comparison and return
  WITH comparison AS (
    SELECT
      l.project_id,
      ROUND((COALESCE(l.risk_score, 0) - COALESCE(p.risk_score, 0))::numeric, 2) AS risk_change,
      ROUND((COALESCE(l.projected_margin, 0) - COALESCE(p.projected_margin, 0))::numeric, 2) AS margin_change,
      ROUND((COALESCE(l.labor_burn_ratio, 0) - COALESCE(p.labor_burn_ratio, 0))::numeric, 2) AS burn_change,
      ROUND(COALESCE(l.risk_score, 0)::numeric, 2) AS latest_risk,
      ROUND(COALESCE(p.risk_score, 0)::numeric, 2) AS prev_risk,
      ROUND(COALESCE(l.projected_margin, 0)::numeric, 2) AS latest_margin,
      ROUND(COALESCE(l.labor_burn_ratio, 0)::numeric, 2) AS latest_burn
    FROM project_economic_snapshots l
    JOIN project_economic_snapshots p
      ON p.project_id = l.project_id
      AND p.org_id = p_org_id
      AND p.snapshot_date = v_prev_date
    JOIN projects pr
      ON pr.id = l.project_id
      AND pr.is_deleted = false
      AND pr.status IN ('active', 'in_progress', 'open')
    WHERE l.org_id = p_org_id
      AND l.snapshot_date = v_latest_date
  ),
  counts AS (
    SELECT
      COUNT(*) FILTER (WHERE latest_risk >= 60 AND prev_risk < 60) AS new_risks_count,
      COUNT(*) FILTER (WHERE latest_risk < 60 AND prev_risk >= 60) AS resolved_risks_count,
      COUNT(*) FILTER (WHERE risk_change < 0) AS improving_count,
      COUNT(*) FILTER (WHERE risk_change > 0) AS worsening_count,
      COUNT(*) FILTER (WHERE burn_change > 0.05) AS burn_increase_count
    FROM comparison
  ),
  top_changes AS (
    SELECT jsonb_agg(t.row_obj ORDER BY t.abs_risk DESC, t.project_id ASC) AS arr
    FROM (
      SELECT
        c.project_id,
        ABS(c.risk_change) AS abs_risk,
        jsonb_build_object(
          'project_id', c.project_id,
          'risk_change', c.risk_change,
          'margin_change', c.margin_change,
          'burn_change', c.burn_change,
          'latest_risk_score', c.latest_risk,
          'latest_projected_margin', c.latest_margin,
          'latest_labor_burn_ratio', c.latest_burn
        ) AS row_obj
      FROM comparison c
      ORDER BY ABS(c.risk_change) DESC, c.project_id ASC
      LIMIT 5
    ) t
  )
  SELECT jsonb_build_object(
    'success', true,
    'org_id', p_org_id,
    'latest_snapshot_date', v_latest_date,
    'previous_snapshot_date', v_prev_date,
    'changes', jsonb_build_object(
      'new_risks_count', cn.new_risks_count,
      'resolved_risks_count', cn.resolved_risks_count,
      'improving_count', cn.improving_count,
      'worsening_count', cn.worsening_count,
      'burn_increase_count', cn.burn_increase_count
    ),
    'top_changes', COALESCE(tc.arr, '[]'::jsonb)
  )
  INTO v_result
  FROM counts cn
  CROSS JOIN top_changes tc;

  RETURN v_result;
END;
$$;
