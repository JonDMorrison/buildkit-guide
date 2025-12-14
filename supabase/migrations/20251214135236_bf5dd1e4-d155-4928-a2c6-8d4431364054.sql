-- =====================================================
-- Time Tracking Hardening: Persisted Flags + Idempotency
-- =====================================================

-- A) Create time_flag_codes reference table
CREATE TABLE IF NOT EXISTS public.time_flag_codes (
  code text PRIMARY KEY,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  description text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.time_flag_codes ENABLE ROW LEVEL SECURITY;

-- Block all client access - service role only
CREATE POLICY "No client access to time_flag_codes" ON public.time_flag_codes
  FOR ALL USING (false);

-- Insert canonical flag codes
INSERT INTO public.time_flag_codes (code, severity, description) VALUES
  ('location_unverified', 'warning', 'Location could not be verified at check-in or check-out'),
  ('gps_accuracy_low', 'warning', 'GPS accuracy exceeded threshold (poor signal)'),
  ('geofence_not_verified', 'warning', 'Could not verify worker was inside job site geofence'),
  ('offline_sync', 'info', 'Entry was recorded offline and synced later'),
  ('offline_queued', 'info', 'Entry is queued for sync (not yet submitted)'),
  ('duplicate_tap_prevented', 'warning', 'Duplicate check-in attempt was blocked'),
  ('manual_time_added', 'warning', 'Time entry was manually created by supervisor/HR'),
  ('auto_closed', 'critical', 'Entry was automatically closed by system'),
  ('edited_after_submission', 'critical', 'Entry was modified after timesheet submission'),
  ('overlapping_entry_attempt', 'warning', 'Attempted to create overlapping time entry'),
  ('missing_job_site', 'warning', 'No job site was selected at check-in'),
  ('long_shift', 'critical', 'Shift duration exceeded normal working hours'),
  ('force_checkout', 'warning', 'Entry was forcibly closed by supervisor'),
  ('checkout_location_missing', 'warning', 'Location unavailable at check-out')
ON CONFLICT (code) DO NOTHING;

-- B) Add GPS accuracy threshold to organization_settings
ALTER TABLE public.organization_settings 
  ADD COLUMN IF NOT EXISTS time_gps_accuracy_warn_meters integer DEFAULT 100;

-- Add constraint for valid range
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'organization_settings_gps_accuracy_range'
  ) THEN
    ALTER TABLE public.organization_settings 
      ADD CONSTRAINT organization_settings_gps_accuracy_range 
      CHECK (time_gps_accuracy_warn_meters >= 10 AND time_gps_accuracy_warn_meters <= 500);
  END IF;
END $$;

-- C) Create api_idempotency_keys table for request deduplication
CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  route text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (organization_id, user_id, route, idempotency_key)
);

ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Block all client access - service role only
CREATE POLICY "No client access to api_idempotency_keys" ON public.api_idempotency_keys
  FOR ALL USING (false);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_api_idempotency_keys_expires 
  ON public.api_idempotency_keys(expires_at);

-- D) Add indexes for time_entry_flags
CREATE INDEX IF NOT EXISTS idx_time_entry_flags_org_entry 
  ON public.time_entry_flags(organization_id, time_entry_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_time_entry_flags_org_user 
  ON public.time_entry_flags(organization_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_time_entry_flags_org_project 
  ON public.time_entry_flags(organization_id, project_id, created_at DESC);

-- E) Add unique constraint for non-repeatable flags
-- Use partial unique index to prevent duplicate flags of same type on same entry
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_entry_flags_unique_per_entry_code
  ON public.time_entry_flags(organization_id, time_entry_id, flag_code)
  WHERE resolved_at IS NULL;

-- F) Function to clean up expired idempotency keys (to be called by cron)
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