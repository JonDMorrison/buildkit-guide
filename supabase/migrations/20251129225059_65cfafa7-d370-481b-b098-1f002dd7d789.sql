-- Create invitations table for email invitation system
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() + interval '7 days',
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admin can manage all invitations
CREATE POLICY "Admins can manage invitations"
ON public.invitations
FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- Users can view invitations they sent
CREATE POLICY "Users can view their own invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (invited_by = auth.uid());

-- Add updated_at trigger
CREATE TRIGGER update_invitations_updated_at
BEFORE UPDATE ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create daily_logs table for daily log module
CREATE TABLE public.daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  weather TEXT,
  temperature TEXT,
  crew_count INTEGER,
  work_performed TEXT NOT NULL,
  issues TEXT,
  next_day_plan TEXT,
  safety_notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, log_date)
);

-- Enable RLS
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

-- PM and Foreman can create daily logs
CREATE POLICY "PM and Foreman can create daily logs"
ON public.daily_logs
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR 
  has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
);

-- PM and Foreman can view daily logs in their projects
CREATE POLICY "PM and Foreman can view daily logs"
ON public.daily_logs
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid()) OR 
  has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
);

-- PM and Foreman can update their own daily logs
CREATE POLICY "PM and Foreman can update daily logs"
ON public.daily_logs
FOR UPDATE
TO authenticated
USING (
  is_admin(auth.uid()) OR 
  (created_by = auth.uid() AND has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
);

-- Add updated_at trigger
CREATE TRIGGER update_daily_logs_updated_at
BEFORE UPDATE ON public.daily_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_status ON public.invitations(status);
CREATE INDEX idx_daily_logs_project_date ON public.daily_logs(project_id, log_date DESC);