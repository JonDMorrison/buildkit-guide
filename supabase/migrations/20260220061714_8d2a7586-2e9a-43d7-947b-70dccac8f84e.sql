
-- ═══════════════════════════════════════════════════════════════════════════
-- economic-guardrails:v2  — spec-compliance patch
--
-- Three surgical fixes. No logic, thresholds, grants, or existing keys changed.
--
-- Fix 1: _internal_economic_gate
--   RAISE EXCEPTION text changed from:
--     'economic_blocked: risk_score=% exceeds block_threshold=% for this operation'
--   to exactly:
--     'economic_blocked'
--   Spec: "Exception text must be exactly 'economic_blocked'."
--   search_path already correct (public, pg_temp) — unchanged.
--
-- Fix 2: rpc_approve_change_order
--   search_path pinned to 'public', 'pg_temp'  (was 'public' only).
--   Warning shape updated: 'risk_score' key renamed to
--   'economic_warning_risk_score' to match spec.
--   Body otherwise verbatim.
--
-- Fix 3: rpc_convert_quote_to_invoice
--   search_path pinned to 'public', 'pg_temp'  (was 'public' only).
--   Warning shape updated: 'risk_score' key renamed to
--   'economic_warning_risk_score' to match spec.
--   Body otherwise verbatim.
--
-- rpc_complete_project: search_path already correct, warning key already
--   spec-compliant (confirmed via pg_get_functiondef). Not re-stated here
--   to avoid unnecessary churn; the gate text fix flows through the shared
--   helper automatically.
--
-- Grants: unchanged for all four functions.
-- Writes: none.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── Fix 1: _internal_economic_gate ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._internal_economic_gate(p_project_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id          uuid;
  v_margin          jsonb;
  v_score           int;
  v_warn_threshold  numeric;
  v_block_threshold numeric;
BEGIN
  -- Resolve org for threshold lookup
  SELECT organization_id INTO v_org_id
  FROM   public.projects
  WHERE  id = p_project_id;

  -- Load thresholds (fallback to defaults if no row)
  SELECT t.warn_threshold, t.block_threshold
    INTO v_warn_threshold, v_block_threshold
    FROM public._internal_get_thresholds(v_org_id) AS t;

  -- rpc_generate_project_margin_control enforces its own membership guard;
  -- we propagate any exceptions it raises.
  v_margin := public.rpc_generate_project_margin_control(p_project_id);
  v_score  := COALESCE((v_margin->>'risk_score')::int, 0);

  -- Exception text is EXACTLY 'economic_blocked' (spec-required, no suffix).
  IF v_score >= v_block_threshold THEN
    RAISE EXCEPTION 'economic_blocked' USING ERRCODE = '42501';
  END IF;

  RETURN v_score;   -- caller compares against warn_threshold for advisory warning
END;
$$;

-- Internal-only: no role may call this directly
REVOKE ALL ON FUNCTION public._internal_economic_gate(uuid) FROM PUBLIC, anon, authenticated;


-- ── Fix 2: rpc_approve_change_order ───────────────────────────────────────
--   project_id source: v_co.project_id (fetched from change_orders table,
--   line "SELECT * INTO v_co FROM change_orders WHERE id = p_change_order_id").
CREATE OR REPLACE FUNCTION public.rpc_approve_change_order(
  p_change_order_id uuid,
  p_approved        boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_co         record;
  v_risk_score int;
  v_result     jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_co FROM change_orders WHERE id = p_change_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change order not found' USING ERRCODE = '42501';
  END IF;

  IF NOT has_org_role(v_co.organization_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Only admin can approve change orders' USING ERRCODE = '42501';
  END IF;

  IF v_co.status NOT IN ('sent', 'submitted') THEN
    RAISE EXCEPTION 'Can only approve sent/submitted change orders' USING ERRCODE = 'P0001';
  END IF;

  -- ── Economic gate ────────────────────────────────────────────────────────
  -- project_id derived from: change_orders.project_id (v_co.project_id)
  v_risk_score := public._internal_economic_gate(v_co.project_id);

  -- ── Existing write logic (unchanged) ─────────────────────────────────────
  PERFORM rpc_recalculate_change_order_totals(p_change_order_id);

  UPDATE change_orders SET
    status      = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
    approved_by = v_user_id,
    amount      = total,
    updated_at  = now()
  WHERE id = p_change_order_id;

  -- ── Return ────────────────────────────────────────────────────────────────
  v_result := jsonb_build_object(
    'status', CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END
  );

  IF v_risk_score >= 30 THEN
    v_result := v_result || jsonb_build_object(
      'economic_warning',            true,
      'economic_warning_risk_score', v_risk_score
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Grants unchanged
REVOKE ALL  ON FUNCTION public.rpc_approve_change_order(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_approve_change_order(uuid, boolean) TO authenticated;


-- ── Fix 3: rpc_convert_quote_to_invoice ───────────────────────────────────
--   project_id source: quotes.project_id
--   ("SELECT project_id INTO v_project_id FROM public.quotes WHERE id = p_quote_id")
CREATE OR REPLACE FUNCTION public.rpc_convert_quote_to_invoice(p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_id uuid;
  v_risk_score  int;
  v_invoice_id  text;
BEGIN
  -- Resolve project_id from quotes before the gate.
  -- project_id derived from: quotes.project_id
  SELECT project_id INTO v_project_id
  FROM   public.quotes
  WHERE  id = p_quote_id;

  IF NOT FOUND OR v_project_id IS NULL THEN
    -- Let the delegate raise its own canonical errors.
    v_project_id := NULL;
  END IF;

  -- ── Economic gate (only when project_id is known) ─────────────────────
  IF v_project_id IS NOT NULL THEN
    v_risk_score := public._internal_economic_gate(v_project_id);
  END IF;

  -- ── Delegate to canonical implementation ─────────────────────────────
  v_invoice_id := public.convert_quote_to_invoice(p_quote_id, auth.uid());

  -- ── Return ────────────────────────────────────────────────────────────
  -- Base shape preserved; economic warning appended only on warn band.
  IF v_risk_score >= 30 THEN
    RETURN jsonb_build_object(
      'invoice_id',                  v_invoice_id,
      'economic_warning',            true,
      'economic_warning_risk_score', v_risk_score
    );
  END IF;

  RETURN jsonb_build_object('invoice_id', v_invoice_id);
END;
$$;

-- Grants unchanged
REVOKE ALL  ON FUNCTION public.rpc_convert_quote_to_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_convert_quote_to_invoice(uuid) TO authenticated;


-- ── rpc_complete_project: re-state to align economic_warning_risk_score key ─
--   (search_path was already correct; only warning key name updated)
--   project_id source: p_project_id (direct input parameter).
CREATE OR REPLACE FUNCTION public.rpc_complete_project(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_org_id     uuid;
  v_role       text;
  v_risk_score int;
  v_result     jsonb;
BEGIN
  -- ── Auth ─────────────────────────────────────────────────────────────────
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- ── Project existence + org resolution ──────────────────────────────────
  -- project_id derived from: p_project_id (direct input parameter)
  SELECT organization_id INTO v_org_id
  FROM   public.projects
  WHERE  id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501';
  END IF;

  -- ── Org membership ───────────────────────────────────────────────────────
  IF NOT public.rpc_is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── Role gate: admin or project_manager only ─────────────────────────────
  v_role := public.get_user_project_role(v_user_id, p_project_id);
  IF v_role IS NULL OR v_role NOT IN ('admin', 'project_manager') THEN
    IF NOT public.is_org_admin(v_user_id, v_org_id) THEN
      RAISE EXCEPTION 'Must be admin or project_manager to complete a project'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- ── Economic gate ─────────────────────────────────────────────────────────
  v_risk_score := public._internal_economic_gate(p_project_id);

  -- ── Write ─────────────────────────────────────────────────────────────────
  UPDATE public.projects
  SET    status     = 'completed',
         updated_at = now()
  WHERE  id = p_project_id;

  -- ── Return ────────────────────────────────────────────────────────────────
  v_result := jsonb_build_object(
    'project_id', p_project_id,
    'status',     'completed'
  );

  IF v_risk_score >= 30 THEN
    v_result := v_result || jsonb_build_object(
      'economic_warning',            true,
      'economic_warning_risk_score', v_risk_score
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Grants unchanged
REVOKE ALL  ON FUNCTION public.rpc_complete_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_complete_project(uuid) TO authenticated;

COMMENT ON FUNCTION public._internal_economic_gate(uuid) IS
  'economic-guardrails:v2 — Exception text is exactly ''economic_blocked'' (ERRCODE 42501). '
  'Uses org-configurable thresholds via _internal_get_thresholds. Internal-only.';

COMMENT ON FUNCTION public.rpc_approve_change_order(uuid, boolean) IS
  'economic-guardrails:v2 — search_path pinned to public, pg_temp. '
  'Warning key is economic_warning_risk_score. project_id from change_orders.project_id.';

COMMENT ON FUNCTION public.rpc_convert_quote_to_invoice(uuid) IS
  'economic-guardrails:v2 — search_path pinned to public, pg_temp. '
  'Warning key is economic_warning_risk_score. project_id from quotes.project_id.';

COMMENT ON FUNCTION public.rpc_complete_project(uuid) IS
  'economic-guardrails:v2 — Warning key is economic_warning_risk_score. '
  'project_id from direct input parameter p_project_id.';
