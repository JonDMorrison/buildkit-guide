
-- ================================================================
-- rpc_get_project_action_panel
-- Read-only. SECURITY DEFINER. Pinned search_path.
-- PM-facing control surface: risk score + deterministic actions.
-- ================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_project_action_panel(
  p_project_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id          uuid;
  v_margin_ctrl     jsonb;
  v_risk_score      int;
  v_position        text;
  v_priority        int;
  v_flags           jsonb;
  v_flag            text;
  v_actions         jsonb := '[]'::jsonb;
  v_guardrail_mode  text;

  -- Action map: flag -> (key, label, severity, explanation)
  -- Applied in deterministic flag order (alphabetical within FOREACH)
BEGIN
  -- ── Auth + membership ─────────────────────────────────────────
  SELECT organization_id INTO v_org_id
  FROM projects WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501';
  END IF;

  IF NOT public.rpc_is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  -- ── Margin control engine ─────────────────────────────────────
  v_margin_ctrl := public.rpc_generate_project_margin_control(p_project_id);

  v_risk_score := COALESCE((v_margin_ctrl->>'risk_score')::int, 0);
  v_position   := COALESCE(v_margin_ctrl->>'economic_position', 'stable');
  v_priority   := COALESCE((v_margin_ctrl->>'intervention_priority')::int, 1);
  v_flags      := COALESCE(v_margin_ctrl->'intervention_flags', '[]'::jsonb);

  -- ── Guardrail mode ────────────────────────────────────────────
  v_guardrail_mode := CASE
    WHEN v_risk_score >= 60 THEN 'block'
    WHEN v_risk_score >= 30 THEN 'warn'
    ELSE                        'none'
  END;

  -- ── Flag → Action mapping (deterministic: alphabetical key order) ──
  -- We collect all flags first, then emit actions sorted by key ASC
  -- so the output array is stable regardless of flag arrival order.

  WITH flag_actions AS (
    SELECT
      CASE flag
        WHEN 'below_low_band'     THEN 'below_historical_band'
        WHEN 'labor_burn_high'    THEN 'labor_checkin_approval'
        WHEN 'low_historical_data' THEN 'cost_review_phase'
        WHEN 'margin_declining'   THEN 'change_order_review'
        ELSE 'generic_review_' || flag
      END AS action_key,
      CASE flag
        WHEN 'below_low_band'     THEN 'Require Margin Band Review'
        WHEN 'labor_burn_high'    THEN 'Require Labor Check-in Approval'
        WHEN 'low_historical_data' THEN 'Require Cost Review Phase'
        WHEN 'margin_declining'   THEN 'Require Change Order Review'
        ELSE 'Review: ' || replace(flag, '_', ' ')
      END AS action_label,
      CASE flag
        WHEN 'below_low_band'     THEN 'high'
        WHEN 'labor_burn_high'    THEN 'high'
        WHEN 'low_historical_data' THEN 'medium'
        WHEN 'margin_declining'   THEN 'high'
        ELSE                          'medium'
      END AS severity,
      CASE flag
        WHEN 'below_low_band'     THEN 'Realized margin is below the organization historical low band. Schedule a formal margin review before next billing cycle.'
        WHEN 'labor_burn_high'    THEN 'Labor costs are burning faster than the project benchmark. All time entries require PM sign-off until resolved.'
        WHEN 'low_historical_data' THEN 'Insufficient historical data to produce reliable projections. A mandatory cost review phase is recommended.'
        WHEN 'margin_declining'   THEN 'Margin trajectory is declining week-over-week. Any change order above threshold requires director review.'
        ELSE                          'Investigate flag: ' || replace(flag, '_', ' ') || ' and apply corrective action.'
      END AS explanation,
      flag
    FROM jsonb_array_elements_text(v_flags) AS flag
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key',         action_key,
        'label',       action_label,
        'severity',    severity,
        'explanation', explanation
      )
      ORDER BY action_key ASC   -- deterministic output
    ),
    '[]'::jsonb
  )
  INTO v_actions
  FROM flag_actions;

  RETURN jsonb_build_object(
    'project_id',              p_project_id,
    'risk_score',              v_risk_score,
    'economic_position',       v_position,
    'intervention_priority',   v_priority,
    'intervention_flags',      v_flags,
    'required_actions',        v_actions,
    'recommended_guardrail_mode', v_guardrail_mode
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_project_action_panel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_project_action_panel(uuid) TO authenticated;
