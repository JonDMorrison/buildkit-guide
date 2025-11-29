-- Create storage bucket for deficiency photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deficiency-photos',
  'deficiency-photos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
);

-- Create RLS policies for deficiency photos bucket
CREATE POLICY "Project members can view deficiency photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deficiency-photos' AND
  EXISTS (
    SELECT 1 FROM deficiencies d
    WHERE d.id::text = (storage.foldername(name))[1]
    AND is_project_member(auth.uid(), d.project_id)
  )
);

CREATE POLICY "Project members can upload deficiency photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'deficiency-photos' AND
  EXISTS (
    SELECT 1 FROM deficiencies d
    WHERE d.id::text = (storage.foldername(name))[1]
    AND is_project_member(auth.uid(), d.project_id)
  )
);

CREATE POLICY "Project members can update deficiency photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'deficiency-photos' AND
  EXISTS (
    SELECT 1 FROM deficiencies d
    WHERE d.id::text = (storage.foldername(name))[1]
    AND is_project_member(auth.uid(), d.project_id)
  )
);

CREATE POLICY "Project members can delete deficiency photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'deficiency-photos' AND
  EXISTS (
    SELECT 1 FROM deficiencies d
    WHERE d.id::text = (storage.foldername(name))[1]
    AND is_project_member(auth.uid(), d.project_id)
  )
);