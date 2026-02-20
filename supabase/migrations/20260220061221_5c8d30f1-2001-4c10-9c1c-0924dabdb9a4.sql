
-- ═══════════════════════════════════════════════════════════════════════════
-- public.rpc_calculate_economic_maturity_score(p_org_id uuid) RETURNS jsonb
--
-- Deterministic economic maturity score (0–100) for an organisation.
-- No AI text. No writes. STABLE SECURITY DEFINER.
--
-- ── Scoring model (100 pts total) ────────────────────────────────────────
--
--   Dimension                               Weight  Source
--   ─────────────────────────────────────── ──────  ──────────────────────────────────────
--   1. Estimate coverage                     25 pt  % active projects with an approved
--                                                   estimate (status = 'approved')
--
--   2. Revenue coverage                      25 pt  % active projects where
--                                                   projected_revenue > 0
--                                                   (v_project_economic_snapshot)
--
--   3. Snapshot recency                      25 pt  % active projects that have at least
--                                                   one snapshot in the last 7 days
--                                                   (project_margin_snapshots)
--
--   4. Determinism integrity                 15 pt  Full 15 if zero mismatch rows in
--                                                   ai_insight_validation_log for this org
--                                                   in the trailing 30 days; 0 otherwise.
--
--   5. Flag dictionary enforcement           10 pt  Full 10 if rpc_get_margin_flag_dictionary
--                                                   exists in pg_proc; 0 otherwise.
--
-- ── Tier thresholds ──────────────────────────────────────────────────────
--   Platinum : score >= 90
--   Gold     : score >= 70
--   Silver   : score >= 50
--   Bronze   : score <  50
--
-- ── Determinism guarantees ────────────────────────────────────────────────
--   • All ratios computed via ROUND(..., 4) internally; final score ROUND 2.
--   • NULLIF denominator guards on every ratio — no divide-by-zero.
--   • Output keys in fixed alphabetical order.
--   • No dynamic SQL. No text generation. No AI calls.
--
-- ── Security ──────────────────────────────────────────────────────────────
--   • STABLE SECURITY DEFINER, search_path = public, pg_temp.
--   • auth.uid() null-check → 42501.
--   • rpc_is_org_member guard → 42501 (Fail Loudly).
--   • REVOKE ALL from public, anon. GRANT EXECUTE to authenticated.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_calculate_economic_maturity_score(
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid                   uuid;

  -- ── Active project universe ───────────────────────────────────────────
  v_active_count          int := 0;

  -- ── Dimension 1: Estimate coverage ───────────────────────────────────
  v_projects_with_estimate int := 0;
  v_estimate_ratio         numeric := 0;
  v_estimate_score         numeric := 0;

  -- ── Dimension 2: Revenue coverage ────────────────────────────────────
  v_projects_with_revenue  int := 0;
  v_revenue_ratio          numeric := 0;
  v_revenue_score          numeric := 0;

  -- ── Dimension 3: Snapshot recency (7-day window) ─────────────────────
  v_projects_with_snapshot int := 0;
  v_snapshot_ratio         numeric := 0;
  v_snapshot_score         numeric := 0;

  -- ── Dimension 4: Determinism integrity (30-day window) ───────────────
  v_mismatch_count         bigint  := 0;
  v_determinism_score      numeric := 0;

  -- ── Dimension 5: Flag dictionary enforcement ──────────────────────────
  v_dict_exists            boolean := false;
  v_dict_score             numeric := 0;

  -- ── Composite ─────────────────────────────────────────────────────────
  v_score                  numeric := 0;
  v_tier                   text;
BEGIN
  -- ── 1. Auth ───────────────────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 2. Active project count ───────────────────────────────────────────
  --   Active-project contract: is_deleted = false AND status NOT IN terminal set.
  SELECT COUNT(*) INTO v_active_count
  FROM   public.projects
  WHERE  organization_id = p_org_id
    AND  is_deleted = false
    AND  status NOT IN ('completed', 'closed', 'cancelled', 'archived', 'deleted', 'didnt_get');

  -- ── 3. Dimension 1 — Estimate coverage (25 pts) ───────────────────────
  --   Count distinct active projects that have at least one approved estimate.
  SELECT COUNT(DISTINCT p.id) INTO v_projects_with_estimate
  FROM   public.projects p
  JOIN   public.estimates e ON e.project_id = p.id AND e.status = 'approved'
  WHERE  p.organization_id = p_org_id
    AND  p.is_deleted = false
    AND  p.status NOT IN ('completed', 'closed', 'cancelled', 'archived', 'deleted', 'didnt_get');

  v_estimate_ratio := COALESCE(
    ROUND(v_projects_with_estimate::numeric / NULLIF(v_active_count, 0), 4),
    0
  );
  v_estimate_score := ROUND(v_estimate_ratio * 25, 2);

  -- ── 4. Dimension 2 — Revenue coverage (25 pts) ────────────────────────
  --   Count distinct active projects where the canonical snapshot view
  --   reports projected_revenue > 0.
  SELECT COUNT(DISTINCT snap.project_id) INTO v_projects_with_revenue
  FROM   public.v_project_economic_snapshot snap
  JOIN   public.projects p ON p.id = snap.project_id
  WHERE  snap.org_id = p_org_id
    AND  p.is_deleted = false
    AND  p.status NOT IN ('completed', 'closed', 'cancelled', 'archived', 'deleted', 'didnt_get')
    AND  snap.projected_revenue > 0;

  v_revenue_ratio := COALESCE(
    ROUND(v_projects_with_revenue::numeric / NULLIF(v_active_count, 0), 4),
    0
  );
  v_revenue_score := ROUND(v_revenue_ratio * 25, 2);

  -- ── 5. Dimension 3 — Snapshot recency (25 pts) ────────────────────────
  --   Count distinct active projects with at least one snapshot in last 7 days.
  SELECT COUNT(DISTINCT pms.project_id) INTO v_projects_with_snapshot
  FROM   public.project_margin_snapshots pms
  JOIN   public.projects p ON p.id = pms.project_id
  WHERE  p.organization_id = p_org_id
    AND  p.is_deleted = false
    AND  p.status NOT IN ('completed', 'closed', 'cancelled', 'archived', 'deleted', 'didnt_get')
    AND  pms.snapshot_date >= current_date - 7;

  v_snapshot_ratio := COALESCE(
    ROUND(v_projects_with_snapshot::numeric / NULLIF(v_active_count, 0), 4),
    0
  );
  v_snapshot_score := ROUND(v_snapshot_ratio * 25, 2);

  -- ── 6. Dimension 4 — Determinism integrity (15 pts) ───────────────────
  --   Count mismatch rows in ai_insight_validation_log for this org
  --   within the trailing 30 days. Zero mismatches = full 15 pts.
  SELECT COUNT(*) INTO v_mismatch_count
  FROM   public.ai_insight_validation_log
  WHERE  organization_id  = p_org_id
    AND  validation_result = 'mismatch'
    AND  created_at >= now() - interval '30 days';

  v_determinism_score := CASE WHEN v_mismatch_count = 0 THEN 15 ELSE 0 END;

  -- ── 7. Dimension 5 — Flag dictionary enforcement (10 pts) ─────────────
  --   Check that rpc_get_margin_flag_dictionary exists in pg_proc.
  --   This verifies the canonical flag registry is deployed and accessible.
  SELECT EXISTS (
    SELECT 1
    FROM   pg_proc
    WHERE  proname      = 'rpc_get_margin_flag_dictionary'
      AND  pronamespace = 'public'::regnamespace
  ) INTO v_dict_exists;

  v_dict_score := CASE WHEN v_dict_exists THEN 10 ELSE 0 END;

  -- ── 8. Composite score ────────────────────────────────────────────────
  v_score := ROUND(
    (v_estimate_score + v_revenue_score + v_snapshot_score +
     v_determinism_score + v_dict_score)::numeric,
    2
  );
  -- Safety clamp [0, 100]
  v_score := LEAST(GREATEST(v_score, 0), 100);

  -- ── 9. Tier assignment ────────────────────────────────────────────────
  v_tier := CASE
    WHEN v_score >= 90 THEN 'Platinum'
    WHEN v_score >= 70 THEN 'Gold'
    WHEN v_score >= 50 THEN 'Silver'
    ELSE                    'Bronze'
  END;

  -- ── 10. Return ────────────────────────────────────────────────────────
  --   Keys in fixed alphabetical order for determinism.
  RETURN jsonb_build_object(
    'active_project_count',      v_active_count,
    'breakdown', jsonb_build_object(
      'determinism_integrity', jsonb_build_object(
        'mismatch_count',  v_mismatch_count,
        'score',           v_determinism_score,
        'weight',          15
      ),
      'estimate_coverage', jsonb_build_object(
        'projects_with_estimate', v_projects_with_estimate,
        'ratio',                  ROUND(v_estimate_ratio * 100, 2),
        'score',                  v_estimate_score,
        'weight',                 25
      ),
      'flag_dictionary_enforcement', jsonb_build_object(
        'present', v_dict_exists,
        'score',   v_dict_score,
        'weight',  10
      ),
      'revenue_coverage', jsonb_build_object(
        'projects_with_revenue', v_projects_with_revenue,
        'ratio',                 ROUND(v_revenue_ratio * 100, 2),
        'score',                 v_revenue_score,
        'weight',                25
      ),
      'snapshot_recency', jsonb_build_object(
        'projects_with_recent_snapshot', v_projects_with_snapshot,
        'ratio',                         ROUND(v_snapshot_ratio * 100, 2),
        'score',                         v_snapshot_score,
        'weight',                        25
      )
    ),
    'score', v_score,
    'tier',  v_tier
  );
END;
$$;

REVOKE ALL  ON FUNCTION public.rpc_calculate_economic_maturity_score(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_calculate_economic_maturity_score(uuid) TO authenticated;

COMMENT ON FUNCTION public.rpc_calculate_economic_maturity_score(uuid) IS
  'Deterministic economic maturity score (0-100) for an org. No AI text. No writes. '
  'STABLE SECURITY DEFINER. search_path pinned. '
  'Dimensions: estimate_coverage(25) + revenue_coverage(25) + snapshot_recency(25) '
  '+ determinism_integrity(15) + flag_dictionary_enforcement(10). '
  'Tiers: Platinum>=90, Gold>=70, Silver>=50, Bronze<50.';
