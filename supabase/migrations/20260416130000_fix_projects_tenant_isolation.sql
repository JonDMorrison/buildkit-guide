-- Close cross-tenant leak on public.projects.
-- The global is_admin() check in "Admins can view all projects" let any
-- user with role='admin' in user_roles see, insert, and update projects
-- across every organization. Drop the leaky and redundant policies.
-- Keep only the org-scoped ones already defined:
--   SELECT: projects_select_org_members_only
--   INSERT: "Org admins and PMs can create projects"
--   UPDATE: "Org admin and PM can update projects"
--   DELETE: "Org admins can delete projects"

DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Admins and PMs can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Admins and PMs can update projects" ON public.projects;
