-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS on_task_assignment_created ON task_assignments;

-- Create or replace the notification function for task assignments
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  _task RECORD;
BEGIN
  -- Get task details
  SELECT t.title, t.project_id
  INTO _task
  FROM tasks t
  WHERE t.id = NEW.task_id;
  
  -- Check if user wants this notification
  IF user_wants_notification(NEW.user_id, 'task_assigned') THEN
    -- Create notification for assigned user
    INSERT INTO notifications (user_id, project_id, type, title, message, link_url)
    VALUES (
      NEW.user_id,
      _task.project_id,
      'task_assigned',
      'Task Assigned',
      'You have been assigned to: ' || _task.title,
      '/tasks?taskId=' || NEW.task_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for task assignment notifications
CREATE TRIGGER on_task_assignment_created
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assignment();