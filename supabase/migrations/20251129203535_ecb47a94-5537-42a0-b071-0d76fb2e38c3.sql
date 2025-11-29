-- Create voice_transcriptions table to store original voice recordings and transcriptions
CREATE TABLE IF NOT EXISTS public.voice_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  transcription_text TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create index on project_id for fast lookups
CREATE INDEX idx_voice_transcriptions_project_id ON public.voice_transcriptions(project_id);

-- Create index on user_id for fast lookups
CREATE INDEX idx_voice_transcriptions_user_id ON public.voice_transcriptions(user_id);

-- Enable RLS
ALTER TABLE public.voice_transcriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own voice transcriptions
CREATE POLICY "Users can view their own voice transcriptions"
  ON public.voice_transcriptions
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own voice transcriptions
CREATE POLICY "Users can insert their own voice transcriptions"
  ON public.voice_transcriptions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Project members can view voice transcriptions in their projects
CREATE POLICY "Project members can view voice transcriptions"
  ON public.voice_transcriptions
  FOR SELECT
  USING (is_project_member(auth.uid(), project_id));

-- Project members can insert voice transcriptions in their projects
CREATE POLICY "Project members can insert voice transcriptions"
  ON public.voice_transcriptions
  FOR INSERT
  WITH CHECK (is_project_member(auth.uid(), project_id));