-- Drop the existing INSERT policy for projects
DROP POLICY IF EXISTS "Admins and PMs can insert projects" ON public.projects;

-- Create a new INSERT policy that allows:
-- 1. Global admins (from user_roles table)
-- 2. Global project managers (from user_roles table)
-- 3. Organization admins (from organization_memberships table, for their org)
CREATE POLICY "Org admins, global admins, and PMs can insert projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  -- Global admin
  is_admin(auth.uid())
  OR
  -- Global project manager
  has_role(auth.uid(), 'project_manager'::app_role)
  OR
  -- Organization admin (can create projects in their own org)
  is_org_admin(auth.uid(), organization_id)
);