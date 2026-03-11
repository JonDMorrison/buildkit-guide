-- Create gc_deficiency_imports table
CREATE TABLE public.gc_deficiency_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  file_path TEXT NOT NULL,
  source_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'parsing', 'parsed', 'importing', 'imported', 'parse_failed')),
  total_rows INTEGER DEFAULT 0,
  horizon_rows INTEGER DEFAULT 0,
  imported_rows INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create gc_deficiency_items table
CREATE TABLE public.gc_deficiency_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID NOT NULL REFERENCES public.gc_deficiency_imports(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  raw_row_json JSONB NOT NULL,
  belongs_to_horizon BOOLEAN DEFAULT false,
  belongs_confidence NUMERIC DEFAULT 0,
  parsed_description TEXT,
  parsed_location TEXT,
  parsed_priority TEXT CHECK (parsed_priority IN ('low', 'normal', 'high') OR parsed_priority IS NULL),
  parsed_due_date TIMESTAMP WITH TIME ZONE,
  parsed_gc_trade TEXT,
  suggested_internal_scope TEXT,
  mapped_deficiency_id UUID REFERENCES public.deficiencies(id),
  is_error BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create gc_column_mappings table for saved column mappings
CREATE TABLE public.gc_column_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  mapping JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, source_name)
);

-- Create gc_import_logs table for audit trail
CREATE TABLE public.gc_import_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID NOT NULL REFERENCES public.gc_deficiency_imports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  items_imported INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_gc_deficiency_imports_project ON public.gc_deficiency_imports(project_id);
CREATE INDEX idx_gc_deficiency_items_import ON public.gc_deficiency_items(import_id);
CREATE INDEX idx_gc_deficiency_items_horizon ON public.gc_deficiency_items(belongs_to_horizon, belongs_confidence);
CREATE INDEX idx_gc_column_mappings_project ON public.gc_column_mappings(project_id, source_name);

-- Enable RLS
ALTER TABLE public.gc_deficiency_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_deficiency_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_column_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_import_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gc_deficiency_imports
CREATE POLICY "Users can view imports for their projects"
ON public.gc_deficiency_imports FOR SELECT
USING (is_admin(auth.uid()) OR is_project_member(auth.uid(), project_id));

CREATE POLICY "PM and Foreman can create imports"
ON public.gc_deficiency_imports FOR INSERT
WITH CHECK (is_admin(auth.uid()) OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]));

CREATE POLICY "PM can update imports"
ON public.gc_deficiency_imports FOR UPDATE
USING (is_admin(auth.uid()) OR has_project_role(auth.uid(), project_id, 'project_manager'::app_role));

-- RLS Policies for gc_deficiency_items
CREATE POLICY "Users can view items for their project imports"
ON public.gc_deficiency_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.gc_deficiency_imports i
  WHERE i.id = gc_deficiency_items.import_id
  AND (is_admin(auth.uid()) OR is_project_member(auth.uid(), i.project_id))
));

CREATE POLICY "PM can insert items"
ON public.gc_deficiency_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.gc_deficiency_imports i
  WHERE i.id = gc_deficiency_items.import_id
  AND (is_admin(auth.uid()) OR has_project_role(auth.uid(), i.project_id, 'project_manager'::app_role))
));

CREATE POLICY "PM can update items"
ON public.gc_deficiency_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.gc_deficiency_imports i
  WHERE i.id = gc_deficiency_items.import_id
  AND (is_admin(auth.uid()) OR has_project_role(auth.uid(), i.project_id, 'project_manager'::app_role))
));

-- RLS Policies for gc_column_mappings
CREATE POLICY "Users can view mappings for their projects"
ON public.gc_column_mappings FOR SELECT
USING (is_admin(auth.uid()) OR is_project_member(auth.uid(), project_id));

CREATE POLICY "PM can manage mappings"
ON public.gc_column_mappings FOR ALL
USING (is_admin(auth.uid()) OR has_project_role(auth.uid(), project_id, 'project_manager'::app_role));

-- RLS Policies for gc_import_logs
CREATE POLICY "Users can view logs for their project imports"
ON public.gc_import_logs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.gc_deficiency_imports i
  WHERE i.id = gc_import_logs.import_id
  AND (is_admin(auth.uid()) OR is_project_member(auth.uid(), i.project_id))
));

CREATE POLICY "System can insert logs"
ON public.gc_import_logs FOR INSERT
WITH CHECK (true);

-- Create storage bucket for GC deficiency uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('gc_deficiency_uploads', 'gc_deficiency_uploads', false) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Project members can upload GC files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'gc_deficiency_uploads' AND auth.role() = 'authenticated');

CREATE POLICY "Project members can view GC files"
ON storage.objects FOR SELECT
USING (bucket_id = 'gc_deficiency_uploads' AND auth.role() = 'authenticated');

CREATE POLICY "PM can delete GC files"
ON storage.objects FOR DELETE
USING (bucket_id = 'gc_deficiency_uploads' AND auth.role() = 'authenticated');

-- Update trigger for updated_at
CREATE TRIGGER update_gc_deficiency_imports_updated_at
BEFORE UPDATE ON public.gc_deficiency_imports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gc_column_mappings_updated_at
BEFORE UPDATE ON public.gc_column_mappings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();