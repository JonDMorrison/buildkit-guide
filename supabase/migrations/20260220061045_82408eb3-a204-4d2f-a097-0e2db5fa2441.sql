
-- ═══════════════════════════════════════════════════════════════════════════
-- public.rpc_get_margin_snapshot_history(
--   p_project_id  uuid,
--   p_days        int  DEFAULT 30   -- trailing window; must be 1–365
-- ) RETURNS jsonb
--
-- Returns the ordered time-series of captured margin snapshots for a single
-- project, bounded to the trailing p_days calendar days from today.
--
-- Return shape:
--   {
--     "project_id":     "<uuid>",
--     "days_requested": <int>,
--     "snapshot_count": <int>,
--     "snapshots": [
--       { "snapshot_date": "YYYY-MM-DD", "risk_score": 0.00, "projected_margin_ratio": 0.00 }
--       ...  ordered snapshot_date ASC
--     ]
--   }
--
-- Determinism guarantees:
--   • ORDER BY snapshot_date ASC, project_id ASC  (project_id is the tiebreak
--     column from the PK — deterministic even if two rows share a date, which
--     the PRIMARY KEY constraint prevents, but stated for clarity)
--   • All numerics rounded to 2 decimal places.
--   • p_days clamped to [1, 365] to prevent runaway queries.
--
-- Security:
--   • STABLE SECURITY DEFINER, search_path pinned to public, pg_temp.
--   • auth.uid() null-check → raises 42501 immediately.
--   • rpc_is_org_member guard — Fail Loudly (42501) for non-members.
--   • REVOKE ALL from public, anon. GRANT EXECUTE to authenticated.
--
-- Writes: none.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_get_margin_snapshot_history(
  p_project_id  uuid,
  p_days        int  DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid          uuid;
  v_org_id       uuid;
  v_clamped_days int;
  v_snapshots    jsonb;
  v_count        int;
BEGIN
  -- ── 1. Auth ──────────────────────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 2. Resolve org from project ──────────────────────────────────────────
  SELECT organization_id INTO v_org_id
  FROM   public.projects
  WHERE  id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- ── 3. Membership guard (Fail Loudly) ────────────────────────────────────
  IF NOT public.rpc_is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 4. Clamp p_days to [1, 365] ──────────────────────────────────────────
  v_clamped_days := GREATEST(1, LEAST(COALESCE(p_days, 30), 365));

  -- ── 5. Fetch + aggregate snapshots ───────────────────────────────────────
  --   ORDER BY snapshot_date ASC is the canonical time-series order.
  --   All numerics rounded to 2 dp for determinism.
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'snapshot_date',          to_char(pms.snapshot_date, 'YYYY-MM-DD'),
          'risk_score',             ROUND(pms.risk_score::numeric,             2),
          'projected_margin_ratio', ROUND(pms.projected_margin_ratio::numeric, 2)
        )
        ORDER BY pms.snapshot_date ASC
      ),
      '[]'::jsonb
    ),
    COUNT(*)
  INTO v_snapshots, v_count
  FROM public.project_margin_snapshots pms
  WHERE pms.project_id   = p_project_id
    AND pms.snapshot_date >= current_date - v_clamped_days;

  -- ── 6. Return ─────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'project_id',     p_project_id,
    'days_requested', v_clamped_days,
    'snapshot_count', v_count,
    'snapshots',      v_snapshots
  );
END;
$$;

REVOKE ALL  ON FUNCTION public.rpc_get_margin_snapshot_history(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_margin_snapshot_history(uuid, int) TO authenticated;

COMMENT ON FUNCTION public.rpc_get_margin_snapshot_history(uuid, int) IS
  'Read-only. STABLE SECURITY DEFINER. search_path pinned. '
  'Returns ordered (ASC) time-series of margin snapshots for a project '
  'within a trailing p_days window (clamped 1–365, default 30). '
  'All numerics rounded to 2 dp. No writes.';
