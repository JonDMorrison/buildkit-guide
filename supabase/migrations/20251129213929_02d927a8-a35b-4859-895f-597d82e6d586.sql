-- Create storage bucket for project documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', false);

-- RLS policies for project-documents bucket
CREATE POLICY "Project members can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM projects WHERE is_project_member(auth.uid(), id)
  )
);

CREATE POLICY "Project members can view documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM projects WHERE is_project_member(auth.uid(), id)
  )
);

CREATE POLICY "Project members can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM projects WHERE is_project_member(auth.uid(), id)
  )
);