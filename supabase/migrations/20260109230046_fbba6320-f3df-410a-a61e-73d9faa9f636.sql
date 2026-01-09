-- =====================================================
-- FIX: gc_import_logs INSERT policy that uses USING (true)
-- This is a system logging table, should only allow inserts via edge functions
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert logs" ON gc_import_logs;

-- Create restrictive policy - only users who uploaded the import can log against it
CREATE POLICY "Users can insert logs for their imports"
  ON gc_import_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gc_deficiency_imports gdi
      WHERE gdi.id = gc_import_logs.import_id
      AND (
        gdi.uploaded_by = auth.uid()
        OR is_admin(auth.uid())
        OR has_project_role(auth.uid(), gdi.project_id, 'project_manager'::app_role)
      )
    )
  );