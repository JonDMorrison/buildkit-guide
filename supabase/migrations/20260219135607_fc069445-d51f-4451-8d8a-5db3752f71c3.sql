
-- ============================================================
-- PLAYBOOK VARIANCE INTELLIGENCE ENGINE
-- ============================================================

-- 1. rpc_get_playbook_performance
CREATE OR REPLACE FUNCTION public.rpc_get_playbook_performance(p_playbook_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_result jsonb;
  v_phase_breakdown jsonb;
BEGIN
  SELECT organization_id INTO v_org_id FROM playbooks WHERE id = p_playbook_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Playbook not found' USING ERRCODE = '42501';
  END IF;
  IF NOT has_org_membership(v_org_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Phase breakdown: join tasks back to their playbook phase via description prefix
  SELECT COALESCE(jsonb_agg(row_j ORDER BY row_j->>'phase_name'), '[]'::jsonb)
  INTO v_phase_breakdown
  FROM (
    SELECT jsonb_build_object(
      'phase_name', pp.name,
      'baseline_avg_low', ROUND(AVG(t.baseline_low_hours)::numeric, 2),
      'baseline_avg_high', ROUND(AVG(t.baseline_high_hours)::numeric, 2),
      'baseline_midpoint', ROUND(AVG((t.baseline_low_hours + t.baseline_high_hours) / 2.0)::numeric, 2),
      'actual_avg', ROUND(AVG(
        COALESCE((
          SELECT SUM(EXTRACT(EPOCH FROM (te.check_out - te.check_in)) / 3600.0)
          FROM time_entries te WHERE te.task_id = t.id AND te.check_out IS NOT NULL
        ), 0)
      )::numeric, 2),
      'variance_percent', CASE
        WHEN AVG((t.baseline_low_hours + t.baseline_high_hours) / 2.0) > 0 THEN
          ROUND((
            (AVG(COALESCE((
              SELECT SUM(EXTRACT(EPOCH FROM (te.check_out - te.check_in)) / 3600.0)
              FROM time_entries te WHERE te.task_id = t.id AND te.check_out IS NOT NULL
            ), 0)) - AVG((t.baseline_low_hours + t.baseline_high_hours) / 2.0))
            / AVG((t.baseline_low_hours + t.baseline_high_hours) / 2.0) * 100
          )::numeric, 1)
        ELSE 0
      END,
      'task_count', COUNT(t.id)
    ) AS row_j
    FROM tasks t
    JOIN playbook_tasks pt ON pt.title = t.title
    JOIN playbook_phases pp ON pp.id = pt.playbook_phase_id AND pp.playbook_id = p_playbook_id
    WHERE t.source_playbook_id = p_playbook_id
      AND t.is_deleted = false
    GROUP BY pp.name, pp.sequence_order
  ) sub;

  -- Aggregate totals
  SELECT jsonb_build_object(
    'playbook_id', p_playbook_id,
    'projects_using', (SELECT COUNT(DISTINCT id) FROM projects WHERE applied_playbook_id = p_playbook_id),
    'total_tasks_generated', COUNT(t.id),
    'avg_baseline_midpoint', ROUND(AVG((t.baseline_low_hours + t.baseline_high_hours) / 2.0)::numeric, 2),
    'avg_actual_hours', ROUND(AVG(
      COALESCE((
        SELECT SUM(EXTRACT(EPOCH FROM (te.check_out - te.check_in)) / 3600.0)
        FROM time_entries te WHERE te.task_id = t.id AND te.check_out IS NOT NULL
      ), 0)
    )::numeric, 2),
    'variance_percent', CASE
      WHEN AVG((t.baseline_low_hours + t.baseline_high_hours) / 2.0) > 0 THEN
        ROUND((
          (AVG(COALESCE((
            SELECT SUM(EXTRACT(EPOCH FROM (te.check_out - te.check_in)) / 3600.0)
            FROM time_entries te WHERE te.task_id = t.id AND te.check_out IS NOT NULL
          ), 0)) - AVG((t.baseline_low_hours + t.baseline_high_hours) / 2.0))
          / AVG((t.baseline_low_hours + t.baseline_high_hours) / 2.0) * 100
        )::numeric, 1)
      ELSE 0
    END,
    'phase_breakdown', v_phase_breakdown
  )
  INTO v_result
  FROM tasks t
  WHERE t.source_playbook_id = p_playbook_id AND t.is_deleted = false;

  RETURN v_result;
END;
$$;


-- 2. rpc_suggest_playbook_adjustments
CREATE OR REPLACE FUNCTION public.rpc_suggest_playbook_adjustments(p_playbook_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_suggestions jsonb := '[]'::jsonb;
  v_rec record;
BEGIN
  SELECT organization_id INTO v_org_id FROM playbooks WHERE id = p_playbook_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Playbook not found' USING ERRCODE = '42501';
  END IF;
  IF NOT has_org_membership(v_org_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  FOR v_rec IN
    SELECT
      pp.name AS phase_name,
      pt.title AS task_title,
      pt.expected_hours_low,
      pt.expected_hours_high,
      ROUND(AVG(
        COALESCE((
          SELECT SUM(EXTRACT(EPOCH FROM (te.check_out - te.check_in)) / 3600.0)
          FROM time_entries te WHERE te.task_id = t.id AND te.check_out IS NOT NULL
        ), 0)
      )::numeric, 1) AS avg_actual,
      COUNT(t.id) AS sample_size
    FROM playbook_tasks pt
    JOIN playbook_phases pp ON pp.id = pt.playbook_phase_id AND pp.playbook_id = p_playbook_id
    JOIN tasks t ON t.source_playbook_id = p_playbook_id
      AND t.title = pt.title
      AND t.is_deleted = false
    GROUP BY pp.name, pp.sequence_order, pt.title, pt.expected_hours_low, pt.expected_hours_high, pt.sequence_order
    HAVING COUNT(t.id) >= 2  -- need at least 2 data points
    ORDER BY pp.sequence_order, pt.sequence_order
  LOOP
    -- Flag if actual consistently exceeds baseline_high by 15%+
    IF v_rec.avg_actual > v_rec.expected_hours_high * 1.15 THEN
      v_suggestions := v_suggestions || jsonb_build_object(
        'phase', v_rec.phase_name,
        'task', v_rec.task_title,
        'severity', 'overrun',
        'avg_actual_hours', v_rec.avg_actual,
        'baseline_range', format('%s–%sh', v_rec.expected_hours_low, v_rec.expected_hours_high),
        'sample_size', v_rec.sample_size,
        'suggestion', format(
          '%s → %s averages %sh vs baseline %s–%sh. Consider adjusting expected band.',
          v_rec.phase_name, v_rec.task_title, v_rec.avg_actual,
          v_rec.expected_hours_low, v_rec.expected_hours_high
        )
      );
    -- Also flag significant under-runs (actual < low by 20%+) — could tighten estimates
    ELSIF v_rec.expected_hours_low > 0 AND v_rec.avg_actual < v_rec.expected_hours_low * 0.80 THEN
      v_suggestions := v_suggestions || jsonb_build_object(
        'phase', v_rec.phase_name,
        'task', v_rec.task_title,
        'severity', 'underrun',
        'avg_actual_hours', v_rec.avg_actual,
        'baseline_range', format('%s–%sh', v_rec.expected_hours_low, v_rec.expected_hours_high),
        'sample_size', v_rec.sample_size,
        'suggestion', format(
          '%s → %s averages %sh vs baseline %s–%sh. Band may be over-estimated.',
          v_rec.phase_name, v_rec.task_title, v_rec.avg_actual,
          v_rec.expected_hours_low, v_rec.expected_hours_high
        )
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'playbook_id', p_playbook_id,
    'suggestion_count', jsonb_array_length(v_suggestions),
    'suggestions', v_suggestions
  );
END;
$$;
