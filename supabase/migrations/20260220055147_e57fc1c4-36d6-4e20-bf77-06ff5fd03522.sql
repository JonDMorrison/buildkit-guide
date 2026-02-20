
CREATE OR REPLACE FUNCTION public.rpc_get_executive_risk_summary(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

  -- Dictionary pulled once for the whole call
  v_dict                  jsonb;

  -- Revenue exposure accumulators (new)
  v_proj_revenue          numeric;
  v_total_revenue         numeric := 0;
  v_high_risk_revenue     numeric := 0;
  v_top3_revenue          numeric := 0;

  -- Output fields (new)
  v_revenue_exposed_high_risk_percent numeric := 0;
  v_top_3_risky_revenue_percent       numeric := 0;
BEGIN
  -- ── 1. Auth ──────────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 2. Load dictionary once ───────────────────────────────────
  v_dict := public.rpc_get_margin_flag_dictionary();

  -- ── 3. Temp table for cause counting ─────────────────────────
  CREATE TEMP TABLE IF NOT EXISTS _exec_risk_causes (cause text) ON COMMIT DROP;
  TRUNCATE _exec_risk_causes;

  -- ── 4. Iterate active projects ───────────────────────────────
  --
  --  ACTIVE-STATUS CONTRACT (audited 2026-02-19):
  --    Distinct statuses in org: 'not_started', 'in_progress'
  --    Terminal statuses excluded: 'completed', 'closed', 'cancelled'
  --    No time filters — status is the sole gate.
  --    is_deleted = false: consistent with all sibling RPCs;
  --      guards against soft-deleted rows that may not carry a
  --      terminal status.
  --
  --  If new statuses are introduced (e.g. 'on_hold', 'archived'),
  --  add them to the NOT IN list and update this comment.
  --
  FOR v_proj IN
    SELECT id, name
    FROM   public.projects
    WHERE  organization_id = p_org_id
    AND    is_deleted       = false
    AND    status NOT IN ('completed', 'closed', 'cancelled')
    ORDER  BY id ASC
  LOOP
    v_active_count := v_active_count + 1;

    BEGIN
      v_margin_result := public.rpc_generate_project_margin_control(v_proj.id);
    EXCEPTION WHEN OTHERS THEN
      v_margin_result := NULL;
    END;

    v_risk_score         := COALESCE((v_margin_result->>'risk_score')::int,  0);
    v_economic_position  := COALESCE(v_margin_result->>'economic_position',  'unknown');
    v_executive_summary  := COALESCE(v_margin_result->>'executive_summary',  '');
    v_margin_pct         := (v_margin_result->>'projected_margin_at_completion_percent')::numeric;

    -- Revenue for exposure metrics: use 'contract_value' which the engine maps
    -- from projected_revenue (see rpc_generate_project_margin_control return).
    v_proj_revenue       := COALESCE((v_margin_result->>'contract_value')::numeric, 0);

    v_intervention_flags := COALESCE(v_margin_result->'intervention_flags', '[]'::jsonb);

    -- Sort intervention_flags ASC (determinism)
    SELECT COALESCE(jsonb_agg(f ORDER BY f ASC), '[]'::jsonb)
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

    -- Revenue accumulators
    v_total_revenue := v_total_revenue + v_proj_revenue;
    IF v_risk_score >= 60 THEN
      v_high_risk_revenue := v_high_risk_revenue + v_proj_revenue;
    END IF;

    -- Accumulate project row — include projected_revenue for post-loop top-3
    v_all_projects := v_all_projects || jsonb_build_object(
      'project_id',        v_proj.id,
      'project_name',      v_proj.name,
      'risk_score',        v_risk_score,
      'economic_position', v_economic_position,
      'executive_summary', v_executive_summary,
      'projected_revenue', v_proj_revenue
    );

    -- Explode sorted flags into cause accumulator
    INSERT INTO _exec_risk_causes (cause)
    SELECT f
    FROM   jsonb_array_elements_text(v_sorted_flags) AS f;

  END LOOP;

  -- ── 5. Average margin (round to 2 dp) ────────────────────────
  IF v_margin_count > 0 THEN
    v_avg_margin := ROUND(v_margin_sum / v_margin_count, 2);
  END IF;

  -- ── 6. Top 3 risk projects (score DESC, project_id ASC) ──────
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

  -- ── 6b. Revenue exposure metrics ─────────────────────────────
  -- revenue_exposed_high_risk_percent: sum(revenue where risk>=60) / total * 100
  -- top_3_risky_revenue_percent: sum(revenue of top-3 by risk) / total * 100
  -- Guard divide-by-zero; round to 2 decimals.
  IF v_total_revenue > 0 THEN
    v_revenue_exposed_high_risk_percent :=
      ROUND((v_high_risk_revenue / v_total_revenue) * 100, 2);

    -- top-3 revenue: sum projected_revenue from the already-ranked v_top_risk array
    SELECT COALESCE(SUM((r->>'projected_revenue')::numeric), 0)
      INTO v_top3_revenue
      FROM jsonb_array_elements(v_top_risk) AS r;

    v_top_3_risky_revenue_percent :=
      ROUND((v_top3_revenue / v_total_revenue) * 100, 2);
  END IF;

  -- ── 7. Top 5 causes — enriched from flag dictionary ──────────
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'cause',    sub.cause,
        'label',    COALESCE(v_dict->sub.cause->>'label',    sub.cause),
        'count',    sub.cnt,
        'severity', COALESCE(v_dict->sub.cause->>'severity', 'medium')
      )
      ORDER BY sub.cnt DESC, sub.cause ASC
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

  -- ── 8. OS score ──────────────────────────────────────────────
  BEGIN
    v_os_score := public.rpc_get_operating_system_score(p_org_id);
  EXCEPTION WHEN OTHERS THEN
    v_os_score := jsonb_build_object('error', SQLERRM);
  END;

  -- ── 9. Return ────────────────────────────────────────────────
  -- Existing keys preserved verbatim; two new keys appended.
  RETURN jsonb_build_object(
    'org_id',                                     p_org_id,
    'projects_active_count',                      v_active_count,
    'at_risk_count',                              v_at_risk_count,
    'volatile_count',                             v_volatile_count,
    'stable_count',                               v_stable_count,
    'avg_projected_margin_at_completion_percent', v_avg_margin,
    'top_risk_projects',                          v_top_risk,
    'top_causes',                                 v_cause_agg,
    'os_score',                                   v_os_score,
    'revenue_exposed_high_risk_percent',          v_revenue_exposed_high_risk_percent,
    'top_3_risky_revenue_percent',                v_top_3_risky_revenue_percent
  );
END;
$$;
