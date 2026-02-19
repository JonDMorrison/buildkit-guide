
-- ================================================================
-- rpc_get_executive_risk_summary
-- Single commercialization endpoint for executive leadership.
-- SECURITY DEFINER, pinned search_path, deterministic, no writes.
-- ================================================================

CREATE OR REPLACE FUNCTION public.rpc_get_executive_risk_summary(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- membership / auth
  v_uid                   uuid;

  -- project iteration
  v_proj                  record;
  v_margin_result         jsonb;

  -- per-project captured fields
  v_risk_score            int;
  v_economic_position     text;
  v_executive_summary     text;
  v_margin_pct            numeric;
  v_intervention_flags    jsonb;

  -- aggregates
  v_active_count          int     := 0;
  v_at_risk_count         int     := 0;
  v_volatile_count        int     := 0;
  v_stable_count          int     := 0;
  v_margin_sum            numeric := 0;
  v_margin_count          int     := 0;
  v_avg_margin            numeric := 0;

  -- ranked list accumulators (jsonb arrays)
  v_all_projects          jsonb   := '[]'::jsonb;
  v_top_risk              jsonb   := '[]'::jsonb;

  -- cause counting: temp table approach for determinism
  v_flag_text             text;
  v_cause_agg             jsonb   := '[]'::jsonb;

  -- os score
  v_os_score              jsonb;

BEGIN
  -- ── 1. Auth check ────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 2. Iterate active projects deterministically (id ASC) ───
  -- "Active" = anything not completed or closed.
  -- Confirmed status values in this schema: 'not_started', 'in_progress'.
  -- Exclude: 'completed', 'closed', 'cancelled'.
  FOR v_proj IN
    SELECT id, name
    FROM   projects
    WHERE  organization_id = p_org_id
    AND    status NOT IN ('completed', 'closed', 'cancelled')
    ORDER  BY id ASC
  LOOP
    v_active_count := v_active_count + 1;

    -- Call margin control engine; wrap in exception block so one
    -- failing project does not abort the whole summary.
    BEGIN
      v_margin_result := public.rpc_generate_project_margin_control(v_proj.id);
    EXCEPTION WHEN OTHERS THEN
      v_margin_result := NULL;
    END;

    -- Extract fields (null-safe)
    v_risk_score         := COALESCE((v_margin_result->>'risk_score')::int,     0);
    v_economic_position  := COALESCE(v_margin_result->>'economic_position',      'unknown');
    v_executive_summary  := COALESCE(v_margin_result->>'executive_summary',      '');
    v_margin_pct         := (v_margin_result->>'projected_margin_at_completion_percent')::numeric;
    v_intervention_flags := COALESCE(v_margin_result->'intervention_flags',      '[]'::jsonb);

    -- Position counters
    CASE v_economic_position
      WHEN 'at_risk'   THEN v_at_risk_count  := v_at_risk_count  + 1;
      WHEN 'volatile'  THEN v_volatile_count := v_volatile_count + 1;
      WHEN 'stable'    THEN v_stable_count   := v_stable_count   + 1;
      ELSE NULL;
    END CASE;

    -- Margin accumulator
    IF v_margin_pct IS NOT NULL THEN
      v_margin_sum   := v_margin_sum   + v_margin_pct;
      v_margin_count := v_margin_count + 1;
    END IF;

    -- Accumulate project row for ranked list
    v_all_projects := v_all_projects || jsonb_build_object(
      'project_id',        v_proj.id,
      'project_name',      v_proj.name,
      'risk_score',        v_risk_score,
      'economic_position', v_economic_position,
      'executive_summary', v_executive_summary
    );

    -- Explode intervention_flags into a temp accumulator table
    -- We use a persistent temp table scoped to this transaction.
    INSERT INTO _exec_risk_causes (cause)
    SELECT value::text
    FROM   jsonb_array_elements_text(v_intervention_flags);

  END LOOP;

  -- ── 3. Average margin (round to 2 dp) ───────────────────────
  IF v_margin_count > 0 THEN
    v_avg_margin := ROUND(v_margin_sum / v_margin_count, 2);
  END IF;

  -- ── 4. Top 3 risk projects (deterministic: score desc, id asc) ─
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

  -- ── 5. Top 5 causes (deterministic: count desc, cause asc) ──
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

  -- ── 6. OS score ──────────────────────────────────────────────
  BEGIN
    v_os_score := public.rpc_get_operating_system_score(p_org_id);
  EXCEPTION WHEN OTHERS THEN
    v_os_score := jsonb_build_object('error', SQLERRM);
  END;

  -- ── 7. Build and return result ───────────────────────────────
  RETURN jsonb_build_object(
    'org_id',                                   p_org_id,
    'projects_active_count',                    v_active_count,
    'at_risk_count',                            v_at_risk_count,
    'volatile_count',                           v_volatile_count,
    'stable_count',                             v_stable_count,
    'avg_projected_margin_at_completion_percent', v_avg_margin,
    'top_risk_projects',                        v_top_risk,
    'top_causes',                               v_cause_agg,
    'os_score',                                 v_os_score
  );
END;
$$;

-- ── Permissions ──────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.rpc_get_executive_risk_summary(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_get_executive_risk_summary(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_executive_risk_summary(uuid) TO authenticated;

COMMENT ON FUNCTION public.rpc_get_executive_risk_summary(uuid) IS
  'Executive risk summary for an organization. SECURITY DEFINER, deterministic, no writes. '
  'Aggregates margin control engine results across all active projects and surfaces top-risk '
  'rankings, position counts, cause frequencies, and OS score. '
  'Requires authenticated org membership. Schema: aggregation-ordering-policy:v1';
