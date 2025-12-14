-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Helper function to upsert cron jobs idempotently
CREATE OR REPLACE FUNCTION public.upsert_cron_job(
  p_job_name text,
  p_schedule text,
  p_command text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jobid bigint;
BEGIN
  -- Check if job exists
  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname = p_job_name;
  
  IF v_jobid IS NOT NULL THEN
    -- Update existing job
    PERFORM cron.alter_job(v_jobid, schedule := p_schedule, command := p_command);
  ELSE
    -- Create new job
    PERFORM cron.schedule(p_job_name, p_schedule, p_command);
  END IF;
END;
$$;

-- Remove old insecure cron jobs if they exist
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'time-auto-close-every-15-min';
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'time-send-reminders-every-30-min';
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'time-eod-nudge-hourly';
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'timesheet-nudges-daily';
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'time-auto-close-cron';
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'time-send-reminders-cron';
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'time-eod-nudge-cron';
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'timesheet-nudges-cron';