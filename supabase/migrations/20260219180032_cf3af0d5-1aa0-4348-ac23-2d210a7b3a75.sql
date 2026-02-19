
-- ================================================================
-- rpc_get_project_action_panel  (canonical-flags:v3)
--
-- Changes from v2:
--   1. Mapping covers ONLY the four canonical keys that
--      rpc_generate_project_margin_control can now emit
--      (post flag-normalization:v2). No alternate/legacy keys.
--   2. Unknown flags still produce a safe generic action so the
--      function never silently swallows a new flag that is added
--      to the engine in the future.
--   3. Ordering contract made explicit in comments:
--        required_actions ORDER BY severity_rank ASC, key ASC
--        (high=1, medium=2, low=3, unknown=4)
--   4. STABLE annotation added (no side-effects, no writes).
-- ================================================================

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
  v_sorted_flags       jsonb;
  v_guardrail          text;
  v_executive_summary  text;

  v_actions            jsonb := '[]'::jsonb;
  v_flag               text;
  v_action             jsonb;
BEGIN
  -- ── 1. Resolve org_id ────────────────────────────────────────
  SELECT organization_id
    INTO v_org_id
    FROM public.projects
   WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- ── 2. Enforce membership ────────────────────────────────────
  IF NOT public.rpc_is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 3. Margin engine ─────────────────────────────────────────
  v_margin_result := public.rpc_generate_project_margin_control(p_project_id);

  v_risk_score        := COALESCE((v_margin_result ->> 'risk_score')::int, 0);
  v_economic_position := COALESCE(v_margin_result ->> 'economic_position', 'unknown');
  v_intervention_pri  := COALESCE((v_margin_result ->> 'intervention_priority')::int, 0);
  v_executive_summary := COALESCE(v_margin_result ->> 'executive_summary', '');

  v_intervention_flags := COALESCE(
    v_margin_result -> 'intervention_flags',
    '[]'::jsonb
  );

  -- ── 4. Sort intervention_flags ASC (determinism) ─────────────
  SELECT COALESCE(jsonb_agg(f ORDER BY f ASC), '[]'::jsonb)
    INTO v_sorted_flags
    FROM jsonb_array_elements_text(v_intervention_flags) AS f;

  -- ── 5. Guardrail mode ────────────────────────────────────────
  --   Derive from risk_score; override with engine value if explicit.
  v_guardrail := CASE
    WHEN v_risk_score > 60  THEN 'block'
    WHEN v_risk_score >= 30 THEN 'warn'
    ELSE                         'none'
  END;

  IF (v_margin_result ->> 'guardrail_recommendation') IS NOT NULL THEN
    v_guardrail := v_margin_result ->> 'guardrail_recommendation';
  END IF;

  -- ── 6. Map canonical flags → required_actions ────────────────
  --
  --  Canonical keys (from rpc_get_margin_flag_dictionary()):
  --    labor_burn_exceeding_benchmark  severity: high
  --    low_historical_data             severity: medium
  --    margin_declining                severity: high
  --    quote_approval_misses           severity: high
  --
  --  Iterate in flag-sorted order; final sort on v_actions below.

  FOR v_flag IN
    SELECT value::text
      FROM jsonb_array_elements_text(v_sorted_flags)
     ORDER BY 1 ASC
  LOOP
    v_action := CASE v_flag

      -- ── Canonical: labor_burn_exceeding_benchmark ────────────
      WHEN 'labor_burn_exceeding_benchmark' THEN jsonb_build_object(
        'key',         'require_labor_checkin_approval',
        'label',       'Labor Check-in Approval Required',
        'severity',    'high',
        'explanation', 'Labor burn is above benchmark; require approval on time entry or daily labor review.'
      )

      -- ── Canonical: low_historical_data ──────────────────────
      WHEN 'low_historical_data' THEN jsonb_build_object(
        'key',         'require_cost_review_phase',
        'label',       'Cost Review Phase Required',
        'severity',    'medium',
        'explanation', 'Limited margin history; enforce a structured cost review to prevent blind spots.'
      )

      -- ── Canonical: margin_declining ─────────────────────────
      WHEN 'margin_declining' THEN jsonb_build_object(
        'key',         'require_change_order_review',
        'label',       'Change Order Review Required',
        'severity',    'high',
        'explanation', 'Margin is trending below safe band; tighten change order discipline.'
      )

      -- ── Canonical: quote_approval_misses ────────────────────
      WHEN 'quote_approval_misses' THEN jsonb_build_object(
        'key',         'require_quote_approved',
        'label',       'Quote Approval Required',
        'severity',    'high',
        'explanation', 'Repeated approval misses; prevent unapproved work from starting.'
      )

      -- ── Safety net: forward-compatible unknown flag ──────────
      --   Keeps the function non-breaking if the engine grows a
      --   new flag before this RPC is updated.
      ELSE jsonb_build_object(
        'key',         'review_required',
        'label',       'Review Required',
        'severity',    'medium',
        'explanation', 'Risk signal detected; review financial controls.'
      )
    END;

    v_actions := v_actions || jsonb_build_array(v_action);
  END LOOP;

  -- ── 7. Sort required_actions ──────────────────────────────────
  --   Primary:   severity rank ASC  (high=1, medium=2, low=3, other=4)
  --   Secondary: action key ASC     (tie-breaker, alphabetical)
  SELECT COALESCE(
    jsonb_agg(a ORDER BY
      CASE a->>'severity'
        WHEN 'high'   THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low'    THEN 3
        ELSE               4
      END ASC,
      (a->>'key') ASC
    ),
    '[]'::jsonb
  )
  INTO v_actions
  FROM jsonb_array_elements(v_actions) AS a;

  -- ── 8. Return ────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'project_id',                 p_project_id,
    'risk_score',                 v_risk_score,
    'economic_position',          v_economic_position,
    'intervention_priority',      v_intervention_pri,
    'intervention_flags',         v_sorted_flags,
    'required_actions',           v_actions,
    'recommended_guardrail_mode', v_guardrail,
    'executive_summary',          v_executive_summary
  );
END;
$$;

-- ── Grants ────────────────────────────────────────────────────────
REVOKE ALL  ON FUNCTION public.rpc_get_project_action_panel(uuid) FROM PUBLIC;
REVOKE ALL  ON FUNCTION public.rpc_get_project_action_panel(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_project_action_panel(uuid) TO authenticated;

COMMENT ON FUNCTION public.rpc_get_project_action_panel(uuid) IS
  'Project action panel. SECURITY DEFINER, STABLE, deterministic. '
  'canonical-flags:v3 — maps only rpc_get_margin_flag_dictionary() keys; '
  'required_actions ORDER BY severity_rank ASC, key ASC.';
