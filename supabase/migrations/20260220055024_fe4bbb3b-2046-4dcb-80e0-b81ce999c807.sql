
-- ═══════════════════════════════════════════════════════════════════════════
-- Economic gate helper (private, not callable externally)
-- Returns: v_risk_score, raises 'economic_blocked' if >= 60.
-- Caller adds 'economic_warning' to their success payload if 30-59.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public._internal_economic_gate(p_project_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_margin  jsonb;
  v_score   int;
BEGIN
  -- rpc_generate_project_margin_control enforces its own membership guard;
  -- we propagate any exceptions it raises (not_authorized, project_not_found).
  v_margin := public.rpc_generate_project_margin_control(p_project_id);
  v_score  := (v_margin->>'risk_score')::int;

  IF v_score >= 60 THEN
    RAISE EXCEPTION 'economic_blocked: risk_score=% exceeds threshold for this operation', v_score
      USING ERRCODE = '42501';
  END IF;

  RETURN v_score;   -- caller checks >= 30 for warning
END;
$$;

-- Restrict: internal-only, not callable by any role directly
REVOKE ALL ON FUNCTION public._internal_economic_gate(uuid) FROM PUBLIC, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. rpc_convert_quote_to_invoice  (was: delegate-only, returns jsonb)
--    Gate runs BEFORE the delegate so no invoice is created on block.
--    On warn (30-59): success payload gains { economic_warning, risk_score }.
--    On clean (<30):  success payload is unchanged.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rpc_convert_quote_to_invoice(p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id uuid;
  v_risk_score  int;
  v_invoice_id  text;
BEGIN
  -- Resolve project_id before the gate so we can call the margin engine.
  SELECT project_id INTO v_project_id
  FROM   public.quotes
  WHERE  id = p_quote_id;

  IF NOT FOUND OR v_project_id IS NULL THEN
    -- Let the delegate raise its own canonical errors.
    v_project_id := NULL;
  END IF;

  -- ── Economic gate (only when project_id is known) ──────────────────────
  IF v_project_id IS NOT NULL THEN
    v_risk_score := public._internal_economic_gate(v_project_id);
  END IF;

  -- ── Delegate to canonical implementation ──────────────────────────────
  v_invoice_id := public.convert_quote_to_invoice(p_quote_id, auth.uid());

  -- ── Return ────────────────────────────────────────────────────────────
  -- Base success shape preserved; economic_warning appended only when needed.
  IF v_risk_score >= 30 THEN
    RETURN jsonb_build_object(
      'invoice_id',        v_invoice_id,
      'economic_warning',  true,
      'risk_score',        v_risk_score
    );
  END IF;

  RETURN jsonb_build_object('invoice_id', v_invoice_id);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. rpc_approve_change_order  (project_id comes from v_co record)
--    Gate runs after the change-order is fetched (so membership/role checks
--    already happened) but before the UPDATE.
--    Existing success shape: { "status": "approved" | "rejected" }
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rpc_approve_change_order(
  p_change_order_id uuid,
  p_approved        boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_risk_score := public._internal_economic_gate(v_co.project_id);

  -- ── Existing write logic (unchanged) ─────────────────────────────────────
  PERFORM rpc_recalculate_change_order_totals(p_change_order_id);

  UPDATE change_orders SET
    status     = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
    approved_by = v_user_id,
    amount     = total,
    updated_at = now()
  WHERE id = p_change_order_id;

  -- ── Return ────────────────────────────────────────────────────────────────
  v_result := jsonb_build_object(
    'status', CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END
  );

  IF v_risk_score >= 30 THEN
    v_result := v_result || jsonb_build_object(
      'economic_warning', true,
      'risk_score',       v_risk_score
    );
  END IF;

  RETURN v_result;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. rpc_complete_project  (new; sets status = 'completed')
--    Security: authenticated + org membership (via rpc_is_org_member) +
--              role gate (admin or project_manager only).
--    Success shape: { "status": "completed", "project_id": "..." }
--    Warning:       above + { "economic_warning": true, "risk_score": N }
-- ═══════════════════════════════════════════════════════════════════════════
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
  -- ── Auth ──────────────────────────────────────────────────────────────────
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- ── Project existence + org resolution ───────────────────────────────────
  SELECT organization_id INTO v_org_id
  FROM   public.projects
  WHERE  id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = '42501';
  END IF;

  -- ── Org membership ────────────────────────────────────────────────────────
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
      'economic_warning', true,
      'risk_score',       v_risk_score
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Security posture for rpc_complete_project
REVOKE ALL ON FUNCTION public.rpc_complete_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_complete_project(uuid) TO authenticated;
