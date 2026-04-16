-- Remove old duplicate task policies that predate the org-scoped set.
-- The new tasks_select_org_scoped, tasks_insert_org_scoped,
-- tasks_update_org_scoped, and tasks_worker_update_org_scoped policies
-- are the correct org-scoped versions. The old set below uses
-- is_project_member (no org check) and global is_admin/has_role --
-- redundant and inconsistent with the new set.
DROP POLICY IF EXISTS "Users can view tasks in their projects" ON public.tasks;
DROP POLICY IF EXISTS "PM, Foreman can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "PM, Foreman can update tasks" ON public.tasks;
