
-- ════════════════════════════════════════════════════════════════════
-- public.rpc_debug_margin_control_payload(p_project_id uuid)
--
-- Live payload inspector for rpc_generate_project_margin_control.
-- Returns enriched metadata:
--   • keys_present           – sorted array of top-level payload keys
--   • intervention_flags_type – jsonb_typeof result
--   • intervention_flags_value – the actual flags (defaults [] when absent)
--   • margin_control_payload  – full raw payload
--
-- Auth: SECURITY DEFINER, resolves org via projects, enforces
--       rpc_is_org_member (canonical pattern).
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_debug_margin_control_payload(
  p_project_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id          uuid;
  v_payload         jsonb;
  v_keys_present    jsonb;
  v_flags_type      text;
  v_flags_value     jsonb;
BEGIN
  -- ── 1. Resolve org_id from project ──────────────────────────
  SELECT organization_id
    INTO v_org_id
    FROM public.projects
   WHERE id = p_project_id
     AND is_deleted = false
   LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'project_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- ── 2. Enforce membership (canonical pattern) ────────────────
  IF NOT public.rpc_is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 3. Call margin control engine ───────────────────────────
  v_payload := public.rpc_generate_project_margin_control(p_project_id);

  -- ── 4. Build keys_present (sorted ASC) ──────────────────────
  SELECT COALESCE(jsonb_agg(k ORDER BY k ASC), '[]'::jsonb)
    INTO v_keys_present
    FROM jsonb_object_keys(v_payload) AS k;

  -- ── 5. Inspect intervention_flags ───────────────────────────
  v_flags_type  := COALESCE(jsonb_typeof(v_payload -> 'intervention_flags'), 'null');
  v_flags_value := COALESCE(v_payload -> 'intervention_flags', '[]'::jsonb);

  -- ── 6. Return inspector envelope ────────────────────────────
  RETURN jsonb_build_object(
    'project_id',               p_project_id,
    'org_id',                   v_org_id,
    'keys_present',             v_keys_present,
    'intervention_flags_type',  v_flags_type,
    'intervention_flags_value', v_flags_value,
    'margin_control_payload',   v_payload
  );
END;
$$;

-- ── Grants ─────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.rpc_debug_margin_control_payload(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_debug_margin_control_payload(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_debug_margin_control_payload(uuid) TO authenticated;

COMMENT ON FUNCTION public.rpc_debug_margin_control_payload(uuid) IS
  'Margin control payload inspector. SECURITY DEFINER. '
  'Returns keys_present, intervention_flags_type, intervention_flags_value, '
  'and full margin_control_payload for a given project. '
  'Auth: rpc_is_org_member. No writes. Authenticated only.';
