-- Create a simple secrets table for cron authentication
CREATE TABLE IF NOT EXISTS public.cron_secrets (
  name text PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Only allow service role to read (for edge functions)
ALTER TABLE public.cron_secrets ENABLE ROW LEVEL SECURITY;

-- No client access - only service role can read
CREATE POLICY "No client access to cron_secrets"
  ON public.cron_secrets
  FOR ALL
  USING (false);

-- Insert the cron secret
INSERT INTO public.cron_secrets (name, secret)
VALUES ('time_cron_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;