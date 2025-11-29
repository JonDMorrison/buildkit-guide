-- Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  deficiency_id UUID REFERENCES public.deficiencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT comment_parent_check CHECK (
    (task_id IS NOT NULL AND deficiency_id IS NULL) OR
    (task_id IS NULL AND deficiency_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comments
CREATE POLICY "Users can view comments on accessible tasks"
ON public.comments
FOR SELECT
USING (
  (task_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = comments.task_id
      AND (
        is_admin(auth.uid()) OR
        is_project_member(auth.uid(), t.project_id)
      )
  )) OR
  (deficiency_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.deficiencies d
    WHERE d.id = comments.deficiency_id
      AND (
        is_admin(auth.uid()) OR
        is_project_member(auth.uid(), d.project_id)
      )
  ))
);

CREATE POLICY "Users can create comments on accessible items"
ON public.comments
FOR INSERT
WITH CHECK (
  (task_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = comments.task_id
      AND is_project_member(auth.uid(), t.project_id)
  )) OR
  (deficiency_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.deficiencies d
    WHERE d.id = comments.deficiency_id
      AND is_project_member(auth.uid(), d.project_id)
  ))
);

CREATE POLICY "Users can update their own comments"
ON public.comments
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments"
ON public.comments
FOR DELETE
USING (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_comments_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_comments_task_id ON public.comments(task_id);
CREATE INDEX idx_comments_deficiency_id ON public.comments(deficiency_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);

-- Add notification triggers
CREATE OR REPLACE FUNCTION public.notify_comment_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mentioned_user_id UUID;
  _project_id UUID;
  _item_title TEXT;
  _link TEXT;
BEGIN
  -- Get project_id and item details
  IF NEW.task_id IS NOT NULL THEN
    SELECT t.project_id, t.title INTO _project_id, _item_title
    FROM tasks t
    WHERE t.id = NEW.task_id;
    _link := '/tasks?taskId=' || NEW.task_id;
  ELSIF NEW.deficiency_id IS NOT NULL THEN
    SELECT d.project_id, d.title INTO _project_id, _item_title
    FROM deficiencies d
    WHERE d.id = NEW.deficiency_id;
    _link := '/deficiencies?id=' || NEW.deficiency_id;
  END IF;

  -- Notify each mentioned user
  FOREACH _mentioned_user_id IN ARRAY NEW.mentions
  LOOP
    IF user_wants_notification(_mentioned_user_id, 'general') THEN
      INSERT INTO notifications (user_id, project_id, type, title, message, link_url)
      VALUES (
        _mentioned_user_id,
        _project_id,
        'general',
        'You were mentioned',
        'You were mentioned in a comment on: ' || _item_title,
        _link
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_comment_mention
AFTER INSERT ON public.comments
FOR EACH ROW
WHEN (array_length(NEW.mentions, 1) > 0)
EXECUTE FUNCTION public.notify_comment_mention();