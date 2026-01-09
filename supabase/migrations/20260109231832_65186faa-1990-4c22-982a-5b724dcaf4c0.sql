-- Phase 1: Critical Security - Fix Invitation RLS Policy
-- Remove overly permissive SELECT policy and replace with token-based lookup only

-- First drop the existing permissive policy
DROP POLICY IF EXISTS "Invitees can view their invitation by token" ON invitations;

-- Create a more restrictive policy that only allows:
-- 1. Users to see invitations they created
-- 2. Token-based lookup via RPC (handled separately)
CREATE POLICY "Users can view invitations they created"
ON invitations FOR SELECT
USING (invited_by = auth.uid());

-- Create policy for authenticated users to view their own pending invitations by email
CREATE POLICY "Users can view invitations sent to their email"
ON invitations FOR SELECT
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Phase 2: Performance - Add Missing Database Indexes
CREATE INDEX IF NOT EXISTS idx_attachments_document_type ON attachments(document_type) WHERE document_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_budgeted_hours ON tasks(budgeted_hours) WHERE budgeted_hours IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_safety_forms_project_date ON safety_forms(project_id, created_at) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_blockers_task_resolved ON blockers(task_id, is_resolved);

-- Create a view for project progress to eliminate N+1 queries
CREATE OR REPLACE VIEW v_project_progress AS
SELECT 
  p.id,
  p.name,
  p.location,
  p.status,
  p.organization_id,
  COUNT(t.id) as total_tasks,
  COUNT(t.id) FILTER (WHERE t.status = 'done') as completed_tasks,
  COUNT(t.id) FILTER (WHERE t.status = 'blocked') as blocked_tasks
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id AND t.is_deleted = false
WHERE p.is_deleted = false
GROUP BY p.id, p.name, p.location, p.status, p.organization_id;

-- Grant access to authenticated users
GRANT SELECT ON v_project_progress TO authenticated;