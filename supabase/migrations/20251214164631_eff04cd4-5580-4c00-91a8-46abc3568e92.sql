-- ============================================
-- PART A: Persisted Status Flags - Complete Schema
-- ============================================

-- A1: Add missing canonical flag codes to time_flag_codes
INSERT INTO public.time_flag_codes (code, severity, description, is_active)
VALUES 
  ('offline_queued', 'info', 'Action was queued while offline', true),
  ('offline_replayed', 'info', 'Action was replayed from offline queue', true),
  ('long_open_shift_auto_closed', 'critical', 'Long open shift was auto-closed by system', true),
  ('stale_open_entry_warning', 'warning', 'Entry was open longer than expected threshold', true),
  ('overlapping_entry_attempt', 'warning', 'Attempted to create overlapping time entry', true),
  ('checkout_location_missing', 'warning', 'Location was not available at checkout', true),
  ('geofence_not_verified', 'warning', 'Geofence could not be verified due to missing location', true)
ON CONFLICT (code) DO NOTHING;

-- A2: Ensure time_entry_flags has all required columns with defaults
-- (These likely already exist but ensure consistency)
DO $$
BEGIN
  -- Check if severity column exists with proper default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'time_entry_flags' AND column_name = 'severity'
  ) THEN
    ALTER TABLE public.time_entry_flags 
    ADD COLUMN severity text NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical'));
  END IF;
  
  -- Check if created_source column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'time_entry_flags' AND column_name = 'created_source'
  ) THEN
    ALTER TABLE public.time_entry_flags 
    ADD COLUMN created_source text NOT NULL DEFAULT 'system'
    CHECK (created_source IN ('user', 'system', 'admin', 'foreman', 'pm', 'hr', 'cron'));
  END IF;
  
  -- Check if metadata column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'time_entry_flags' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.time_entry_flags 
    ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- A3: Create enriched view v_time_entries_status for UI consistency
-- This view provides badge derivation from persisted flags
CREATE OR REPLACE VIEW public.v_time_entries_status
WITH (security_invoker = true)
AS
SELECT 
  te.id,
  te.organization_id,
  te.user_id,
  te.project_id,
  te.job_site_id,
  te.check_in_at,
  te.check_out_at,
  te.duration_minutes,
  te.duration_hours,
  te.status,
  te.closed_method,
  te.source,
  te.is_flagged,
  te.flag_reason,
  te.notes,
  te.project_timezone,
  te.created_at,
  
  -- Project info
  p.name AS project_name,
  
  -- Job site info
  js.name AS job_site_name,
  
  -- User info
  prof.full_name AS user_name,
  prof.email AS user_email,
  
  -- Aggregated flags from time_entry_flags table (only unresolved)
  COALESCE(
    (SELECT array_agg(DISTINCT tef.flag_code ORDER BY tef.flag_code)
     FROM public.time_entry_flags tef
     WHERE tef.time_entry_id = te.id AND tef.resolved_at IS NULL),
    ARRAY[]::text[]
  ) AS flags,
  
  -- Max severity (critical > warning > info)
  COALESCE(
    (SELECT 
      CASE 
        WHEN bool_or(tef.severity = 'critical') THEN 'critical'
        WHEN bool_or(tef.severity = 'warning') THEN 'warning'
        WHEN bool_or(tef.severity = 'info') THEN 'info'
        ELSE NULL
      END
     FROM public.time_entry_flags tef
     WHERE tef.time_entry_id = te.id AND tef.resolved_at IS NULL),
    NULL
  ) AS max_severity,
  
  -- Boolean badge indicators derived from persisted flags
  EXISTS (
    SELECT 1 FROM public.time_entry_flags tef 
    WHERE tef.time_entry_id = te.id 
      AND tef.resolved_at IS NULL 
      AND tef.flag_code = 'manual_time_added'
  ) AS has_manual,
  
  EXISTS (
    SELECT 1 FROM public.time_entry_flags tef 
    WHERE tef.time_entry_id = te.id 
      AND tef.resolved_at IS NULL 
      AND tef.flag_code IN ('auto_closed', 'long_open_shift_auto_closed')
  ) AS has_auto_closed,
  
  EXISTS (
    SELECT 1 FROM public.time_entry_flags tef 
    WHERE tef.time_entry_id = te.id 
      AND tef.resolved_at IS NULL 
      AND tef.flag_code IN ('location_unverified', 'checkout_location_missing', 'geofence_not_verified')
  ) AS has_location_unverified,
  
  EXISTS (
    SELECT 1 FROM public.time_entry_flags tef 
    WHERE tef.time_entry_id = te.id 
      AND tef.resolved_at IS NULL 
      AND tef.flag_code IN ('offline_sync', 'offline_replayed')
  ) AS has_offline,
  
  EXISTS (
    SELECT 1 FROM public.time_entry_flags tef 
    WHERE tef.time_entry_id = te.id 
      AND tef.resolved_at IS NULL 
      AND tef.flag_code = 'gps_accuracy_low'
  ) AS has_gps_accuracy_low,
  
  EXISTS (
    SELECT 1 FROM public.time_entry_flags tef 
    WHERE tef.time_entry_id = te.id 
      AND tef.resolved_at IS NULL 
      AND tef.flag_code = 'missing_job_site'
  ) AS has_missing_job_site,
  
  EXISTS (
    SELECT 1 FROM public.time_entry_flags tef 
    WHERE tef.time_entry_id = te.id 
      AND tef.resolved_at IS NULL 
      AND tef.flag_code = 'edited_after_submission'
  ) AS has_edited_after_submission,
  
  EXISTS (
    SELECT 1 FROM public.time_entry_flags tef 
    WHERE tef.time_entry_id = te.id 
      AND tef.resolved_at IS NULL 
      AND tef.flag_code = 'long_shift'
  ) AS has_long_shift,
  
  -- Count of unresolved flags
  (SELECT COUNT(*) 
   FROM public.time_entry_flags tef 
   WHERE tef.time_entry_id = te.id AND tef.resolved_at IS NULL
  )::int AS flag_count,
  
  -- Derived: is stale (for UI derivation, not persisted)
  -- Entry is stale if open for more than 4 hours
  CASE 
    WHEN te.check_out_at IS NULL 
         AND te.check_in_at < (NOW() - INTERVAL '4 hours')
    THEN true 
    ELSE false 
  END AS is_stale

