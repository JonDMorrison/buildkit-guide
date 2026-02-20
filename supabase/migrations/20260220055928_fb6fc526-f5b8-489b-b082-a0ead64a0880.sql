
-- ═══════════════════════════════════════════════════════════════════════════
-- public.rpc_assert_deterministic_ordering() → jsonb
--
-- Standalone guardrail scanner.  Scans pg_get_functiondef for three
-- classes of non-deterministic aggregation patterns:
--
--   1. jsonb_agg(…) without ORDER BY
--   2. array_agg(…) without ORDER BY
--   3. LIMIT without a corresponding ORDER BY in the same function
--
-- Detection strategy (identical to rpc_get_os_system_inventory Section 5,
-- promoted to a first-class standalone RPC):
--   • Count total occurrences of each aggregate call via regex.
--   • Count occurrences that include ORDER BY within 500 chars (non-greedy).
--   • If total > ordered → violation; hit_count = delta.
--   • LIMIT heuristic improved: count LIMIT occurrences and ORDER BY
--     occurrences independently; flag when LIMIT count > ORDER BY count
--     (catches the case where ORDER BY exists elsewhere but not near LIMIT).
--
-- Returns:
--   { violations: [{ function_name, issue, hit_count }], violation_count }
--
-- Read-only.  STABLE.  SECURITY DEFINER.  search_path pinned.
-- REVOKE from public/anon.  GRANT to authenticated.
-- No writes.  No blocking side-effects.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rpc_assert_deterministic_ordering()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- Auth
  v_uid                uuid;

  -- Per-function loop state
  v_fn_oid             oid;
  v_fn_name            text;
  v_fn_def             text;

  -- Per-check counters
  v_jsonb_count        bigint;
  v_jsonb_order_count  bigint;
  v_array_count        bigint;
  v_array_order_count  bigint;
  v_limit_count        bigint;
  v_order_by_count     bigint;

  -- Accumulators
  v_violations         jsonb := '[]'::jsonb;
  v_violation_count    int   := 0;
BEGIN
  -- ── Auth guard ────────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- Only authenticated org members may run this.
  -- (No org scoping — this is a system-wide scan, not per-project.)
  -- The auth.uid() null check is sufficient for this read-only meta function.

  -- ── Scan all public non-aggregate functions ───────────────────
  --   prokind = 'f' → plain functions only (excludes aggregates 'a',
  --   window functions 'w', procedures 'p').
  --   Ordered by proname ASC for deterministic output.
  FOR v_fn_oid, v_fn_name IN
    SELECT p.oid, p.proname
    FROM   pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  n.nspname = 'public'
    AND    p.prokind = 'f'
    ORDER  BY p.proname ASC, p.oid ASC
  LOOP
    -- Safely fetch definition; skip if inaccessible (e.g. C functions)
    BEGIN
      v_fn_def := pg_get_functiondef(v_fn_oid);
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    IF v_fn_def IS NULL OR v_fn_def = '' THEN
      CONTINUE;
    END IF;

    -- ── Check 1: jsonb_agg without ORDER BY ────────────────────
    -- Total occurrences of jsonb_agg(
    SELECT COUNT(*) INTO v_jsonb_count
    FROM   regexp_matches(v_fn_def, 'jsonb_agg\s*\(', 'gi');

    -- Occurrences where ORDER BY appears within 500 chars of jsonb_agg(
    -- Non-greedy [\s\S]{0,500}? prevents runaway backtracking.
    SELECT COUNT(*) INTO v_jsonb_order_count
    FROM   regexp_matches(v_fn_def, 'jsonb_agg\s*\([\s\S]{0,500}?ORDER\s+BY', 'gi');

    IF v_jsonb_count > v_jsonb_order_count THEN
      v_violations := v_violations || jsonb_build_array(
        jsonb_build_object(
          'function_name', v_fn_name,
          'issue',         'jsonb_agg without ORDER BY',
          'hit_count',     (v_jsonb_count - v_jsonb_order_count)
        )
      );
      v_violation_count := v_violation_count + (v_jsonb_count - v_jsonb_order_count)::int;
    END IF;

    -- ── Check 2: array_agg without ORDER BY ───────────────────
    SELECT COUNT(*) INTO v_array_count
    FROM   regexp_matches(v_fn_def, 'array_agg\s*\(', 'gi');

    SELECT COUNT(*) INTO v_array_order_count
    FROM   regexp_matches(v_fn_def, 'array_agg\s*\([\s\S]{0,500}?ORDER\s+BY', 'gi');

    IF v_array_count > v_array_order_count THEN
      v_violations := v_violations || jsonb_build_array(
        jsonb_build_object(
          'function_name', v_fn_name,
          'issue',         'array_agg without ORDER BY',
          'hit_count',     (v_array_count - v_array_order_count)
        )
      );
      v_violation_count := v_violation_count + (v_array_count - v_array_order_count)::int;
    END IF;

    -- ── Check 3: LIMIT without ORDER BY ───────────────────────
    -- Improved heuristic vs inventory scan:
    --   Count LIMIT occurrences and ORDER BY occurrences independently.
    --   Flag when LIMIT count > ORDER BY count.
    --   This catches functions that have ORDER BY elsewhere but have
    --   at least one LIMIT clause not protected by a corresponding ORDER BY.
    --
    -- Word-boundary markers (\m / \M) prevent matching inside identifiers
    -- like 'time_limit' or 'subliminal'.
    SELECT COUNT(*) INTO v_limit_count
    FROM   regexp_matches(v_fn_def, '\mLIMIT\M', 'gi');

    SELECT COUNT(*) INTO v_order_by_count
    FROM   regexp_matches(v_fn_def, '\mORDER\M\s+\mBY\M', 'gi');

    IF v_limit_count > v_order_by_count THEN
      v_violations := v_violations || jsonb_build_array(
        jsonb_build_object(
          'function_name', v_fn_name,
          'issue',         'LIMIT without ORDER BY',
          'hit_count',     (v_limit_count - v_order_by_count)
        )
      );
      v_violation_count := v_violation_count + (v_limit_count - v_order_by_count)::int;
    END IF;

  END LOOP;

  -- ── Return ────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'violations',       v_violations,
    'violation_count',  v_violation_count,
    'scan_note',        'Heuristic scan of pg_get_functiondef. Nested parentheses, string literals, and comments may produce false positives. hit_count = unmatched occurrences per check per function.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_assert_deterministic_ordering() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_assert_deterministic_ordering() TO authenticated;
