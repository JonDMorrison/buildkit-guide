
-- Remove redundant SELECT policy (subset of new policy)
DROP POLICY IF EXISTS "Users can view projects they are members of or created" ON public.projects;

-- Fix UPDATE policy: replace unscoped is_admin() with org-scoped check
DROP POLICY IF EXISTS "Admin and PM can update projects" ON public.projects;

CREATE POLICY "Org admin and PM can update projects"
ON public.projects
FOR UPDATE
USING (
  has_org_membership(organization_id)
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR has_project_role(auth.uid(), id, 'project_manager'::app_role)
  )
);
