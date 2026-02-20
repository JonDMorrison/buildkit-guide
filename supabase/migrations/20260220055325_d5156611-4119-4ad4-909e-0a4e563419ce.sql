
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Table: public.project_margin_snapshots
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.project_margin_snapshots (
  project_id              uuid    NOT NULL
    REFERENCES public.projects(id) ON DELETE CASCADE,
  snapshot_date           date    NOT NULL,
  risk_score              numeric NOT NULL,
  projected_margin_ratio  numeric NOT NULL,
  PRIMARY KEY (project_id, snapshot_date)
);

-- RLS: authenticated members read; all writes go through the capture RPC
ALTER TABLE public.project_margin_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_margin_snapshots FORCE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_margin_snapshots"
  ON public.project_margin_snapshots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.projects p
      JOIN   public.organization_memberships om
               ON om.organization_id = p.organization_id
      WHERE  p.id    = project_margin_snapshots.project_id
        AND  om.user_id = auth.uid()
    )
  );

-- Block all direct writes for all roles; only the SECURITY DEFINER RPC may write
REVOKE INSERT, UPDATE, DELETE ON public.project_margin_snapshots
  FROM authenticated, anon, public;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RPC: public.rpc_capture_margin_snapshot(p_project_id uuid) → jsonb
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rpc_capture_margin_snapshot(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id       uuid;
  v_margin       jsonb;
  v_risk_score   numeric;
  v_proj_margin  numeric;
BEGIN
  -- ── 1. Project existence + org resolution ───────────────────────────────
  SELECT organization_id INTO v_org_id
  FROM   public.projects
  WHERE  id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_found' USING ERRCODE = '42501';
  END IF;

  -- ── 2. Membership check ─────────────────────────────────────────────────
  IF NOT public.rpc_is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 3. Call margin engine ───────────────────────────────────────────────
  v_margin := public.rpc_generate_project_margin_control(p_project_id);

  v_risk_score  := COALESCE((v_margin->>'risk_score')::numeric,        0);
  v_proj_margin := COALESCE((v_margin->>'projected_margin')::numeric,   0);

  -- ── 4. Upsert snapshot for current_date ────────────────────────────────
  INSERT INTO public.project_margin_snapshots
    (project_id, snapshot_date, risk_score, projected_margin_ratio)
  VALUES
    (p_project_id, current_date, v_risk_score, v_proj_margin)
  ON CONFLICT (project_id, snapshot_date) DO UPDATE SET
    risk_score             = EXCLUDED.risk_score,
    projected_margin_ratio = EXCLUDED.projected_margin_ratio;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_capture_margin_snapshot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_capture_margin_snapshot(uuid) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Update rpc_get_executive_risk_summary — add trend fields
--    risk_trend_last_30_days and margin_trend_last_30_days
--    = latest_value − earliest_value across active projects in last 30 days
--    (average across all projects with at least 2 snapshots)
-- ═══════════════════════════════════════════════════════════════════════════
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

  v_dict                  jsonb;

  -- Revenue exposure accumulators
  v_proj_revenue          numeric;
  v_total_revenue         numeric := 0;
  v_high_risk_revenue     numeric := 0;
  v_top3_revenue          numeric := 0;
  v_revenue_exposed_high_risk_percent numeric := 0;
  v_top_3_risky_revenue_percent       numeric := 0;

  -- Trend fields (new)
  v_risk_trend            numeric := 0;
  v_margin_trend          numeric := 0;
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

    -- Accumulate project row
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
  IF v_total_revenue > 0 THEN
    v_revenue_exposed_high_risk_percent :=
      ROUND((v_high_risk_revenue / v_total_revenue) * 100, 2);

    SELECT COALESCE(SUM((r->>'projected_revenue')::numeric), 0)
      INTO v_top3_revenue
      FROM jsonb_array_elements(v_top_risk) AS r;

    v_top_3_risky_revenue_percent :=
      ROUND((v_top3_revenue / v_total_revenue) * 100, 2);
  END IF;

  -- ── 6c. Trend fields from project_margin_snapshots ───────────
  --
  -- For each active project that has ≥ 2 snapshots in the last 30 days,
  -- compute: delta = latest_value − earliest_value (ordered by snapshot_date).
  -- Trend = average of those deltas across all qualifying projects.
  -- Deterministic: ORDER BY snapshot_date ASC, project_id ASC.
  -- Guard: projects with < 2 snapshots contribute 0 (neutral) to the average.
  --
  WITH active_projects AS (
    SELECT p.id AS project_id
    FROM   public.projects p
    WHERE  p.organization_id = p_org_id
    AND    p.is_deleted = false
    AND    p.status NOT IN ('completed', 'closed', 'cancelled')
  ),
  snaps AS (
    SELECT
      pms.project_id,
      pms.snapshot_date,
      pms.risk_score,
      pms.projected_margin_ratio,
      ROW_NUMBER() OVER (PARTITION BY pms.project_id ORDER BY pms.snapshot_date ASC,  pms.project_id ASC) AS rn_first,
      ROW_NUMBER() OVER (PARTITION BY pms.project_id ORDER BY pms.snapshot_date DESC, pms.project_id ASC) AS rn_last,
      COUNT(*)     OVER (PARTITION BY pms.project_id)                                                     AS snap_count
    FROM   public.project_margin_snapshots pms
    JOIN   active_projects ap ON ap.project_id = pms.project_id
    WHERE  pms.snapshot_date >= current_date - 30
  ),
  deltas AS (
    SELECT
      project_id,
      MAX(risk_score)             FILTER (WHERE rn_last  = 1) -
      MAX(risk_score)             FILTER (WHERE rn_first = 1)   AS risk_delta,
      MAX(projected_margin_ratio) FILTER (WHERE rn_last  = 1) -
      MAX(projected_margin_ratio) FILTER (WHERE rn_first = 1)   AS margin_delta
    FROM   snaps
    WHERE  snap_count >= 2
    GROUP  BY project_id
  )
  SELECT
    ROUND(COALESCE(AVG(risk_delta),   0), 2),
    ROUND(COALESCE(AVG(margin_delta), 0), 2)
  INTO v_risk_trend, v_margin_trend
  FROM deltas;

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
  -- All existing keys preserved verbatim; two new trend keys appended.
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
    'top_3_risky_revenue_percent',                v_top_3_risky_revenue_percent,
    'risk_trend_last_30_days',                    v_risk_trend,
    'margin_trend_last_30_days',                  v_margin_trend
  );
END;
$$;
