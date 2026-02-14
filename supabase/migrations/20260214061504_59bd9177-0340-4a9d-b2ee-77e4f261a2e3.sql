
-- Harden INSERT policy: replace unscoped is_admin() with org-scoped check
DROP POLICY IF EXISTS "Org admins and PMs can create projects" ON public.projects;

CREATE POLICY "Org admins and PMs can create projects"
ON public.projects
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND has_org_membership(organization_id)
  AND (
    is_org_admin(auth.uid(), organization_id)
    OR org_role(organization_id) IN ('pm')
  )
);

-- Explicit DELETE policy: org admins only
CREATE POLICY "Org admins can delete projects"
ON public.projects
FOR DELETE
USING (
  has_org_membership(organization_id)
  AND is_org_admin(auth.uid(), organization_id)
);
