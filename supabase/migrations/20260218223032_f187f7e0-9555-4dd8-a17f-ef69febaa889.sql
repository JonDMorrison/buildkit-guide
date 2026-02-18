
-- Add client_id and PM contact override fields to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id),
  ADD COLUMN IF NOT EXISTS pm_contact_name text,
  ADD COLUMN IF NOT EXISTS pm_email text,
  ADD COLUMN IF NOT EXISTS pm_phone text;

-- Index for FK lookups
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);

-- Comment for clarity
COMMENT ON COLUMN public.projects.client_id IS 'Parent client (customer) for this project';
COMMENT ON COLUMN public.projects.pm_contact_name IS 'Project-level PM contact override (falls back to client.pm_contact_name)';
COMMENT ON COLUMN public.projects.pm_email IS 'Project-level PM email override (falls back to client.pm_email)';
COMMENT ON COLUMN public.projects.pm_phone IS 'Project-level PM phone override (falls back to client.pm_phone)';
