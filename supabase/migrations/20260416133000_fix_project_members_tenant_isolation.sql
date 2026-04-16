-- Close tenant leak on public.project_members.
-- Current policies gated on is_admin(auth.uid()) (global) with no tenant
-- check, letting any user with role='admin' in user_roles view every
-- org's project memberships, add themselves into any project, and remove
-- members anywhere. project_members also contains sensitive rate info
-- (cost_rate, bill_rate).
--
-- project_members has no organization_id column, so we scope via the
-- parent project using has_project_access(project_id[, roles]) which is
-- the same helper used by the org-scoped policies on tasks and
-- daily_logs.

DROP POLICY IF EXISTS "Users can view project members of their projects" ON public.project_members;
DROP POLICY IF EXISTS "Admins and PMs can add project members" ON public.project_members;
DROP POLICY IF EXISTS "Admins and PMs can remove project members" ON public.project_members;

CREATE POLICY "project_members_select_org_scoped"
  ON public.project_members FOR SELECT
  USING (public.has_project_access(project_id));

CREATE POLICY "project_members_insert_org_scoped"
  ON public.project_members FOR INSERT
  WITH CHECK (public.has_project_access(project_id, ARRAY['admin'::text, 'pm'::text]));

CREATE POLICY "project_members_delete_org_scoped"
  ON public.project_members FOR DELETE
  USING (public.has_project_access(project_id, ARRAY['admin'::text, 'pm'::text]));
