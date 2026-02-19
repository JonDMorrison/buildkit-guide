
-- ════════════════════════════════════════════════════════════════════
-- Determinism Patch: public.rpc_time_diagnostics_summary
--
-- Fix: jsonb_agg(DISTINCT tef.flag_code) → jsonb_agg(DISTINCT tef.flag_code ORDER BY tef.flag_code ASC)
-- Also: pin search_path = public, pg_temp (was: public only)
-- Output shape unchanged.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_time_diagnostics_summary(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role         text;
  v_result       jsonb;
  v_invalid_flags jsonb;
  v_settings     jsonb;
BEGIN
  -- ── Auth: org admin only ────────────────────────────────────────
  v_role := public.org_role(p_org_id);
  IF v_role IS NULL OR v_role != 'admin' THEN
    RAISE EXCEPTION 'Only org admins can run diagnostics';
  END IF;

  -- ── Org settings ────────────────────────────────────────────────
  SELECT to_jsonb(os)
    INTO v_settings
    FROM public.organization_settings os
   WHERE os.organization_id = p_org_id;

  -- ── Invalid flag codes (DETERMINISM FIX: add ORDER BY) ──────────
  --   Before: jsonb_agg(DISTINCT tef.flag_code)          ← non-deterministic
  --   After:  jsonb_agg(DISTINCT tef.flag_code ORDER BY tef.flag_code ASC)
  SELECT jsonb_agg(DISTINCT tef.flag_code ORDER BY tef.flag_code ASC)
    INTO v_invalid_flags
    FROM public.time_entry_flags tef
   WHERE tef.organization_id = p_org_id
     AND NOT EXISTS (
       SELECT 1
         FROM public.time_flag_codes tfc
        WHERE tfc.code = tef.flag_code
     );

  -- ── Build result (shape unchanged) ──────────────────────────────
  v_result := jsonb_build_object(
    'organization_id',   p_org_id,
    'settings',          COALESCE(v_settings, '{}'::jsonb),
    'invalid_flag_codes', COALESCE(v_invalid_flags, '[]'::jsonb),
    'tables', jsonb_build_object(
      'time_entries',            (SELECT COUNT(*) FROM public.time_entries             WHERE organization_id = p_org_id),
      'time_events',             (SELECT COUNT(*) FROM public.time_events              WHERE organization_id = p_org_id),
      'time_entry_flags',        (SELECT COUNT(*) FROM public.time_entry_flags         WHERE organization_id = p_org_id),
      'time_adjustment_requests',(SELECT COUNT(*) FROM public.time_adjustment_requests WHERE organization_id = p_org_id),
      'timesheet_periods',       (SELECT COUNT(*) FROM public.timesheet_periods        WHERE organization_id = p_org_id),
      'job_sites',               (SELECT COUNT(*) FROM public.job_sites                WHERE organization_id = p_org_id),
      'api_idempotency_keys',    (SELECT COUNT(*) FROM public.api_idempotency_keys     WHERE organization_id = p_org_id)
    ),
    'open_entries',       (SELECT COUNT(*) FROM public.time_entries WHERE organization_id = p_org_id AND check_out_at IS NULL),
    'flag_codes_count',   (SELECT COUNT(*) FROM public.time_flag_codes WHERE is_active = true),
    'cron_secret_exists', EXISTS(SELECT 1 FROM public.cron_secrets WHERE name = 'time_cron_secret'),
    'timestamp',          NOW()
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.rpc_time_diagnostics_summary(uuid) IS
  'Admin-only diagnostics summary for time tracking. '
  'SECURITY DEFINER, search_path pinned to public, pg_temp. '
  'Determinism patch v1: jsonb_agg now uses ORDER BY flag_code ASC.';
