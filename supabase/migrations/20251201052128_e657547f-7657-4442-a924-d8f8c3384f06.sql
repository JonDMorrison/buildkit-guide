-- Create dashboard_layouts table to store user preferences per project
CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  layout JSONB NOT NULL DEFAULT '[]'::jsonb,
  hidden_widgets TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Enable RLS
ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- Users can view their own layouts
CREATE POLICY "Users can view their own dashboard layouts"
ON public.dashboard_layouts
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own layouts
CREATE POLICY "Users can insert their own dashboard layouts"
ON public.dashboard_layouts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own layouts
CREATE POLICY "Users can update their own dashboard layouts"
ON public.dashboard_layouts
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own layouts
CREATE POLICY "Users can delete their own dashboard layouts"
ON public.dashboard_layouts
FOR DELETE
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_dashboard_layouts_updated_at
BEFORE UPDATE ON public.dashboard_layouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();