-- Drop and recreate view with correct column order
DROP VIEW IF EXISTS public.v_time_entries_status;

CREATE VIEW public.v_time_entries_status
WITH (security_invoker = true)
AS
SELECT 
  te.id,
  te.organization_id,
  te.user_id,
  te.project_id,
  te.job_site_id,
  te.project_timezone,
  te.check_in_at,
  te.check_in_latitude,
  te.check_in_longitude,
  te.check_out_at,
  te.check_out_latitude,
  te.check_out_longitude,
  te.duration_minutes,
  te.duration_hours,
  te.status,
  te.source,
  te.notes,
  te.is_flagged,
  te.flag_reason,
  te.closed_by,
  te.closed_method,
  te.created_at,
  -- Aggregated flags array
  COALESCE(
    (SELECT array_agg(DISTINCT tef.flag_code ORDER BY tef.flag_code)
     FROM public.time_entry_flags tef
     WHERE tef.time_entry_id = te.id AND tef.resolved_at IS NULL),
    ARRAY[]::text[]
  ) AS flags,
  -- Max severity level as int
  COALESCE(
    (SELECT MAX(CASE tef.severity 
      WHEN 'critical' THEN 3
      WHEN 'warning' THEN 2
      WHEN 'info' THEN 1
      ELSE 0
    END)
     FROM public.time_entry_flags tef
     WHERE tef.time_entry_id = te.id AND tef.resolved_at IS NULL),
    0
  ) AS max_severity_level,
  -- Max severity as text
  COALESCE(
    (SELECT CASE MAX(CASE tef.severity 
      WHEN 'critical' THEN 3
      WHEN 'warning' THEN 2
      WHEN 'info' THEN 1
      ELSE 0
    END)
      WHEN 3 THEN 'critical'
      WHEN 2 THEN 'warning'
      WHEN 1 THEN 'info'
      ELSE NULL
    END
     FROM public.time_entry_flags tef
     WHERE tef.time_entry_id = te.id AND tef.resolved_at IS NULL),
    NULL
  ) AS max_severity,
  -- Boolean flags for common badges
  EXISTS (
    SELECT 1 FROM public.time_entry_flags tef
    WHERE tef.time_entry_id = te.id AND tef.resolved_at IS NULL
    AND tef.flag_code = 'manual_time_added'
  ) AS has_manual,
  EXISTS (
    SELECT 1 FROM public.time_entry_flags tef
    WHERE tef.time_entry_id = te.id AND tef.resolved_at IS NULL
    AND tef.flag_code IN ('auto_closed', 'long_open_shift_auto_closed')
  ) AS has_auto_closed,
  EXISTS (
    SELECT 1 FROM public.time_entry_flags tef
    WHERE tef.time_entry_id = te.id AND tef.resolved_at IS NULL
    AND tef.flag_code IN ('location_unverified', 'checkout_location_missing', 'geofence_not_verified')
  ) AS has_location_unverified,
  -- Fix: Include offline_queued, offline_replayed, AND offline_sync for backwards compatibility
  EXISTS (
    SELECT 1 FROM public.time_entry_flags tef
    WHERE tef.time_entry_id = te.id AND tef.resolved_at IS NULL
    AND tef.flag_code IN ('offline_queued', 'offline_replayed', 'offline_sync')
  ) AS has_offline,
  EXISTS (
    SELECT 1 FROM public.time_entry_flags tef
    WHERE tef.time_entry_id = te.id AND tef.resolved_at IS NULL
    AND tef.flag_code = 'gps_accuracy_low'
  ) AS has_gps_low,
  EXISTS (
    SELECT 1 FROM public.time_entry_flags tef
    WHERE tef.time_entry_id = te.id AND tef.resolved_at IS NULL
    AND tef.flag_code = 'missing_job_site'
  ) AS has_missing_job_site,
  EXISTS (
    SELECT 1 FROM public.time_entry_flags tef
    WHERE tef.time_entry_id = te.id AND tef.resolved_at IS NULL
    AND tef.flag_code = 'edited_after_submission'
  ) AS has_edited_after_submission,
  EXISTS (
    SELECT 1 FROM public.time_entry_flags tef
    WHERE tef.time_entry_id = te.id AND tef.resolved_at IS NULL
    AND tef.flag_code = 'long_shift'
  ) AS has_long_shift,
  -- Derived: is_stale (open entry older than 4 hours - NOT persisted, computed)
  (te.check_out_at IS NULL AND te.check_in_at < NOW() - INTERVAL '4 hours') AS is_stale
FROM public.time_entries te;

-- Fix 2: Update RLS probe RPC to correctly append JSON array elements
CREATE OR REPLACE FUNCTION public.rpc_time_diagnostics_rls_probe(p_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      -- Fix: Use jsonb_build_array to properly append to array
      v_rls_status := v_rls_status || jsonb_build_array(jsonb_build_object(
        'table', v_table,
        'rls_enabled', v_table_info.rls_enabled,
        'rls_forced', v_table_info.rls_forced,
        'policy_count', v_table_info.policy_count,
        'status', CASE 
          WHEN v_table_info.rls_enabled THEN 'PASS'
          ELSE 'FAIL'
        END
      ));
    ELSE
      v_rls_status := v_rls_status || jsonb_build_array(jsonb_build_object(
        'table', v_table,
        'rls_enabled', false,
        'status', 'TABLE_NOT_FOUND'
      ));
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'organization_id', p_org_id,
    'tables', v_rls_status,
    'timestamp', NOW()
  );
END;
$function$;