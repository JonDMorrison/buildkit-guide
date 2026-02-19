
-- ================================================================
-- rpc_run_ai_brain_scenario_suite
-- Read-only. SECURITY DEFINER. Pinned search_path.
-- Picks up to 6 edge-case projects for an org and runs
-- rpc_generate_project_margin_control against each.
-- ================================================================
CREATE OR REPLACE FUNCTION public.rpc_run_ai_brain_scenario_suite(
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_member boolean := false;
  v_scenarios jsonb := '[]'::jsonb;
  v_project_id uuid;
  v_label text;
  v_margin_result jsonb;
  v_error_state text;
  v_error_msg text;
  v_all_ok boolean := true;

  -- Scenario project IDs (may be null if no match)
  v_pid_no_estimate uuid;
  v_pid_no_time_entries uuid;
  v_pid_zero_revenue uuid;
  v_pid_has_change_orders uuid;
  v_pid_closed uuid;
  v_pid_active uuid;

BEGIN
  -- ── 1. Membership guard ────────────────────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = p_org_id
      AND user_id = v_uid
      AND is_active = true
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Not authorized for org %', p_org_id
      USING ERRCODE = '42501';
  END IF;

  -- ── 2. Deterministic project selection (ORDER BY id ASC) ───────

  -- Scenario A: no estimate
  SELECT p.id INTO v_pid_no_estimate
  FROM projects p
  WHERE p.organization_id = p_org_id
    AND NOT EXISTS (SELECT 1 FROM estimates e WHERE e.project_id = p.id)
  ORDER BY p.id ASC
  LIMIT 1;

  -- Scenario B: estimate exists but no time entries
  SELECT p.id INTO v_pid_no_time_entries
  FROM projects p
  WHERE p.organization_id = p_org_id
    AND EXISTS     (SELECT 1 FROM estimates e WHERE e.project_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM time_entries te WHERE te.project_id = p.id)
    AND p.id IS DISTINCT FROM v_pid_no_estimate
  ORDER BY p.id ASC
  LIMIT 1;

  -- Scenario C: time entries exist but projected_revenue is 0 or null
  SELECT p.id INTO v_pid_zero_revenue
  FROM projects p
  WHERE p.organization_id = p_org_id
    AND EXISTS (SELECT 1 FROM time_entries te WHERE te.project_id = p.id)
    AND p.id IS DISTINCT FROM v_pid_no_estimate
    AND p.id IS DISTINCT FROM v_pid_no_time_entries
    AND (
      NOT EXISTS (SELECT 1 FROM estimates e WHERE e.project_id = p.id AND e.contract_value > 0)
    )
  ORDER BY p.id ASC
  LIMIT 1;

  -- Scenario D: has at least one approved change order
  SELECT p.id INTO v_pid_has_change_orders
  FROM projects p
  WHERE p.organization_id = p_org_id
    AND EXISTS (
      SELECT 1 FROM change_orders co
      WHERE co.project_id = p.id AND co.status = 'approved'
    )
    AND p.id IS DISTINCT FROM v_pid_no_estimate
    AND p.id IS DISTINCT FROM v_pid_no_time_entries
    AND p.id IS DISTINCT FROM v_pid_zero_revenue
  ORDER BY p.id ASC
  LIMIT 1;

  -- Scenario E: completed / closed project
  SELECT p.id INTO v_pid_closed
  FROM projects p
  WHERE p.organization_id = p_org_id
    AND p.status IN ('completed', 'closed', 'archived')
    AND p.id IS DISTINCT FROM v_pid_no_estimate
    AND p.id IS DISTINCT FROM v_pid_no_time_entries
    AND p.id IS DISTINCT FROM v_pid_zero_revenue
    AND p.id IS DISTINCT FROM v_pid_has_change_orders
  ORDER BY p.id ASC
  LIMIT 1;

  -- Scenario F: any active project (fall-through / control)
  SELECT p.id INTO v_pid_active
  FROM projects p
  WHERE p.organization_id = p_org_id
    AND p.status = 'active'
    AND p.id IS DISTINCT FROM v_pid_no_estimate
    AND p.id IS DISTINCT FROM v_pid_no_time_entries
    AND p.id IS DISTINCT FROM v_pid_zero_revenue
    AND p.id IS DISTINCT FROM v_pid_has_change_orders
    AND p.id IS DISTINCT FROM v_pid_closed
  ORDER BY p.id ASC
  LIMIT 1;

  -- ── 3. Run margin control for each non-null scenario ───────────
  FOR v_project_id, v_label IN
    SELECT pid, lbl FROM (VALUES
      (v_pid_no_estimate,       'no_estimate'),
      (v_pid_no_time_entries,   'estimate_no_time_entries'),
      (v_pid_zero_revenue,      'zero_projected_revenue'),
      (v_pid_has_change_orders, 'has_approved_change_orders'),
      (v_pid_closed,            'completed_or_closed'),
      (v_pid_active,            'active_control')
    ) AS t(pid, lbl)
    WHERE pid IS NOT NULL
    ORDER BY lbl ASC   -- deterministic
  LOOP
    BEGIN
      v_margin_result := public.rpc_generate_project_margin_control(v_project_id);

      v_scenarios := v_scenarios || jsonb_build_object(
        'scenario',    v_label,
        'project_id',  v_project_id,
        'success',     true,
        'ok',          COALESCE((v_margin_result->>'ok')::boolean, true),
        'payload',     v_margin_result,
        'error',       NULL
      );

      -- If the control RPC itself says not ok, mark suite not-ok
      IF NOT COALESCE((v_margin_result->>'ok')::boolean, true) THEN
        v_all_ok := false;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_error_state := SQLSTATE;
      v_error_msg   := SQLERRM;
      v_all_ok := false;

      v_scenarios := v_scenarios || jsonb_build_object(
        'scenario',    v_label,
        'project_id',  v_project_id,
        'success',     false,
        'ok',          false,
        'payload',     NULL,
        'error',       jsonb_build_object('sqlstate', v_error_state, 'message', v_error_msg)
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok',        v_all_ok,
    'org_id',    p_org_id,
    'scenarios', v_scenarios
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_run_ai_brain_scenario_suite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_run_ai_brain_scenario_suite(uuid) TO authenticated;
