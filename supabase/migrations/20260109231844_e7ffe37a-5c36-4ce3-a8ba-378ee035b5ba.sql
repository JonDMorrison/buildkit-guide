-- Fix Security Definer View - Use SECURITY INVOKER instead
DROP VIEW IF EXISTS v_project_progress;

CREATE VIEW v_project_progress 
WITH (security_invoker = true)
AS
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

GRANT SELECT ON v_project_progress TO authenticated;