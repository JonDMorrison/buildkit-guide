
-- Add guardrail_warning to notification_type enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'guardrail_warning';
