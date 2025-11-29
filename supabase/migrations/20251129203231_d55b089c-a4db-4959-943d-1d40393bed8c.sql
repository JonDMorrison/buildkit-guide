-- Create document_texts table for storing extracted text from uploaded documents
CREATE TABLE IF NOT EXISTS public.document_texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  attachment_id UUID REFERENCES public.attachments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(raw_text, ''))) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create index on search_vector for fast full-text search
CREATE INDEX idx_document_texts_search ON public.document_texts USING gin(search_vector);

-- Create index on project_id for project-scoped queries
CREATE INDEX idx_document_texts_project_id ON public.document_texts(project_id);

-- Enable RLS
ALTER TABLE public.document_texts ENABLE ROW LEVEL SECURITY;

-- Users can view document texts in their projects
CREATE POLICY "Users can view document texts in their projects"
  ON public.document_texts
  FOR SELECT
  USING (is_project_member(auth.uid(), project_id));

-- Project members can insert document texts
CREATE POLICY "Project members can insert document texts"
  ON public.document_texts
  FOR INSERT
  WITH CHECK (is_project_member(auth.uid(), project_id));

-- Project members can update document texts
CREATE POLICY "Project members can update document texts"
  ON public.document_texts
  FOR UPDATE
  USING (is_project_member(auth.uid(), project_id));

-- Project members can delete document texts
CREATE POLICY "Project members can delete document texts"
  ON public.document_texts
  FOR DELETE
  USING (is_project_member(auth.uid(), project_id));

-- Add trigger for updated_at
CREATE TRIGGER update_document_texts_updated_at
  BEFORE UPDATE ON public.document_texts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add document_type column to attachments table to categorize documents
ALTER TABLE public.attachments 
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'other' CHECK (document_type IN ('pdf', 'image', 'plan', 'rfi', 'permit', 'safety', 'other'));