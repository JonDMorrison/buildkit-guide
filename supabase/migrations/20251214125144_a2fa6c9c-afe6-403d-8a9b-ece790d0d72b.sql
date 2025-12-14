-- Add reliability layer columns to organization_settings
ALTER TABLE public.organization_settings
ADD COLUMN IF NOT EXISTS time_auto_close_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS time_auto_close_hours integer DEFAULT 18,
ADD COLUMN IF NOT EXISTS time_reminders_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS time_reminder_after_minutes integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS time_end_of_day_reminder_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS time_end_of_day_reminder_time_local text DEFAULT '17:00',
ADD COLUMN IF NOT EXISTS timesheet_submission_day integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS timesheet_submission_time_local text DEFAULT '16:00',
ADD COLUMN IF NOT EXISTS timesheet_escalation_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS timesheet_escalation_after_hours integer DEFAULT 24;

-- Add constraints for sane ranges
ALTER TABLE public.organization_settings
ADD CONSTRAINT time_auto_close_hours_range CHECK (time_auto_close_hours >= 8 AND time_auto_close_hours <= 36),
ADD CONSTRAINT time_reminder_after_minutes_range CHECK (time_reminder_after_minutes >= 10 AND time_reminder_after_minutes <= 180),
ADD CONSTRAINT timesheet_submission_day_range CHECK (timesheet_submission_day >= 0 AND timesheet_submission_day <= 6),
ADD CONSTRAINT timesheet_escalation_after_hours_range CHECK (timesheet_escalation_after_hours >= 1 AND timesheet_escalation_after_hours <= 168);

-- Create notification_dedupe table for tracking reminder sent times
CREATE TABLE IF NOT EXISTS public.notification_dedupe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  notification_type text NOT NULL,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(organization_id, user_id, notification_type)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_notification_dedupe_lookup 
ON public.notification_dedupe(organization_id, user_id, notification_type, last_sent_at);

-- Enable RLS on notification_dedupe
ALTER TABLE public.notification_dedupe ENABLE ROW LEVEL SECURITY;

-- No client access to notification_dedupe (edge functions only via service role)
-- No policies needed since we want to block all client access

-- Add organization_id to notifications table if not exists
-- The existing notifications table doesn't have org_id, but we'll link via project_id->project->organization_id

-- Add index for faster notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON public.notifications(user_id, is_read, created_at DESC);