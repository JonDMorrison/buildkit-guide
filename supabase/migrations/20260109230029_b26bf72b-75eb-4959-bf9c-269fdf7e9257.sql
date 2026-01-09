-- =====================================================
-- FIX: project_members RLS policies
-- 1. DELETE policy incorrectly uses has_role() (global) - should be project-scoped
-- 2. Missing UPDATE policy for role changes
-- =====================================================

-- Drop the insecure DELETE policy
DROP POLICY IF EXISTS "Admins and PMs can remove project members" ON project_members;

-- Create secure DELETE policy that checks project-level PM role
CREATE POLICY "Admins and PMs can remove project members"
  ON project_members FOR DELETE TO authenticated
  USING (
    is_admin(auth.uid())
    OR has_project_role(auth.uid(), project_id, 'project_manager'::app_role)
  );

-- Add UPDATE policy for role changes (was missing)
CREATE POLICY "Admins and PMs can update project members"
  ON project_members FOR UPDATE TO authenticated
  USING (
    is_admin(auth.uid())
    OR has_project_role(auth.uid(), project_id, 'project_manager'::app_role)
  )
  WITH CHECK (
    is_admin(auth.uid())
    OR has_project_role(auth.uid(), project_id, 'project_manager'::app_role)
  );