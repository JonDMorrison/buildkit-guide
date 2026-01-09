-- Add drawing-specific fields to attachments table
ALTER TABLE public.attachments 
ADD COLUMN IF NOT EXISTS sheet_number TEXT,
ADD COLUMN IF NOT EXISTS revision_number TEXT DEFAULT 'A',
ADD COLUMN IF NOT EXISTS revision_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS previous_revision_id UUID REFERENCES public.attachments(id);

-- Update document_type check constraint to include 'drawing' type
ALTER TABLE public.attachments DROP CONSTRAINT IF EXISTS attachments_document_type_check;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_document_type_check 
  CHECK (document_type IN ('pdf', 'image', 'plan', 'drawing', 'blueprint', 'rfi', 'permit', 'safety', 'contract', 'specification', 'other'));

-- Add budgeted_hours to tasks table for hours tracking
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS budgeted_hours DECIMAL(10,2);

-- Create scope_items table for more granular budget tracking
CREATE TABLE IF NOT EXISTS public.scope_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  budgeted_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
  trade_id UUID REFERENCES public.trades(id),
  phase TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add scope_item_id to time_entries for tracking hours against scope
ALTER TABLE public.time_entries
ADD COLUMN IF NOT EXISTS scope_item_id UUID REFERENCES public.scope_items(id),
ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id);

-- Enable RLS on scope_items
ALTER TABLE public.scope_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for scope_items
CREATE POLICY "Users can view scope items in their projects"
ON public.scope_items
FOR SELECT
USING (
  is_admin(auth.uid()) OR
  is_project_member(auth.uid(), project_id)
);

CREATE POLICY "Project managers can manage scope items"
ON public.scope_items
FOR ALL
USING (
  is_admin(auth.uid()) OR
  has_project_role(auth.uid(), project_id, 'project_manager'::app_role)
)
WITH CHECK (
  is_admin(auth.uid()) OR
  has_project_role(auth.uid(), project_id, 'project_manager'::app_role)
);

-- Create trigger for updated_at
CREATE TRIGGER update_scope_items_updated_at
  BEFORE UPDATE ON public.scope_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_scope_items_project_id ON public.scope_items(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_scope_item_id ON public.time_entries(scope_item_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON public.time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_attachments_sheet_number ON public.attachments(sheet_number) WHERE sheet_number IS NOT NULL;