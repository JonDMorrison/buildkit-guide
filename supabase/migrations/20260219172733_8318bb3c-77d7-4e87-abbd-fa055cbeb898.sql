
-- ================================================================
-- rpc_get_executive_risk_summary
-- Read-only. SECURITY DEFINER. Pinned search_path.
-- Single endpoint for executive risk dashboard.
-- ================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_executive_risk_summary(
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_is_member     boolean := false;
  v_os_score      jsonb;
  v_active_count  bigint := 0;
  v_at_risk       bigint := 0;
  v_volatile      bigint := 0;
  v_stable        bigint := 0;
  v_avg_margin    numeric := 0;
  v_top_projects  jsonb := '[]'::jsonb;
  v_top_causes    jsonb := '[]'::jsonb;
BEGIN
  -- ── Membership guard ──────────────────────────────────────────
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

  -- ── OS Score ──────────────────────────────────────────────────
  v_os_score := public.rpc_get_operating_system_score(p_org_id);

  -- ── Aggregate active project controls ─────────────────────────
  WITH controls AS (
    SELECT
      p.id                                            AS project_id,
      p.name                                          AS project_name,
      public.rpc_generate_project_margin_control(p.id) AS ctrl
    FROM projects p
    WHERE p.organization_id = p_org_id
      AND p.status NOT IN ('completed', 'closed', 'cancelled', 'archived')
    ORDER BY p.id ASC   -- deterministic iteration
  ),
  enriched AS (
    SELECT
      project_id,
      project_name,
      ctrl,
      (ctrl->>'risk_score')::int                     AS risk_score,
      ctrl->>'economic_position'                     AS economic_position,
      ctrl->>'executive_summary'                     AS executive_summary,
      (ctrl->>'projected_margin_at_completion_percent')::numeric AS proj_margin,
      ctrl->'intervention_flags'                     AS flags
    FROM controls
  ),
  -- top-3 deterministic: risk_score DESC, project_id ASC
  top3 AS (
    SELECT *
    FROM enriched
    ORDER BY risk_score DESC, project_id ASC
    LIMIT 3
  ),
  -- aggregated cause counts from intervention_flags arrays
  all_flags AS (
    SELECT flag_text AS cause
    FROM enriched,
         LATERAL jsonb_array_elements_text(COALESCE(flags, '[]'::jsonb)) AS flag_text
  ),
  cause_counts AS (
    SELECT cause, count(*) AS cnt
    FROM all_flags
    GROUP BY cause
    -- deterministic: count DESC then cause ASC for ties
    ORDER BY cnt DESC, cause ASC
  )
  SELECT
    count(*),
    COALESCE(count(*) FILTER (WHERE economic_position = 'at_risk'),  0),
    COALESCE(count(*) FILTER (WHERE economic_position = 'volatile'), 0),
    COALESCE(count(*) FILTER (WHERE economic_position = 'stable'),   0),
    round(COALESCE(avg(proj_margin), 0)::numeric, 2),
    COALESCE(
      (SELECT jsonb_agg(
                jsonb_build_object(
                  'project_id',       t.project_id,
                  'project_name',     t.project_name,
                  'risk_score',       t.risk_score,
                  'economic_position', t.economic_position,
                  'executive_summary', t.executive_summary
                )
                ORDER BY t.risk_score DESC, t.project_id ASC
              )
       FROM top3 t),
      '[]'::jsonb
    ),
    COALESCE(
      (SELECT jsonb_agg(
                jsonb_build_object('cause', c.cause, 'count', c.cnt)
                ORDER BY c.cnt DESC, c.cause ASC
              )
       FROM cause_counts c),
      '[]'::jsonb
    )
  INTO
    v_active_count,
    v_at_risk,
    v_volatile,
    v_stable,
    v_avg_margin,
    v_top_projects,
    v_top_causes
  FROM enriched;

  RETURN jsonb_build_object(
    'org_id',                                    p_org_id,
    'projects_active_count',                     COALESCE(v_active_count, 0),
    'at_risk_count',                             COALESCE(v_at_risk,      0),
    'volatile_count',                            COALESCE(v_volatile,     0),
    'stable_count',                              COALESCE(v_stable,       0),
    'avg_projected_margin_at_completion_percent', COALESCE(v_avg_margin,  0),
    'top_risk_projects',                         COALESCE(v_top_projects, '[]'::jsonb),
    'top_causes',                                COALESCE(v_top_causes,   '[]'::jsonb),
    'os_score',                                  v_os_score
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_executive_risk_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_executive_risk_summary(uuid) TO authenticated;
