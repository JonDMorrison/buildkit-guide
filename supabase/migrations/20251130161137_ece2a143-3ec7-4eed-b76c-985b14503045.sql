
-- Fix infinite recursion in task_assignments RLS policy
-- The current policy references tasks table which references task_assignments, creating recursion

-- Drop existing SELECT policy on task_assignments
DROP POLICY IF EXISTS "Users can view task assignments in their projects" ON task_assignments;

-- Create new policy that uses is_project_member directly with a subquery
CREATE POLICY "Users can view task assignments in their projects"
ON task_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = task_assignments.task_id
      AND is_project_member(auth.uid(), t.project_id)
  )
);

-- Also update the INSERT policy to be consistent
DROP POLICY IF EXISTS "PM, Foreman can create task assignments" ON task_assignments;

CREATE POLICY "PM, Foreman can create task assignments"
ON task_assignments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = task_assignments.task_id
      AND is_project_member(auth.uid(), t.project_id)
      AND (
        is_admin(auth.uid())
        OR has_any_project_role(auth.uid(), t.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
      )
  )
);
