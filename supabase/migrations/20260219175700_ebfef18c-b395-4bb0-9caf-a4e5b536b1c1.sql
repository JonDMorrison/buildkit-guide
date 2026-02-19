
-- ================================================================
-- Determinism patch for rpc_get_executive_risk_summary
-- Fixes: intervention_flags in each project object must be sorted
--        (array_agg with ORDER BY) before being placed in JSON,
--        guaranteeing bit-for-bit identical outputs for identical inputs.
-- No other logic changes.
-- ================================================================

CREATE OR REPLACE FUNCTION public.rpc_get_executive_risk_summary(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid                   uuid;
  v_proj                  record;
  v_margin_result         jsonb;
  v_risk_score            int;
  v_economic_position     text;
  v_executive_summary     text;
  v_margin_pct            numeric;
  v_intervention_flags    jsonb;
  v_sorted_flags          jsonb;

  v_active_count          int     := 0;
  v_at_risk_count         int     := 0;
  v_volatile_count        int     := 0;
  v_stable_count          int     := 0;
  v_margin_sum            numeric := 0;
  v_margin_count          int     := 0;
  v_avg_margin            numeric := 0;

  v_all_projects          jsonb   := '[]'::jsonb;
  v_top_risk              jsonb   := '[]'::jsonb;
  v_flag_text             text;
  v_cause_agg             jsonb   := '[]'::jsonb;
  v_os_score              jsonb;
BEGIN
  -- ── 1. Auth ──────────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 2. Create temp table for cause counting ──────────────────
  CREATE TEMP TABLE IF NOT EXISTS _exec_risk_causes (cause text) ON COMMIT DROP;
  TRUNCATE _exec_risk_causes;

  -- ── 3. Iterate active projects (id ASC) ──────────────────────
  FOR v_proj IN
    SELECT id, name
    FROM   projects
    WHERE  organization_id = p_org_id
    AND    status NOT IN ('completed', 'closed', 'cancelled')
    ORDER  BY id ASC
  LOOP
    v_active_count := v_active_count + 1;

    BEGIN
      v_margin_result := public.rpc_generate_project_margin_control(v_proj.id);
    EXCEPTION WHEN OTHERS THEN
      v_margin_result := NULL;
    END;

    v_risk_score        := COALESCE((v_margin_result->>'risk_score')::int,  0);
    v_economic_position := COALESCE(v_margin_result->>'economic_position',  'unknown');
    v_executive_summary := COALESCE(v_margin_result->>'executive_summary',  '');
    v_margin_pct        := (v_margin_result->>'projected_margin_at_completion_percent')::numeric;
    v_intervention_flags := COALESCE(v_margin_result->'intervention_flags', '[]'::jsonb);

    -- ── DETERMINISM FIX: sort intervention_flags array ASC ─────
    SELECT COALESCE(
      jsonb_agg(f ORDER BY f ASC),
      '[]'::jsonb
    )
    INTO v_sorted_flags
    FROM jsonb_array_elements_text(v_intervention_flags) AS f;

    -- Position counters
    CASE v_economic_position
      WHEN 'at_risk'  THEN v_at_risk_count  := v_at_risk_count  + 1;
      WHEN 'volatile' THEN v_volatile_count := v_volatile_count + 1;
      WHEN 'stable'   THEN v_stable_count   := v_stable_count   + 1;
      ELSE NULL;
    END CASE;

    -- Margin accumulator
    IF v_margin_pct IS NOT NULL THEN
      v_margin_sum   := v_margin_sum   + v_margin_pct;
      v_margin_count := v_margin_count + 1;
    END IF;

    -- Accumulate project row (flags now sorted)
    v_all_projects := v_all_projects || jsonb_build_object(
      'project_id',        v_proj.id,
      'project_name',      v_proj.name,
      'risk_score',        v_risk_score,
      'economic_position', v_economic_position,
      'executive_summary', v_executive_summary
    );

    -- Explode sorted flags into cause accumulator
    INSERT INTO _exec_risk_causes (cause)
    SELECT f
    FROM   jsonb_array_elements_text(v_sorted_flags) AS f;

  END LOOP;

  -- ── 4. Average margin (round to 2 dp) ────────────────────────
  IF v_margin_count > 0 THEN
    v_avg_margin := ROUND(v_margin_sum / v_margin_count, 2);
  END IF;

  -- ── 5. Top 3 risk projects (score DESC, project_id ASC) ──────
  SELECT COALESCE(
    jsonb_agg(r ORDER BY (r->>'risk_score')::int DESC, r->>'project_id' ASC),
    '[]'::jsonb
  )
  INTO v_top_risk
  FROM (
    SELECT value AS r
    FROM   jsonb_array_elements(v_all_projects)
    ORDER  BY (value->>'risk_score')::int DESC, value->>'project_id' ASC
    LIMIT  3
  ) sub;

  -- ── 6. Top 5 causes (count DESC, cause ASC) ──────────────────
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('cause', cause, 'count', cnt)
      ORDER BY cnt DESC, cause ASC
    ),
    '[]'::jsonb
  )
  INTO v_cause_agg
  FROM (
    SELECT cause, COUNT(*) AS cnt
    FROM   _exec_risk_causes
    GROUP  BY cause
    ORDER  BY cnt DESC, cause ASC
    LIMIT  5
  ) sub;

  -- ── 7. OS score ──────────────────────────────────────────────
  BEGIN
    v_os_score := public.rpc_get_operating_system_score(p_org_id);
  EXCEPTION WHEN OTHERS THEN
    v_os_score := jsonb_build_object('error', SQLERRM);
  END;

  -- ── 8. Return ────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'org_id',                                     p_org_id,
    'projects_active_count',                      v_active_count,
    'at_risk_count',                              v_at_risk_count,
    'volatile_count',                             v_volatile_count,
    'stable_count',                               v_stable_count,
    'avg_projected_margin_at_completion_percent', v_avg_margin,
    'top_risk_projects',                          v_top_risk,
    'top_causes',                                 v_cause_agg,
    'os_score',                                   v_os_score
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_executive_risk_summary(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_get_executive_risk_summary(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_executive_risk_summary(uuid) TO authenticated;

COMMENT ON FUNCTION public.rpc_get_executive_risk_summary(uuid) IS
  'Executive risk summary for an org. SECURITY DEFINER, deterministic (v2: sorted flags, sorted causes, rounded avg). '
  'aggregation-ordering-policy:v2';

-- ================================================================
-- Determinism patch for rpc_get_project_action_panel
-- Fixes: intervention_flags returned in JSON must be sorted ASC
--        so the output is bit-for-bit identical for identical inputs.
-- No other logic changes.
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

  v_risk_score        := (v_margin_result ->> 'risk_score')::int;
  v_economic_position := v_margin_result ->> 'economic_position';
  v_intervention_pri  := (v_margin_result ->> 'intervention_priority')::int;
  v_executive_summary := v_margin_result ->> 'executive_summary';

  v_intervention_flags := COALESCE(
    v_margin_result -> 'intervention_flags',
    '[]'::jsonb
  );

  -- ── DETERMINISM FIX: sort intervention_flags ASC ─────────────
  SELECT COALESCE(
    jsonb_agg(f ORDER BY f ASC),
    '[]'::jsonb
  )
  INTO v_sorted_flags
  FROM jsonb_array_elements_text(v_intervention_flags) AS f;

  -- ── 4. Guardrail mode ────────────────────────────────────────
  v_guardrail := CASE
    WHEN v_risk_score > 60  THEN 'block'
    WHEN v_risk_score >= 30 THEN 'warn'
    ELSE 'none'
  END;

  IF (v_margin_result ->> 'guardrail_recommendation') IS NOT NULL THEN
    v_guardrail := v_margin_result ->> 'guardrail_recommendation';
  END IF;

  -- ── 5. Map sorted flags → required_actions ───────────────────
  -- Iterate in sorted order (tie-breaker already applied above)
  FOR v_flag IN
    SELECT value::text
      FROM jsonb_array_elements_text(v_sorted_flags)
     ORDER BY 1 ASC
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

  -- ── 6. Sort required_actions: severity rank ASC, key ASC ─────
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

  -- ── 7. Return ────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'project_id',                 p_project_id,
    'risk_score',                 v_risk_score,
    'economic_position',          v_economic_position,
    'intervention_priority',      v_intervention_pri,
    'intervention_flags',         v_sorted_flags,       -- ← sorted, not raw
    'required_actions',           v_actions,
    'recommended_guardrail_mode', v_guardrail,
    'executive_summary',          v_executive_summary
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_project_action_panel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_project_action_panel(uuid) TO authenticated;

COMMENT ON FUNCTION public.rpc_get_project_action_panel(uuid) IS
  'Project action panel. SECURITY DEFINER, deterministic (v2: sorted flags). '
  'aggregation-ordering-policy:v2';