FROM public.time_entries te
LEFT JOIN public.projects p ON p.id = te.project_id
LEFT JOIN public.job_sites js ON js.id = te.job_site_id
LEFT JOIN public.profiles prof ON prof.id = te.user_id;

-- Grant appropriate permissions on the view
GRANT SELECT ON public.v_time_entries_status TO authenticated;

-- ============================================
-- PART C1: Diagnostics RPC Functions
-- ============================================

-- Diagnostic summary function (admin-only)
CREATE OR REPLACE FUNCTION public.rpc_time_diagnostics_summary(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_result jsonb;
  v_rls_tables jsonb := '[]'::jsonb;
  v_invalid_flags jsonb;
  v_cron_exists boolean;
  v_settings jsonb;
BEGIN
  -- Check caller is org admin
  v_role := org_role(p_org_id);
  IF v_role IS NULL OR v_role != 'admin' THEN
    RAISE EXCEPTION 'Only org admins can run diagnostics';
  END IF;
  
  -- Get org settings
  SELECT to_jsonb(os) INTO v_settings
  FROM organization_settings os
  WHERE os.organization_id = p_org_id;
  
  -- Check for invalid flag codes in time_entry_flags
  SELECT jsonb_agg(DISTINCT tef.flag_code)
  INTO v_invalid_flags
  FROM time_entry_flags tef
  WHERE tef.organization_id = p_org_id
    AND NOT EXISTS (
      SELECT 1 FROM time_flag_codes tfc WHERE tfc.code = tef.flag_code
    );
  
  -- Build result
  v_result := jsonb_build_object(
    'organization_id', p_org_id,
    'settings', COALESCE(v_settings, '{}'::jsonb),
    'invalid_flag_codes', COALESCE(v_invalid_flags, '[]'::jsonb),
    'tables', jsonb_build_object(
      'time_entries', (SELECT COUNT(*) FROM time_entries WHERE organization_id = p_org_id),
      'time_events', (SELECT COUNT(*) FROM time_events WHERE organization_id = p_org_id),
      'time_entry_flags', (SELECT COUNT(*) FROM time_entry_flags WHERE organization_id = p_org_id),
      'time_adjustment_requests', (SELECT COUNT(*) FROM time_adjustment_requests WHERE organization_id = p_org_id),
      'timesheet_periods', (SELECT COUNT(*) FROM timesheet_periods WHERE organization_id = p_org_id),
      'job_sites', (SELECT COUNT(*) FROM job_sites WHERE organization_id = p_org_id),
      'api_idempotency_keys', (SELECT COUNT(*) FROM api_idempotency_keys WHERE organization_id = p_org_id)
    ),
    'open_entries', (SELECT COUNT(*) FROM time_entries WHERE organization_id = p_org_id AND check_out_at IS NULL),
    'flag_codes_count', (SELECT COUNT(*) FROM time_flag_codes WHERE is_active = true),
    'cron_secret_exists', EXISTS(SELECT 1 FROM cron_secrets WHERE name = 'time_cron_secret'),
    'timestamp', NOW()
  );
  
  RETURN v_result;
END;
$$;

-- RLS probe function (admin-only, reports RLS status)
CREATE OR REPLACE FUNCTION public.rpc_time_diagnostics_rls_probe(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_tables text[] := ARRAY[
    'time_entries', 'time_events', 'time_entry_flags', 
    'time_adjustment_requests', 'timesheet_periods', 
    'job_sites', 'api_idempotency_keys', 'event_dedupe', 
    'notification_dedupe', 'cron_secrets'
  ];
  v_table text;
  v_rls_status jsonb := '[]'::jsonb;
  v_table_info record;
BEGIN
  -- Check caller is org admin
  v_role := org_role(p_org_id);
  IF v_role IS NULL OR v_role != 'admin' THEN
    RAISE EXCEPTION 'Only org admins can run RLS diagnostics';
  END IF;
  
  -- Check RLS status for each table
  FOREACH v_table IN ARRAY v_tables LOOP
    SELECT 
      c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as rls_forced,
      (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = v_table) as policy_count
    INTO v_table_info
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_table;
    
    IF v_table_info IS NOT NULL THEN
      v_rls_status := v_rls_status || jsonb_build_object(
        'table', v_table,
        'rls_enabled', v_table_info.rls_enabled,
        'rls_forced', v_table_info.rls_forced,
        'policy_count', v_table_info.policy_count,
        'status', CASE 
          WHEN v_table_info.rls_enabled THEN 'PASS'
          ELSE 'FAIL'
        END
      );
    ELSE
      v_rls_status := v_rls_status || jsonb_build_object(
        'table', v_table,
        'rls_enabled', false,
        'status', 'TABLE_NOT_FOUND'
      );
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'organization_id', p_org_id,
    'tables', v_rls_status,
    'timestamp', NOW()
  );
END;
$$;

-- ============================================
-- Cleanup function for expired idempotency keys (for cron)
-- ============================================
-- Already exists from previous migration, ensure it's current
CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.api_idempotency_keys
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;