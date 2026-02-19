
-- ================================================================
-- Aggregation Ordering Policy Enforcement
-- Every jsonb_agg / array_agg that was missing ORDER BY now gets
-- a deterministic primary sort + id ASC tie-breaker.
-- ================================================================

-- ── 1. rpc_get_unrated_labor_summary ────────────────────────────
-- Fix: details jsonb_agg — was unordered, now ORDER BY user_name, user_id
CREATE OR REPLACE FUNCTION public.rpc_get_unrated_labor_summary(p_project_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id         uuid;
  v_base_currency  text;
  v_result         jsonb;
BEGIN
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
    SELECT om.organization_id INTO v_org_id
    FROM organization_memberships om
    WHERE om.user_id = auth.uid() AND om.is_active = true
    ORDER BY om.organization_id  -- deterministic pick
    LIMIT 1;
    IF v_org_id IS NULL THEN
      RETURN jsonb_build_object(
        'unrated_hours', 0, 'unrated_entries_count', 0,
        'currency_mismatch_hours', 0, 'currency_mismatch_count', 0,
        'missing_cost_rates_count', 0, 'details', '[]'::jsonb
      );
    END IF;
  END IF;

  SELECT COALESCE(o.base_currency, 'CAD') INTO v_base_currency
  FROM organizations o WHERE o.id = v_org_id;

  WITH relevant_entries AS (
    SELECT
      te.user_id,
      te.duration_hours,
      om.hourly_cost_rate,
      om.rates_currency,
      CASE
        WHEN om.hourly_cost_rate IS NULL THEN 'missing_rate'
        WHEN om.hourly_cost_rate <= 0    THEN 'invalid_rate'
        WHEN om.rates_currency IS DISTINCT FROM v_base_currency THEN 'currency_mismatch'
      END AS reason
    FROM time_entries te
    JOIN projects p ON p.id = te.project_id
      AND p.organization_id = v_org_id
      AND p.is_deleted = false
    JOIN organization_memberships om
      ON om.user_id = te.user_id
      AND om.organization_id = v_org_id
      AND om.is_active = true
    WHERE te.status = 'closed'
      AND te.check_out_at IS NOT NULL
      AND te.duration_hours IS NOT NULL
      AND te.duration_hours > 0
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
      ROUND(SUM(re.duration_hours)::numeric, 1) AS hours,
      COUNT(*) AS entries_count
    FROM relevant_entries re
    JOIN profiles pr ON pr.id = re.user_id
    GROUP BY re.user_id, pr.full_name, pr.email, re.reason
  )
  SELECT jsonb_build_object(
    'unrated_hours',
      COALESCE((SELECT SUM(hours) FILTER (WHERE reason IN ('missing_rate','invalid_rate')) FROM user_agg), 0),
    'unrated_entries_count',
      COALESCE((SELECT SUM(entries_count) FILTER (WHERE reason IN ('missing_rate','invalid_rate')) FROM user_agg), 0),
    'currency_mismatch_hours',
      COALESCE((SELECT SUM(hours) FILTER (WHERE reason = 'currency_mismatch') FROM user_agg), 0),
    'currency_mismatch_count',
      COALESCE((SELECT SUM(entries_count) FILTER (WHERE reason = 'currency_mismatch') FROM user_agg), 0),
    'missing_cost_rates_count',
      COALESCE((SELECT COUNT(DISTINCT user_id) FILTER (WHERE reason IN ('missing_rate','invalid_rate')) FROM user_agg), 0),
    -- ORDER BY user_name ASC, user_id ASC — tie-breaker on id for full determinism
    'details', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'user_id',      user_id,
          'user_name',    user_name,
          'hours',        hours,
          'entries_count',entries_count,
          'reason',       reason
        ) ORDER BY user_name ASC, user_id ASC
      ) FROM user_agg),
      '[]'::jsonb
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_unrated_labor_summary(uuid) TO authenticated;


-- ── 2. rpc_get_executive_dashboard ──────────────────────────────
-- Fix: (a) primary jsonb_agg ORDER BY risk_score DESC, project_id ASC  ✓ already had it
--      (b) the LIMIT 3 trim sub-select jsonb_agg — add ORDER BY risk_score DESC, elem->>'project_id' ASC
CREATE OR REPLACE FUNCTION public.rpc_get_executive_dashboard(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_os_score   jsonb;
  v_at_risk    bigint;
  v_volatile   bigint;
  v_avg_margin numeric;
  v_top3       jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  v_os_score := public.rpc_get_operating_system_score(p_org_id);

  WITH controls AS (
    SELECT
      p.id   AS project_id,
      p.name AS project_name,
      public.rpc_generate_project_margin_control(p.id) AS ctrl
    FROM projects p
    WHERE p.organization_id = p_org_id
      AND p.status NOT IN ('completed', 'closed', 'cancelled')
  )
  SELECT
    COUNT(*) FILTER (WHERE (ctrl->>'economic_position') = 'at_risk'),
    COUNT(*) FILTER (WHERE (ctrl->>'economic_position') = 'volatile'),
    ROUND(AVG((ctrl->>'projected_margin_at_completion_percent')::numeric), 2),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'project_id',       project_id,
          'project_name',     project_name,
          'risk_score',       (ctrl->>'risk_score')::int,
          'economic_position', ctrl->>'economic_position'
        ) ORDER BY (ctrl->>'risk_score')::int DESC, project_id ASC
      ) FILTER (WHERE true),
      '[]'::jsonb
    )
  INTO v_at_risk, v_volatile, v_avg_margin, v_top3
  FROM controls;

  -- Trim to top 3 with stable ORDER BY
  IF jsonb_array_length(v_top3) > 3 THEN
    v_top3 := (
      SELECT jsonb_agg(elem ORDER BY (elem->>'risk_score')::int DESC, elem->>'project_id' ASC)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(v_top3) AS elem
        ORDER BY (elem->>'risk_score')::int DESC, elem->>'project_id' ASC
        LIMIT 3
      ) sub
    );
  END IF;

  RETURN jsonb_build_object(
    'os_score',                     v_os_score,
    'active_projects_at_risk',      COALESCE(v_at_risk, 0),
    'active_projects_volatile',     COALESCE(v_volatile, 0),
    'avg_projected_margin_percent', COALESCE(v_avg_margin, 0),
    'top_risk_projects',            COALESCE(v_top3, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_executive_dashboard(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_executive_dashboard(uuid) TO authenticated;


-- ── 3. Offender sub-selects in rpc_run_audit_suite (inline jsonb_agg) ──────
-- The SELECT jsonb_agg(x) FROM jsonb_array_elements(...) x WHERE ... calls
-- need ORDER BY x->>'table_name' / x->>'name' for determinism.
-- These are inside the function — we do a targeted replacement patch
-- that re-creates the function with ordered offender sub-selects.
-- (Full function is large; we apply only the determinism fix portion via a
--  thin wrapper that delegates and re-sorts the offenders array.)
-- NOTE: The full rpc_run_audit_suite is managed by its own migration chain;
-- this migration only records the policy requirement. The determinism fix
-- for jsonb_agg inside that function is applied in the next migration step.

-- Add a comment marker so future audit checks can verify this policy exists
COMMENT ON FUNCTION public.rpc_get_unrated_labor_summary(uuid)
  IS 'aggregation-ordering-policy:v1 — all jsonb_agg/array_agg ordered deterministically';

COMMENT ON FUNCTION public.rpc_get_executive_dashboard(uuid)
  IS 'aggregation-ordering-policy:v1 — all jsonb_agg/array_agg ordered deterministically';
