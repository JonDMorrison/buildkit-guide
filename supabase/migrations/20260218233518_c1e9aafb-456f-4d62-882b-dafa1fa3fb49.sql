
CREATE OR REPLACE FUNCTION public.rpc_get_unrated_labor_summary(p_project_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_base_currency text;
  v_result jsonb;
BEGIN
  -- Resolve org from project or from caller's active membership
  IF p_project_id IS NOT NULL THEN
    SELECT p.organization_id INTO v_org_id
    FROM projects p WHERE p.id = p_project_id AND p.is_deleted = false;

    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501';
    END IF;

    IF NOT public.has_org_membership(v_org_id) THEN
      RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
    END IF;
  ELSE
    -- Org-level: pick first active membership for caller
    SELECT om.organization_id INTO v_org_id
    FROM organization_memberships om
    WHERE om.user_id = auth.uid() AND om.is_active = true
    LIMIT 1;

    IF v_org_id IS NULL THEN
      RETURN jsonb_build_object(
        'unrated_hours', 0,
        'unrated_entries_count', 0,
        'currency_mismatch_hours', 0,
        'currency_mismatch_count', 0,
        'missing_cost_rates_count', 0,
        'details', '[]'::jsonb
      );
    END IF;
  END IF;

  SELECT COALESCE(o.base_currency, 'CAD') INTO v_base_currency
  FROM organizations o WHERE o.id = v_org_id;

  WITH relevant_entries AS (
    SELECT
      te.user_id,
      te.duration_minutes,
      om.hourly_cost_rate,
      om.rates_currency,
      CASE
        WHEN om.hourly_cost_rate IS NULL THEN 'missing_rate'
        WHEN om.hourly_cost_rate <= 0 THEN 'invalid_rate'
        WHEN om.rates_currency IS DISTINCT FROM v_base_currency THEN 'currency_mismatch'
      END AS reason
    FROM time_entries te
    JOIN projects p ON p.id = te.project_id AND p.organization_id = v_org_id AND p.is_deleted = false
    JOIN organization_memberships om ON om.user_id = te.user_id AND om.organization_id = v_org_id AND om.is_active = true
    WHERE te.check_out IS NOT NULL
      AND te.duration_minutes > 0
      AND (p_project_id IS NULL OR te.project_id = p_project_id)
      AND (
        om.hourly_cost_rate IS NULL
        OR om.hourly_cost_rate <= 0
        OR om.rates_currency IS DISTINCT FROM v_base_currency
      )
  ),
  user_agg AS (
    SELECT
      re.user_id,
      COALESCE(pr.full_name, pr.email, 'Unknown') AS user_name,
      re.reason,
      ROUND(SUM(re.duration_minutes) / 60.0, 1) AS hours,
      COUNT(*) AS entries_count
    FROM relevant_entries re
    JOIN profiles pr ON pr.id = re.user_id
    GROUP BY re.user_id, pr.full_name, pr.email, re.reason
  )
  SELECT jsonb_build_object(
    'unrated_hours', COALESCE((SELECT SUM(hours) FILTER (WHERE reason IN ('missing_rate','invalid_rate')) FROM user_agg), 0),
    'unrated_entries_count', COALESCE((SELECT SUM(entries_count) FILTER (WHERE reason IN ('missing_rate','invalid_rate')) FROM user_agg), 0),
    'currency_mismatch_hours', COALESCE((SELECT SUM(hours) FILTER (WHERE reason = 'currency_mismatch') FROM user_agg), 0),
    'currency_mismatch_count', COALESCE((SELECT SUM(entries_count) FILTER (WHERE reason = 'currency_mismatch') FROM user_agg), 0),
    'missing_cost_rates_count', COALESCE((SELECT COUNT(DISTINCT user_id) FILTER (WHERE reason IN ('missing_rate','invalid_rate')) FROM user_agg), 0),
    'details', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'user_id', user_id,
      'user_name', user_name,
      'hours', hours,
      'entries_count', entries_count,
      'reason', reason
    )) FROM user_agg), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
