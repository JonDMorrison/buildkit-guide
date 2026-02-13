
-- Add weekly_digest column to notification_preferences
ALTER TABLE public.notification_preferences
ADD COLUMN weekly_digest boolean NOT NULL DEFAULT false;

-- Add cron secret for weekly digest
INSERT INTO public.cron_secrets (name, secret)
VALUES ('weekly_digest_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;
