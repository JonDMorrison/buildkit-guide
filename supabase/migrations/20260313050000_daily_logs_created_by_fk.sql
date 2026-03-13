-- Fix: daily_logs.created_by has no foreign key to profiles.id
-- PostgREST cannot resolve the join `profiles:created_by(full_name,email)`
-- without this FK, causing "Could not find a relationship" errors on the
-- Daily Logs page.

ALTER TABLE public.daily_logs
  ADD CONSTRAINT daily_logs_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;
