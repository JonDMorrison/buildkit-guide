-- Create notification function for review requests
CREATE OR REPLACE FUNCTION public.notify_review_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _pm RECORD;
BEGIN
  -- Only trigger when review_requested_at is set (was null, now has value)
  IF OLD.review_requested_at IS NULL AND NEW.review_requested_at IS NOT NULL THEN
    -- Notify PMs and Foremen in this project
    FOR _pm IN
      SELECT DISTINCT pm.user_id
      FROM project_members pm
      WHERE pm.project_id = NEW.project_id
        AND pm.role IN ('project_manager', 'foreman')
    LOOP
      IF user_wants_notification(_pm.user_id, 'general') THEN
        INSERT INTO notifications (user_id, project_id, type, title, message, link_url)
        VALUES (
          _pm.user_id,
          NEW.project_id,
          'general',
          'Review Requested',
          'Task "' || NEW.title || '" is ready for review',
          '/tasks?taskId=' || NEW.id
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for review notifications
DROP TRIGGER IF EXISTS on_task_review_requested ON public.tasks;
CREATE TRIGGER on_task_review_requested
  AFTER UPDATE OF review_requested_at ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_review_requested();