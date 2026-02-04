
-- FIX 1: Update project_members INSERT policy to allow project creators to add themselves
-- This handles the case where a user creates a project and needs to add themselves as PM
DROP POLICY IF EXISTS "Admin and PM can add project members" ON public.project_members;

CREATE POLICY "Admin, PM, or org admin can add project members"
ON public.project_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Global admin
  is_admin(auth.uid())
  OR
  -- Already a PM on this project (for adding other members)
  has_project_role(auth.uid(), project_id, 'project_manager'::app_role)
  OR
  -- Org admin can add members to projects in their org
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_id
    AND is_org_admin(auth.uid(), p.organization_id)
  )
  OR
  -- User adding themselves to a project they just created (within last 30 seconds)
  (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id
      AND p.created_by = auth.uid()
      AND p.created_at > now() - interval '30 seconds'
    )
  )
);

-- FIX 2: Also allow org members (not just admins) to create projects in their org
-- This is more permissive but matches typical business needs
DROP POLICY IF EXISTS "Org admins, global admins, and PMs can insert projects" ON public.projects;

CREATE POLICY "Org members with appropriate role can insert projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  -- Global admin
  is_admin(auth.uid())
  OR
  -- Global project manager role
  has_role(auth.uid(), 'project_manager'::app_role)
  OR
  -- Organization admin (can create projects in their own org)
  is_org_admin(auth.uid(), organization_id)
  OR
  -- Organization PM role (can create projects in their own org)
  EXISTS (
    SELECT 1 FROM organization_memberships om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = projects.organization_id
    AND om.role IN ('admin', 'pm')
    AND om.is_active = true
  )
);
