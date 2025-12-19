-- Create a dedicated bucket for task photos (public, consistent with existing deficiency photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-photos', 'task-photos', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

-- Storage RLS: allow project members (or admins) to manage objects under: {projectId}/{taskId}/{filename}
-- i.e. first folder must be the project_id.

CREATE POLICY "Project members can view task photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-photos'
  AND (
    is_admin(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT projects.id::text
      FROM public.projects
      WHERE is_project_member(auth.uid(), projects.id)
    )
  )
);

CREATE POLICY "Project members can upload task photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-photos'
  AND (
    is_admin(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT projects.id::text
      FROM public.projects
      WHERE is_project_member(auth.uid(), projects.id)
    )
  )
);

CREATE POLICY "Project members can update task photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'task-photos'
  AND (
    is_admin(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT projects.id::text
      FROM public.projects
      WHERE is_project_member(auth.uid(), projects.id)
    )
  )
)
WITH CHECK (
  bucket_id = 'task-photos'
  AND (
    is_admin(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT projects.id::text
      FROM public.projects
      WHERE is_project_member(auth.uid(), projects.id)
    )
  )
);

CREATE POLICY "Project members can delete task photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-photos'
  AND (
    is_admin(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT projects.id::text
      FROM public.projects
      WHERE is_project_member(auth.uid(), projects.id)
    )
  )
);