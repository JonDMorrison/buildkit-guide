
CREATE OR REPLACE FUNCTION public.rpc_get_system_integrity_issues(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_issues jsonb := '[]'::jsonb;
  v_org_id uuid;
  v_count bigint;
  v_hours numeric;
  v_mismatch_hours numeric;
  v_entries bigint;
  v_mismatch_entries bigint;
  v_project_currency text;
  v_missing_rates bigint;
  v_pending_receipts bigint;
  v_overdue_tasks bigint;
  v_old_blockers bigint;
  v_safety_gap numeric;
  v_est_count bigint;
  v_wf record;
BEGIN
  -- Get org
  SELECT organization_id INTO v_org_id FROM projects WHERE id = p_project_id;
  IF v_org_id IS NULL THEN RETURN v_issues; END IF;

  -- Get project currency
  SELECT currency INTO v_project_currency FROM projects WHERE id = p_project_id;

  -- 1. Unrated labor hours (critical if > 0)
  SELECT
    COALESCE(SUM(EXTRACT(EPOCH FROM (te.check_out - te.check_in)) / 3600.0), 0),
    COUNT(*)
  INTO v_hours, v_entries
  FROM time_entries te
  JOIN project_members pm ON pm.user_id = te.user_id AND pm.project_id = te.project_id
  LEFT JOIN labor_rates lr ON lr.trade_id = pm.trade_id AND lr.organization_id = v_org_id
  WHERE te.project_id = p_project_id
    AND te.check_out IS NOT NULL
    AND lr.id IS NULL;

  IF v_hours > 0 THEN
    v_issues := v_issues || jsonb_build_object(
      'id', 'unrated_labor',
      'category', 'finance',
      'severity', 'critical',
      'title', 'Labor cost data missing',
      'description', format('%s time entry(ies) (%sh) have no rate. Financial totals may be understated.', v_entries, ROUND(v_hours::numeric, 1)),
      'action_label', 'Fix labor rates',
      'action_url', '/settings/labor-rates'
    );
  END IF;

  -- 2. Currency mismatch entries
  SELECT
    COALESCE(SUM(EXTRACT(EPOCH FROM (te.check_out - te.check_in)) / 3600.0), 0),
    COUNT(*)
  INTO v_mismatch_hours, v_mismatch_entries
  FROM time_entries te
  JOIN project_members pm ON pm.user_id = te.user_id AND pm.project_id = te.project_id
  JOIN labor_rates lr ON lr.trade_id = pm.trade_id AND lr.organization_id = v_org_id
  WHERE te.project_id = p_project_id
    AND te.check_out IS NOT NULL
    AND v_project_currency IS NOT NULL
    AND lr.currency != v_project_currency;

  IF v_mismatch_entries > 0 THEN
    v_issues := v_issues || jsonb_build_object(
      'id', 'currency_mismatch',
      'category', 'finance',
      'severity', 'critical',
      'title', 'Currency mismatch detected',
      'description', format('%s entry(ies) have rates in a different currency than the project.', v_mismatch_entries),
      'action_label', 'Review labor rates',
      'action_url', '/settings/labor-rates'
    );
  END IF;

  -- 3. No estimate linked (warning)
  SELECT COUNT(*) INTO v_est_count FROM estimates WHERE project_id = p_project_id;
  IF v_est_count = 0 THEN
    v_issues := v_issues || jsonb_build_object(
      'id', 'no_estimate',
      'category', 'finance',
      'severity', 'warning',
      'title', 'No estimate linked',
      'description', 'This project has no estimate. Variance and margin tracking are unavailable.',
      'action_label', 'Create estimate',
      'action_url', '/estimates'
    );
  END IF;

  -- 4. Pending receipts older than 7 days (warning)
  SELECT COUNT(*) INTO v_pending_receipts
  FROM receipts
  WHERE project_id = p_project_id
    AND status = 'pending'
    AND created_at < now() - interval '7 days';

  IF v_pending_receipts > 0 THEN
    v_issues := v_issues || jsonb_build_object(
      'id', 'stale_receipts',
      'category', 'finance',
      'severity', 'warning',
      'title', 'Receipts awaiting review',
      'description', format('%s receipt(s) pending for over 7 days.', v_pending_receipts),
      'action_label', 'Review receipts',
      'action_url', '/receipts'
    );
  END IF;

  -- 5. Overdue tasks (warning)
  SELECT COUNT(*) INTO v_overdue_tasks
  FROM tasks
  WHERE project_id = p_project_id
    AND is_deleted = false
    AND status != 'done'
    AND due_date < CURRENT_DATE;

  IF v_overdue_tasks > 0 THEN
    v_issues := v_issues || jsonb_build_object(
      'id', 'overdue_tasks',
      'category', 'workflow',
      'severity', 'warning',
      'title', 'Overdue tasks',
      'description', format('%s task(s) past due date.', v_overdue_tasks),
      'action_label', 'View tasks',
      'action_url', '/tasks'
    );
  END IF;

  -- 6. Blockers older than 3 days (warning)
  SELECT COUNT(*) INTO v_old_blockers
  FROM blockers
  WHERE is_resolved = false
    AND created_at < now() - interval '3 days'
    AND task_id IN (SELECT id FROM tasks WHERE project_id = p_project_id AND is_deleted = false);

  IF v_old_blockers > 0 THEN
    v_issues := v_issues || jsonb_build_object(
      'id', 'stale_blockers',
      'category', 'workflow',
      'severity', 'warning',
      'title', 'Aging blockers',
      'description', format('%s blocker(s) unresolved for over 3 days.', v_old_blockers),
      'action_label', 'View blockers',
      'action_url', '/tasks?status=blocked'
    );
  END IF;

  -- 7. Safety compliance gap (info)
  DECLARE
    v_log_days bigint;
    v_form_days bigint;
  BEGIN
    SELECT COUNT(DISTINCT log_date) INTO v_log_days
    FROM daily_logs WHERE project_id = p_project_id AND log_date >= CURRENT_DATE - 30;

    SELECT COUNT(DISTINCT DATE(created_at)) INTO v_form_days
    FROM safety_forms WHERE project_id = p_project_id AND is_deleted = false AND created_at >= now() - interval '30 days';

    IF v_log_days > 0 AND v_form_days < v_log_days THEN
      v_safety_gap := ROUND(((v_log_days - v_form_days)::numeric / v_log_days) * 100);
      IF v_safety_gap > 20 THEN
        v_issues := v_issues || jsonb_build_object(
          'id', 'safety_gap',
          'category', 'config',
          'severity', CASE WHEN v_safety_gap > 50 THEN 'warning' ELSE 'info' END,
          'title', 'Safety form coverage gap',
          'description', format('Safety forms filed on %s of %s active days (%s%% gap).', v_form_days, v_log_days, v_safety_gap),
          'action_label', 'View safety',
          'action_url', '/safety'
        );
      END IF;
    END IF;
  END;

  -- 8. Workflow not configured (info)
  SELECT * INTO v_wf FROM project_workflows WHERE project_id = p_project_id;
  IF NOT FOUND THEN
    v_issues := v_issues || jsonb_build_object(
      'id', 'no_workflow',
      'category', 'config',
      'severity', 'info',
      'title', 'Workflow not configured',
      'description', 'Phase-gating is not active for this project.',
      'action_label', 'Configure workflow',
      'action_url', '/workflow'
    );
  END IF;

  RETURN v_issues;
END;
$$;
