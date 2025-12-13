-- Fix organization_memberships role values to align with existing app_role enum
-- Note: The existing app_role enum uses: admin, project_manager, foreman, internal_worker, external_trade, accounting

-- Add missing composite indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_org 
ON public.organization_memberships(user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_org_memberships_org_role 
ON public.organization_memberships(organization_id, role);

-- Create has_org_membership function (uses auth.uid() internally)
CREATE OR REPLACE FUNCTION public.has_org_membership(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships
    WHERE user_id = auth.uid()
      AND organization_id = _org_id
      AND is_active = true
  )
$$;

-- Create org_role function to get user's role in an org
CREATE OR REPLACE FUNCTION public.org_role(_org_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.organization_memberships
  WHERE user_id = auth.uid()
    AND organization_id = _org_id
    AND is_active = true
  LIMIT 1
$$;

-- Create has_project_membership function that validates project AND org membership
CREATE OR REPLACE FUNCTION public.has_project_membership(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    INNER JOIN public.projects p ON p.id = pm.project_id
    WHERE pm.project_id = _project_id
      AND pm.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.organization_memberships om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = p.organization_id
          AND om.is_active = true
      )
  )
$$;

-- Remove hard delete policy for organization_memberships (use soft-delete via is_active)
DROP POLICY IF EXISTS "Org admins can delete memberships" ON public.organization_memberships;

-- Update projects SELECT policies to include org membership validation
DROP POLICY IF EXISTS "Users can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;

CREATE POLICY "Admins can view all projects"
ON public.projects
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their projects"
ON public.projects
FOR SELECT
USING (
  is_project_member(auth.uid(), id) 
  AND has_org_membership(organization_id)
);