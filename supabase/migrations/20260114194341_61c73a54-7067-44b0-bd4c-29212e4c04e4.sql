-- Create support_issues table for beta user feedback/bug reporting
CREATE TABLE public.support_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  current_route TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'bug',
  screenshot_url TEXT,
  browser_info JSONB,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT
);

-- Enable RLS
ALTER TABLE public.support_issues ENABLE ROW LEVEL SECURITY;

-- Users can create their own issues
CREATE POLICY "Users can create support issues"
ON public.support_issues
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own issues
CREATE POLICY "Users can view own support issues"
ON public.support_issues
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Org admins can view all issues in their org
CREATE POLICY "Org admins can view org support issues"
ON public.support_issues
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_memberships
    WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
  )
);

-- Org admins can update issues in their org
CREATE POLICY "Org admins can update org support issues"
ON public.support_issues
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_memberships
    WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
  )
);

-- Global admins can view and manage all issues
CREATE POLICY "Global admins can view all support issues"
ON public.support_issues
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Global admins can update all support issues"
ON public.support_issues
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create updated_at trigger
CREATE TRIGGER update_support_issues_updated_at
BEFORE UPDATE ON public.support_issues
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_support_issues_user_id ON public.support_issues(user_id);
CREATE INDEX idx_support_issues_org_id ON public.support_issues(organization_id);
CREATE INDEX idx_support_issues_status ON public.support_issues(status);