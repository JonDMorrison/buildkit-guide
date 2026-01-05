-- Create task_checklist_items table for persistent checklists
CREATE TABLE public.task_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

-- Create index for task lookups
CREATE INDEX idx_task_checklist_items_task_id ON public.task_checklist_items(task_id);

-- RLS Policies: Same access as parent task (via project membership)
CREATE POLICY "Project members can view checklist items"
  ON public.task_checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON pm.project_id = t.project_id
      WHERE t.id = task_checklist_items.task_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users with edit permissions can insert checklist items"
  ON public.task_checklist_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON pm.project_id = t.project_id
      WHERE t.id = task_checklist_items.task_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users with edit permissions can update checklist items"
  ON public.task_checklist_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON pm.project_id = t.project_id
      WHERE t.id = task_checklist_items.task_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users with edit permissions can delete checklist items"
  ON public.task_checklist_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON pm.project_id = t.project_id
      WHERE t.id = task_checklist_items.task_id
        AND pm.user_id = auth.uid()
    )
  );