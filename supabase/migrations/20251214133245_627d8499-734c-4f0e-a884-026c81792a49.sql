-- A) Duration cap enforcement: Validate based on timestamps for INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.validate_manual_entry_duration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate_minutes integer;
BEGIN
  -- Calculate duration from timestamps if both present
  IF NEW.check_in_at IS NOT NULL AND NEW.check_out_at IS NOT NULL THEN
    candidate_minutes := floor(extract(epoch from (NEW.check_out_at - NEW.check_in_at)) / 60);
    
    IF candidate_minutes > 1440 THEN
      RAISE EXCEPTION 'Time entries cannot exceed 24 hours (1440 minutes). Calculated duration: % minutes', candidate_minutes;
    END IF;
    
    IF candidate_minutes < 0 THEN
      RAISE EXCEPTION 'Check-out time cannot be before check-in time';
    END IF;
  END IF;
  
  -- Also validate duration_minutes if explicitly set (for manual adjustments)
  IF NEW.source = 'manual_adjustment' AND NEW.duration_minutes IS NOT NULL THEN
    IF NEW.duration_minutes > 1440 THEN
      RAISE EXCEPTION 'Manual entries cannot exceed 24 hours (1440 minutes). Duration: % minutes', NEW.duration_minutes;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger for both INSERT and UPDATE
DROP TRIGGER IF EXISTS validate_manual_entry_duration_trigger ON time_entries;
CREATE TRIGGER validate_manual_entry_duration_trigger
  BEFORE INSERT OR UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_manual_entry_duration();

-- B) System event dedupe: Create event_dedupe table for system-generated events
CREATE TABLE IF NOT EXISTS public.event_dedupe (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dedupe_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  last_occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS but block client access (service role only)
ALTER TABLE public.event_dedupe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to event_dedupe" ON public.event_dedupe
  FOR ALL USING (false);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_event_dedupe_key ON public.event_dedupe (dedupe_key);

-- C) Cron secret function: Create helper function to retrieve secret
CREATE OR REPLACE FUNCTION public.get_time_cron_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT secret FROM public.cron_secrets WHERE name = 'time_cron_secret'
$$;

-- Recreate cron jobs using the function instead of subquery (cleaner)
SELECT cron.unschedule('time-auto-close-cron');
SELECT cron.unschedule('time-send-reminders-cron');
SELECT cron.unschedule('time-eod-nudge-cron');
SELECT cron.unschedule('timesheet-nudges-cron');

-- Auto-close: runs every hour
SELECT cron.schedule(
  'time-auto-close-cron',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pckpfhrdrjtcjzcdfvfs.supabase.co/functions/v1/time-auto-close',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', public.get_time_cron_secret()
    )
  );
  $$
);

-- Reminders: runs every 15 minutes
SELECT cron.schedule(
  'time-send-reminders-cron',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pckpfhrdrjtcjzcdfvfs.supabase.co/functions/v1/time-send-reminders',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', public.get_time_cron_secret()
    )
  );
  $$
);

-- EOD nudge: runs every 15 minutes to catch timezone windows
SELECT cron.schedule(
  'time-eod-nudge-cron',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pckpfhrdrjtcjzcdfvfs.supabase.co/functions/v1/time-end-of-day-nudge',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', public.get_time_cron_secret()
    )
  );
  $$
);

-- Timesheet nudges: runs daily at noon UTC
SELECT cron.schedule(
  'timesheet-nudges-cron',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://pckpfhrdrjtcjzcdfvfs.supabase.co/functions/v1/timesheet-nudges',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', public.get_time_cron_secret()
    )
  );
  $$
);