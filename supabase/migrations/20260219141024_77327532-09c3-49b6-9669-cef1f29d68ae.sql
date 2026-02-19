
-- RPC to fetch org-level operational patterns for the insights dashboard
CREATE OR REPLACE FUNCTION public.get_operational_patterns(p_organization_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_top_playbooks json;
  v_most_overrun_phase json;
  v_most_efficient_role json;
  v_rework_frequency json;
  v_playbook_adoption json;
BEGIN
  -- Verify org membership
  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 1. Top 5 playbooks by usage (projects using them)
  SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
  INTO v_top_playbooks
  FROM (
    SELECT
      pb.id,
      pb.name,
      pb.version,
      count(p.id) AS projects_using,
      pb.job_type
    FROM playbooks pb
    LEFT JOIN projects p ON p.applied_playbook_id = pb.id
      AND p.organization_id = p_organization_id
    WHERE pb.organization_id = p_organization_id
      AND pb.is_archived = false
    GROUP BY pb.id, pb.name, pb.version, pb.job_type
    ORDER BY count(p.id) DESC
    LIMIT 5
  ) t;

  -- 2. Most overrun phase: compare playbook expected hours vs actual time entries per phase
  SELECT row_to_json(t) INTO v_most_overrun_phase
  FROM (
    SELECT
      pp.name AS phase_name,
      round(avg(pt.expected_hours_low + pt.expected_hours_high) / 2.0, 1) AS avg_baseline_hours,
      round(coalesce(sum(te.duration_hours), 0), 1) AS total_actual_hours,
      count(DISTINCT tk.id) AS task_count,
      CASE
        WHEN avg(pt.expected_hours_low + pt.expected_hours_high) / 2.0 > 0
        THEN round(
          ((coalesce(sum(te.duration_hours), 0) - avg(pt.expected_hours_low + pt.expected_hours_high) / 2.0)
           / (avg(pt.expected_hours_low + pt.expected_hours_high) / 2.0)) * 100, 1)
        ELSE 0
      END AS overrun_percent
    FROM playbook_phases pp
    JOIN playbook_tasks pt ON pt.playbook_phase_id = pp.id
    JOIN playbooks pb ON pb.id = pp.playbook_id AND pb.organization_id = p_organization_id
    LEFT JOIN projects proj ON proj.applied_playbook_id = pb.id AND proj.organization_id = p_organization_id
    LEFT JOIN tasks tk ON tk.project_id = proj.id AND tk.playbook_required IS NOT NULL
    LEFT JOIN time_entries te ON te.task_id = tk.id AND te.organization_id = p_organization_id
    GROUP BY pp.id, pp.name
    HAVING avg(pt.expected_hours_low + pt.expected_hours_high) / 2.0 > 0
    ORDER BY overrun_percent DESC
    LIMIT 1
  ) t;

  -- 3. Most efficient crew role (by org membership role with lowest avg hours per completed task)
  SELECT row_to_json(t) INTO v_most_efficient_role
  FROM (
    SELECT
      om.role AS crew_role,
      count(DISTINCT te.id) AS entry_count,
      round(avg(te.duration_hours), 1) AS avg_hours_per_entry,
      round(sum(te.duration_hours), 1) AS total_hours
    FROM time_entries te
    JOIN organization_memberships om ON om.user_id = te.user_id
      AND om.organization_id = p_organization_id
    WHERE te.organization_id = p_organization_id
      AND te.duration_hours > 0
    GROUP BY om.role
    HAVING count(DISTINCT te.id) >= 5
    ORDER BY avg(te.duration_hours) ASC
    LIMIT 1
  ) t;

  -- 4. Rework frequency (deficiencies that were reopened or resolved then recreated)
  SELECT row_to_json(t) INTO v_rework_frequency
  FROM (
    SELECT
      count(*) FILTER (WHERE d.status = 'resolved') AS resolved_count,
      count(*) AS total_count,
      count(*) FILTER (WHERE d.status IN ('open','in_progress') AND d.created_at < now() - interval '7 days') AS aging_count,
      CASE WHEN count(*) > 0
        THEN round((count(*) FILTER (WHERE d.status IN ('open','in_progress'))::numeric / count(*)::numeric) * 100, 1)
        ELSE 0
      END AS open_rate_percent
    FROM deficiencies d
    JOIN projects p ON p.id = d.project_id AND p.organization_id = p_organization_id
    WHERE d.is_deleted = false
  ) t;

  -- 5. Playbook adoption rate
  SELECT row_to_json(t) INTO v_playbook_adoption
  FROM (
    SELECT
      count(*) AS total_projects,
      count(*) FILTER (WHERE p.applied_playbook_id IS NOT NULL) AS playbook_projects,
      CASE WHEN count(*) > 0
        THEN round((count(*) FILTER (WHERE p.applied_playbook_id IS NOT NULL)::numeric / count(*)::numeric) * 100, 1)
        ELSE 0
      END AS adoption_percent
    FROM projects p
    WHERE p.organization_id = p_organization_id
  ) t;

  RETURN json_build_object(
    'top_playbooks', v_top_playbooks,
    'most_overrun_phase', v_most_overrun_phase,
    'most_efficient_role', v_most_efficient_role,
    'rework_frequency', v_rework_frequency,
    'playbook_adoption', v_playbook_adoption
  );
END;
$$;
