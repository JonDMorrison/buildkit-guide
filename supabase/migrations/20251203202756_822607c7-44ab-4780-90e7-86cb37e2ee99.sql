-- Create receipts category enum
CREATE TYPE public.receipt_category AS ENUM ('fuel', 'materials', 'tools', 'meals', 'lodging', 'other');

-- Create receipts table
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  amount NUMERIC,
  currency TEXT NOT NULL DEFAULT 'CAD',
  vendor TEXT,
  category receipt_category NOT NULL DEFAULT 'other',
  notes TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_data_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_receipts_project_id ON public.receipts(project_id);
CREATE INDEX idx_receipts_uploaded_by ON public.receipts(uploaded_by);
CREATE INDEX idx_receipts_uploaded_at ON public.receipts(uploaded_at);
CREATE INDEX idx_receipts_category ON public.receipts(category);

-- Enable RLS
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Project members can view receipts
CREATE POLICY "Project members can view receipts"
ON public.receipts
FOR SELECT
USING (
  is_admin(auth.uid()) OR is_project_member(auth.uid(), project_id)
);

-- RLS Policies: Project members can insert receipts
CREATE POLICY "Project members can insert receipts"
ON public.receipts
FOR INSERT
WITH CHECK (
  is_admin(auth.uid()) OR is_project_member(auth.uid(), project_id)
);

-- RLS Policies: Users can update their own receipts, admins/PMs can update any
CREATE POLICY "Users can update own receipts or PM/Admin any"
ON public.receipts
FOR UPDATE
USING (
  is_admin(auth.uid()) 
  OR uploaded_by = auth.uid()
  OR has_project_role(auth.uid(), project_id, 'project_manager')
);

-- RLS Policies: Admins and PMs can delete receipts
CREATE POLICY "Admins and PMs can delete receipts"
ON public.receipts
FOR DELETE
USING (
  is_admin(auth.uid()) 
  OR has_project_role(auth.uid(), project_id, 'project_manager')
);

-- Create trigger for updated_at
CREATE TRIGGER update_receipts_updated_at
BEFORE UPDATE ON public.receipts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create receipts storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Project members can view receipt files
CREATE POLICY "Project members can view receipt files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'receipts' 
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.project_id::text = (storage.foldername(name))[1]
    )
  )
);

-- Storage RLS: Project members can upload receipt files
CREATE POLICY "Project members can upload receipt files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'receipts'
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.project_id::text = (storage.foldername(name))[1]
    )
  )
);

-- Storage RLS: Admins and PMs can delete receipt files
CREATE POLICY "Admins and PMs can delete receipt files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'receipts'
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.project_id::text = (storage.foldername(name))[1]
      AND pm.role = 'project_manager'
    )
  )
);