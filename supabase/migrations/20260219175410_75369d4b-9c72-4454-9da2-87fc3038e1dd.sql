
-- ── rpc_get_project_action_panel ────────────────────────────────────────────
-- SECURITY DEFINER RPC that assembles the action-panel payload for one project.
-- Resolves org_id from the project, enforces membership via the canonical
-- rpc_is_org_member function, calls rpc_generate_project_margin_control for
-- the margin-control payload, then maps intervention_flags → required_actions.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_get_project_action_panel(
  p_project_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_org_id             uuid;
  v_margin_result      jsonb;
  v_risk_score         int;
  v_economic_position  text;
  v_intervention_pri   int;
  v_intervention_flags jsonb;
  v_guardrail          text;
  v_executive_summary  text;

  -- required-actions accumulator
  v_actions            jsonb := '[]'::jsonb;
  v_flag               text;
  v_action             jsonb;
BEGIN
  -- ── 1. Resolve org_id from project ──────────────────────────────────────
  SELECT organization_id
    INTO v_org_id
    FROM public.projects
   WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  -- ── 2. Enforce org membership ────────────────────────────────────────────
  IF NOT public.rpc_is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'not_authorized'
      USING ERRCODE = '42501';
  END IF;

  -- ── 3. Call margin-control engine ────────────────────────────────────────
  v_margin_result := public.rpc_generate_project_margin_control(p_project_id);

  v_risk_score        := (v_margin_result ->> 'risk_score')::int;
  v_economic_position := v_margin_result ->> 'economic_position';
  v_intervention_pri  := (v_margin_result ->> 'intervention_priority')::int;
  v_executive_summary := v_margin_result ->> 'executive_summary';

  -- Normalise intervention_flags: accept both 'intervention_flags' and
  -- 'guardrail_recommendation' keys that the engine may return.
  v_intervention_flags := COALESCE(
    v_margin_result -> 'intervention_flags',
    '[]'::jsonb
  );

  -- Derive guardrail mode from risk_score (mirrors the engine's own logic):
  --   risk_score > 60  → block
  --   risk_score >= 30 → warn
  --   otherwise        → none
  v_guardrail := CASE
    WHEN v_risk_score > 60  THEN 'block'
    WHEN v_risk_score >= 30 THEN 'warn'
    ELSE 'none'
  END;

  -- Override with explicit guardrail_recommendation if present in payload.
  IF (v_margin_result ->> 'guardrail_recommendation') IS NOT NULL THEN
    v_guardrail := v_margin_result ->> 'guardrail_recommendation';
  END IF;

  -- ── 4. Map intervention_flags → required_actions ─────────────────────────
  FOR v_flag IN
    SELECT value::text
      FROM jsonb_array_elements_text(v_intervention_flags)
     ORDER BY 1 ASC          -- iterate in stable order; final sort done below
  LOOP
    v_action := CASE v_flag
      WHEN 'low_historical_data' THEN jsonb_build_object(
        'key',         'require_cost_review_phase',
        'label',       'Cost Review Phase Required',
        'severity',    'medium',
        'explanation', 'Limited margin history; enforce a structured cost review to prevent blind spots.'
      )
      WHEN 'margin_declining' THEN jsonb_build_object(
        'key',         'require_change_order_review',
        'label',       'Change Order Review Required',
        'severity',    'high',
        'explanation', 'Margin is trending below safe band; tighten change order discipline.'
      )
      WHEN 'labor_burn_exceeding_benchmark' THEN jsonb_build_object(
        'key',         'require_labor_checkin_approval',
        'label',       'Labor Check-in Approval Required',
        'severity',    'high',
        'explanation', 'Labor burn is above benchmark; require approval on time entry or daily labor review.'
      )
      WHEN 'quote_approval_misses' THEN jsonb_build_object(
        'key',         'require_quote_approved',
        'label',       'Quote Approval Required',
        'severity',    'high',
        'explanation', 'Repeated approval misses; prevent unapproved work from starting.'
      )
      ELSE jsonb_build_object(
        'key',         'review_required',
        'label',       'Review Required',
        'severity',    'medium',
        'explanation', 'Risk signal detected; review financial controls.'
      )
    END;

    v_actions := v_actions || jsonb_build_array(v_action);
  END LOOP;

  -- ── 5. Sort required_actions: severity high→medium→low, then key ASC ─────
  SELECT jsonb_agg(a ORDER BY
           CASE a->>'severity'
             WHEN 'high'   THEN 1
             WHEN 'medium' THEN 2
             WHEN 'low'    THEN 3
             ELSE               4
           END ASC,
           (a->>'key') ASC
         )
    INTO v_actions
    FROM jsonb_array_elements(v_actions) AS a;

  v_actions := COALESCE(v_actions, '[]'::jsonb);

  -- ── 6. Build and return final payload ────────────────────────────────────
  RETURN jsonb_build_object(
    'project_id',                p_project_id,
    'risk_score',                v_risk_score,
    'economic_position',         v_economic_position,
    'intervention_priority',     v_intervention_pri,
    'intervention_flags',        v_intervention_flags,
    'required_actions',          v_actions,
    'recommended_guardrail_mode', v_guardrail,
    'executive_summary',         v_executive_summary
  );
END;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.rpc_get_project_action_panel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_project_action_panel(uuid) TO authenticated;
