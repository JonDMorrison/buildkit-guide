-- =============================================================================
-- Fix project creation RLS: allow creators to see their own projects
-- =============================================================================

-- 1) Drop existing SELECT policy on projects
DROP POLICY IF EXISTS "Users can view projects they are members of" ON public.projects;

-- 2) Create updated SELECT policy: members OR creator can view (still requires org membership)
CREATE POLICY "Users can view projects they are members of or created"
ON public.projects
FOR SELECT
USING (
  has_org_membership(organization_id)
  AND (
    is_project_member(auth.uid(), id)
    OR created_by = auth.uid()
  )
);

-- 3) Drop existing INSERT policy on projects
DROP POLICY IF EXISTS "Org members with appropriate role can insert projects" ON public.projects;

-- 4) Create tightened INSERT policy: must set created_by = self, and have admin/pm role
CREATE POLICY "Org admins and PMs can create projects"
ON public.projects
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = projects.organization_id
        AND om.role IN ('admin', 'pm')
        AND om.is_active = true
    )
  )
);

-- 5) Drop existing INSERT policy on project_members (the one with 30s window)
DROP POLICY IF EXISTS "Admin, PM, or org admin can add project members" ON public.project_members;

-- 6) Create updated INSERT policy: creator can always self-add, admins/PMs can add anyone
CREATE POLICY "Admin, PM, org admin, or creator can add project members"
ON public.project_members
FOR INSERT
WITH CHECK (
  is_admin(auth.uid())
  OR has_project_role(auth.uid(), project_id, 'project_manager'::app_role)
  OR (
    -- Org admins can add members to any project in their org
    EXISTS (
      SELECT 1
      FROM projects p
      WHERE p.id = project_members.project_id
        AND is_org_admin(auth.uid(), p.organization_id)
    )
  )
  OR (
    -- Creator can add themselves to their own project (no time limit)
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM projects p
      WHERE p.id = project_members.project_id
        AND p.created_by = auth.uid()
    )
  )
);