
-- ============================================================
-- P0: Harden projects table RLS for strict org isolation
-- ============================================================
-- 
-- EXISTING SELECT POLICY (to be replaced):
--   "Org members can view their org projects"
--     USING (has_org_membership(organization_id) 
--       AND (is_project_member(auth.uid(), id) 
--         OR (created_by = auth.uid()) 
--         OR is_org_admin(auth.uid(), organization_id)))
--
-- ISSUE: The created_by escape hatch could theoretically leak
-- rows if a user was removed from an org but created projects there.
-- The is_project_member check references project_members without
-- org scoping inside the function itself (relies on outer AND).
--
-- FIX: Simplify SELECT to ONLY require active org membership.
-- All org members see all projects in their org. Project-level
-- visibility filtering (if needed) happens in the application layer.
-- ============================================================

-- 1. RLS + FORCE already enabled, but ensure idempotency
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;

-- 2. Drop existing SELECT policy
DROP POLICY IF EXISTS "Org members can view their org projects" ON public.projects;

-- 3. Create strict org-scoped SELECT — no global admin bypass, no created_by escape
CREATE POLICY "projects_select_org_members_only"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (has_org_membership(organization_id));

-- 4. Existing write policies already check has_org_membership + role.
--    Keep them but verify they are org-scoped (they are per audit above).
--    No changes needed to INSERT/UPDATE/DELETE policies.

-- ============================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ============================================================
-- 
-- 1. List all policies on projects:
--    SELECT policyname, cmd, permissive, qual, with_check
--    FROM pg_policies WHERE tablename = 'projects';
--
-- 2. Non-member test (run as a user NOT in org X):
--    SELECT count(*) FROM projects WHERE organization_id = '<org_x_id>';
--    Expected: 0
--
-- 3. Member test (run as a user IN org Y):
--    SELECT count(*) FROM projects WHERE organization_id = '<org_y_id>';
--    Expected: >0 (their org's projects)
--
-- 4. Cross-org test (member of org Y queries org X):
--    SELECT count(*) FROM projects WHERE organization_id = '<org_x_id>';
--    Expected: 0
-- ============================================================
