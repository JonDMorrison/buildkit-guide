
-- ============================================================
-- FIX: Cross-org project leak via unscoped admin policy
-- Root cause: "Admins can view all projects" uses is_admin()
-- which checks user_roles (no org_id) → global admin = sees all orgs
-- ============================================================

-- Step 1: Drop the leaking policy
DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;

-- Step 2: Drop the redundant/overlapping SELECT policy
-- "Users can view their projects" is a subset of "Users can view projects they are members of or created"
DROP POLICY IF EXISTS "Users can view their projects" ON public.projects;

-- Step 3: Force RLS (so even table owner respects policies — service_role still bypasses via supabase client)
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;

-- Step 4: Create a single, strict org-scoped SELECT policy
-- Org members who are either: project members, project creators, or org admins can view projects in their org
CREATE POLICY "Org members can view their org projects"
ON public.projects
FOR SELECT
USING (
  has_org_membership(organization_id)
  AND (
    is_project_member(auth.uid(), id)
    OR created_by = auth.uid()
    OR is_org_admin(auth.uid(), organization_id)
  )
);
