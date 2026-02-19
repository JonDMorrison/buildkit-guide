
-- ================================================================
-- rpc_run_margin_control_edge_cases
-- SECURITY DEFINER | pinned search_path | deterministic | read-only
-- Runs rpc_generate_project_margin_control against four canonical
-- edge-case project scenarios for a given organization.
-- ================================================================

CREATE OR REPLACE FUNCTION public.rpc_run_margin_control_edge_cases(
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid            uuid := auth.uid();
  v_scenario_a_id  uuid := NULL;
  v_scenario_b_id  uuid := NULL;
  v_scenario_c_id  uuid := NULL;
  v_scenario_d_id  uuid := NULL;
  v_results        jsonb := '[]'::jsonb;
  v_payload        jsonb;
  v_err_state      text;
  v_err_msg        text;
BEGIN

  -- ── Auth guard ──────────────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_authenticated_user');
  END IF;

  -- ── Membership guard ────────────────────────────────────────────────────
  -- Uses same canonical check as all other financial RPCs
  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  -- ── Scenario A: no_estimate_selected ────────────────────────────────────
  -- Project where no estimate exists, or none with is_selected = true.
  -- Deterministic: ORDER BY p.id ASC → first qualifying project.
  SELECT p.id
  INTO   v_scenario_a_id
  FROM   projects p
  WHERE  p.organization_id = p_org_id
    AND  p.is_deleted = false
    AND  p.status NOT IN ('completed', 'closed', 'cancelled')
    AND  NOT EXISTS (
           SELECT 1 FROM estimates e
           WHERE  e.project_id = p.id
             AND  e.status = 'approved'   -- is_selected equivalent: approved estimates
         )
  ORDER BY p.id ASC
  LIMIT 1;

  -- ── Scenario B: estimate_selected_no_time_entries ────────────────────────
  -- Project with an approved estimate (total > 0) and zero closed/locked time entries.
  SELECT p.id
  INTO   v_scenario_b_id
  FROM   projects p
  JOIN   estimates e ON e.project_id = p.id
                     AND e.status = 'approved'
                     AND e.contract_value > 0
  WHERE  p.organization_id = p_org_id
    AND  p.is_deleted = false
    AND  p.status NOT IN ('completed', 'closed', 'cancelled')
    AND  NOT EXISTS (
           SELECT 1 FROM time_entries te
           WHERE  te.project_id = p.id
             AND  te.status IN ('closed', 'approved', 'locked', 'posted')
         )
  ORDER BY p.id ASC
  LIMIT 1;

  -- ── Scenario C: zero_projected_revenue ───────────────────────────────────
  -- Project where v_project_economic_snapshot shows null or zero revenue.
  SELECT snap.project_id
  INTO   v_scenario_c_id
  FROM   v_project_economic_snapshot snap
  JOIN   projects p ON p.id = snap.project_id
  WHERE  p.organization_id = p_org_id
    AND  p.is_deleted = false
    AND  p.status NOT IN ('completed', 'closed', 'cancelled')
    AND  (snap.projected_revenue IS NULL OR snap.projected_revenue = 0)
  ORDER BY snap.project_id ASC
  LIMIT 1;

  -- ── Scenario D: has_change_orders ────────────────────────────────────────
  -- Project with at least one approved or completed change order.
  SELECT p.id
  INTO   v_scenario_d_id
  FROM   projects p
  WHERE  p.organization_id = p_org_id
    AND  p.is_deleted = false
    AND  p.status NOT IN ('completed', 'closed', 'cancelled')
    AND  EXISTS (
           SELECT 1 FROM change_orders co
           WHERE  co.project_id = p.id
             AND  co.status IN ('approved', 'completed')
         )
  ORDER BY p.id ASC
  LIMIT 1;

  -- ── Run rpc_generate_project_margin_control per scenario ─────────────────
  -- Helper block macro — repeated for each of the 4 scenarios.
  -- ORDER of results in array is fixed: A, B, C, D.

  -- Scenario A
  IF v_scenario_a_id IS NULL THEN
    v_results := v_results || jsonb_build_object(
      'scenario',   'no_estimate_selected',
      'found',      false,
      'reason',     'no_matching_project'
    );
  ELSE
    BEGIN
      v_payload   := NULL;
      v_err_state := NULL;
      v_err_msg   := NULL;
      v_payload   := public.rpc_generate_project_margin_control(v_scenario_a_id);
      v_results   := v_results || jsonb_build_object(
        'scenario',    'no_estimate_selected',
        'found',       true,
        'project_id',  v_scenario_a_id,
        'success',     true,
        'payload',     v_payload
      );
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE,
                              v_err_msg   = MESSAGE_TEXT;
      v_results := v_results || jsonb_build_object(
        'scenario',   'no_estimate_selected',
        'found',      true,
        'project_id', v_scenario_a_id,
        'success',    false,
        'error',      jsonb_build_object('sqlstate', v_err_state, 'message', v_err_msg)
      );
    END;
  END IF;

  -- Scenario B
  IF v_scenario_b_id IS NULL THEN
    v_results := v_results || jsonb_build_object(
      'scenario',   'estimate_selected_no_time_entries',
      'found',      false,
      'reason',     'no_matching_project'
    );
  ELSE
    BEGIN
      v_payload   := NULL;
      v_err_state := NULL;
      v_err_msg   := NULL;
      v_payload   := public.rpc_generate_project_margin_control(v_scenario_b_id);
      v_results   := v_results || jsonb_build_object(
        'scenario',    'estimate_selected_no_time_entries',
        'found',       true,
        'project_id',  v_scenario_b_id,
        'success',     true,
        'payload',     v_payload
      );
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE,
                              v_err_msg   = MESSAGE_TEXT;
      v_results := v_results || jsonb_build_object(
        'scenario',   'estimate_selected_no_time_entries',
        'found',      true,
        'project_id', v_scenario_b_id,
        'success',    false,
        'error',      jsonb_build_object('sqlstate', v_err_state, 'message', v_err_msg)
      );
    END;
  END IF;

  -- Scenario C
  IF v_scenario_c_id IS NULL THEN
    v_results := v_results || jsonb_build_object(
      'scenario',   'zero_projected_revenue',
      'found',      false,
      'reason',     'no_matching_project'
    );
  ELSE
    BEGIN
      v_payload   := NULL;
      v_err_state := NULL;
      v_err_msg   := NULL;
      v_payload   := public.rpc_generate_project_margin_control(v_scenario_c_id);
      v_results   := v_results || jsonb_build_object(
        'scenario',    'zero_projected_revenue',
        'found',       true,
        'project_id',  v_scenario_c_id,
        'success',     true,
        'payload',     v_payload
      );
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE,
                              v_err_msg   = MESSAGE_TEXT;
      v_results := v_results || jsonb_build_object(
        'scenario',   'zero_projected_revenue',
        'found',      true,
        'project_id', v_scenario_c_id,
        'success',    false,
        'error',      jsonb_build_object('sqlstate', v_err_state, 'message', v_err_msg)
      );
    END;
  END IF;

  -- Scenario D
  IF v_scenario_d_id IS NULL THEN
    v_results := v_results || jsonb_build_object(
      'scenario',   'has_change_orders',
      'found',      false,
      'reason',     'no_matching_project'
    );
  ELSE
    BEGIN
      v_payload   := NULL;
      v_err_state := NULL;
      v_err_msg   := NULL;
      v_payload   := public.rpc_generate_project_margin_control(v_scenario_d_id);
      v_results   := v_results || jsonb_build_object(
        'scenario',    'has_change_orders',
        'found',       true,
        'project_id',  v_scenario_d_id,
        'success',     true,
        'payload',     v_payload
      );
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE,
                              v_err_msg   = MESSAGE_TEXT;
      v_results := v_results || jsonb_build_object(
        'scenario',   'has_change_orders',
        'found',      true,
        'project_id', v_scenario_d_id,
        'success',    false,
        'error',      jsonb_build_object('sqlstate', v_err_state, 'message', v_err_msg)
      );
    END;
  END IF;

  -- ── Final envelope ───────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok',      true,
    'org_id',  p_org_id,
    'user_id', v_uid,
    'results', v_results
  );

END;
$$;

-- ── Privilege hardening ──────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.rpc_run_margin_control_edge_cases(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_run_margin_control_edge_cases(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.rpc_run_margin_control_edge_cases(uuid) TO authenticated;

COMMENT ON FUNCTION public.rpc_run_margin_control_edge_cases(uuid)
  IS 'Authenticated edge-case scenario runner for rpc_generate_project_margin_control. SECURITY DEFINER. Read-only. Deterministic. aggregation-ordering-policy:v1';
