-- Close cross-tenant audit log leak on public.audit_log.
-- "Admins can view all audit logs" used the global is_admin(auth.uid())
-- check, letting any user with role='admin' in user_roles read every
-- tenant's audit trail. Drop it. The remaining policies are:
--   - "Users can view their own audit logs" (user_id = auth.uid())
--   - audit_log_select_org_scoped (project-scoped via has_project_access,
--     restricted to org admin/PM roles)
--
-- Tradeoff: rows with project_id IS NULL (user-level events like profile
-- edits or role changes) are now only visible to the original actor.
-- If org admins need to see those, add a separate policy joining
-- audit_log.user_id to organization_memberships in a follow-up.

DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_log;
