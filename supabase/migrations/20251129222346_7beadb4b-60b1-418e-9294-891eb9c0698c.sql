-- Phase 1: Expand notification_type enum with missing values
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'blocker_cleared';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'manpower_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'manpower_denied';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'deficiency_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'document_uploaded';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'incident_report';

-- Phase 3: Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  task_assigned BOOLEAN NOT NULL DEFAULT true,
  blocker_added BOOLEAN NOT NULL DEFAULT true,
  blocker_cleared BOOLEAN NOT NULL DEFAULT true,
  manpower_request BOOLEAN NOT NULL DEFAULT true,
  manpower_approved BOOLEAN NOT NULL DEFAULT true,
  manpower_denied BOOLEAN NOT NULL DEFAULT true,
  deficiency_created BOOLEAN NOT NULL DEFAULT true,
  safety_alert BOOLEAN NOT NULL DEFAULT true,
  document_uploaded BOOLEAN NOT NULL DEFAULT true,
  incident_report BOOLEAN NOT NULL DEFAULT true,
  general BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on notification_preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_preferences
CREATE POLICY "Users can view their own notification preferences"
ON public.notification_preferences
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own notification preferences"
ON public.notification_preferences
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own notification preferences"
ON public.notification_preferences
FOR UPDATE
USING (user_id = auth.uid());

-- Phase 2: Create trigger functions for automatic notifications

-- Helper function to check if user wants this notification type
CREATE OR REPLACE FUNCTION public.user_wants_notification(_user_id UUID, _notification_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _preferences RECORD;
BEGIN
  -- Get user preferences
  SELECT * INTO _preferences
  FROM notification_preferences
  WHERE user_id = _user_id;
  
  -- If no preferences exist, default to true
  IF NOT FOUND THEN
    RETURN true;
  END IF;
  
  -- Check specific preference
  CASE _notification_type
    WHEN 'task_assigned' THEN RETURN _preferences.task_assigned;
    WHEN 'blocker_added' THEN RETURN _preferences.blocker_added;
    WHEN 'blocker_cleared' THEN RETURN _preferences.blocker_cleared;
    WHEN 'manpower_request' THEN RETURN _preferences.manpower_request;
    WHEN 'manpower_approved' THEN RETURN _preferences.manpower_approved;
    WHEN 'manpower_denied' THEN RETURN _preferences.manpower_denied;
    WHEN 'deficiency_created' THEN RETURN _preferences.deficiency_created;
    WHEN 'safety_alert' THEN RETURN _preferences.safety_alert;
    WHEN 'document_uploaded' THEN RETURN _preferences.document_uploaded;
    WHEN 'incident_report' THEN RETURN _preferences.incident_report;
    WHEN 'general' THEN RETURN _preferences.general;
    ELSE RETURN true;
  END CASE;
END;
$$;

-- 1. Task Assignment Notification
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      'New Task Assigned',
      'You have been assigned to task: ' || _task.title,
      '/tasks?taskId=' || NEW.task_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_task_assigned
AFTER INSERT ON task_assignments
FOR EACH ROW
EXECUTE FUNCTION notify_task_assigned();

-- 2. Blocker Added Notification
CREATE OR REPLACE FUNCTION public.notify_blocker_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _task RECORD;
  _assignee RECORD;
BEGIN
  -- Get task details
  SELECT t.title, t.project_id
  INTO _task
  FROM tasks t
  WHERE t.id = NEW.task_id;
  
  -- Notify all assigned users
  FOR _assignee IN
    SELECT DISTINCT ta.user_id
    FROM task_assignments ta
    WHERE ta.task_id = NEW.task_id
  LOOP
    IF user_wants_notification(_assignee.user_id, 'blocker_added') THEN
      INSERT INTO notifications (user_id, project_id, type, title, message, link_url)
      VALUES (
        _assignee.user_id,
        _task.project_id,
        'blocker_added',
        'Task Blocked',
        'Task ''' || _task.title || ''' has been marked as blocked: ' || NEW.reason,
        '/tasks?taskId=' || NEW.task_id
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_blocker_added
AFTER INSERT ON blockers
FOR EACH ROW
EXECUTE FUNCTION notify_blocker_added();

-- 3. Blocker Cleared Notification
CREATE OR REPLACE FUNCTION public.notify_blocker_cleared()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _task RECORD;
  _assignee RECORD;
BEGIN
  -- Only trigger if blocker was just resolved
  IF OLD.is_resolved = false AND NEW.is_resolved = true THEN
    -- Get task details
    SELECT t.title, t.project_id
    INTO _task
    FROM tasks t
    WHERE t.id = NEW.task_id;
    
    -- Notify all assigned users
    FOR _assignee IN
      SELECT DISTINCT ta.user_id
      FROM task_assignments ta
      WHERE ta.task_id = NEW.task_id
    LOOP
      IF user_wants_notification(_assignee.user_id, 'blocker_cleared') THEN
        INSERT INTO notifications (user_id, project_id, type, title, message, link_url)
        VALUES (
          _assignee.user_id,
          _task.project_id,
          'blocker_cleared',
          'Blocker Resolved',
          'Blocker resolved for task: ' || _task.title,
          '/tasks?taskId=' || NEW.task_id
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_blocker_cleared
AFTER UPDATE ON blockers
FOR EACH ROW
EXECUTE FUNCTION notify_blocker_cleared();

-- 4. Manpower Request Created Notification
CREATE OR REPLACE FUNCTION public.notify_manpower_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _trade RECORD;
  _pm RECORD;
BEGIN
  -- Get trade name
  SELECT name INTO _trade
  FROM trades
  WHERE id = NEW.trade_id;
  
  -- Notify all project managers in this project
  FOR _pm IN
    SELECT DISTINCT pm.user_id
    FROM project_members pm
    WHERE pm.project_id = NEW.project_id
      AND (
        has_role(pm.user_id, 'project_manager'::app_role)
        OR is_admin(pm.user_id)
      )
  LOOP
    IF user_wants_notification(_pm.user_id, 'manpower_request') THEN
      INSERT INTO notifications (user_id, project_id, type, title, message, link_url)
      VALUES (
        _pm.user_id,
        NEW.project_id,
        'manpower_request',
        'Manpower Request',
        'New manpower request: ' || NEW.requested_count || ' workers for ' || _trade.name,
        '/manpower'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_manpower_request
AFTER INSERT ON manpower_requests
FOR EACH ROW
EXECUTE FUNCTION notify_manpower_request();

-- 5. Manpower Request Approved/Denied Notification
CREATE OR REPLACE FUNCTION public.notify_manpower_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _notification_type TEXT;
BEGIN
  -- Only trigger if status changed to approved or denied
  IF OLD.status = 'pending' AND (NEW.status = 'approved' OR NEW.status = 'denied') THEN
    _notification_type := CASE 
      WHEN NEW.status = 'approved' THEN 'manpower_approved'
      ELSE 'manpower_denied'
    END;
    
    IF user_wants_notification(NEW.created_by, _notification_type) THEN
      INSERT INTO notifications (user_id, project_id, type, title, message, link_url)
      VALUES (
        NEW.created_by,
        NEW.project_id,
        _notification_type::notification_type,
        'Manpower Request ' || INITCAP(NEW.status),
        'Your manpower request has been ' || NEW.status,
        '/manpower'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_manpower_decision
AFTER UPDATE ON manpower_requests
FOR EACH ROW
EXECUTE FUNCTION notify_manpower_decision();

-- 6. Deficiency Created Notification
CREATE OR REPLACE FUNCTION public.notify_deficiency_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _trade_member RECORD;
BEGIN
  -- Notify all users in the assigned trade (if a trade is assigned)
  IF NEW.assigned_trade_id IS NOT NULL THEN
    FOR _trade_member IN
      SELECT DISTINCT pm.user_id
      FROM project_members pm
      WHERE pm.project_id = NEW.project_id
        AND pm.trade_id = NEW.assigned_trade_id
    LOOP
      IF user_wants_notification(_trade_member.user_id, 'deficiency_created') THEN
        INSERT INTO notifications (user_id, project_id, type, title, message, link_url)
        VALUES (
          _trade_member.user_id,
          NEW.project_id,
          'deficiency_created',
          'New Deficiency',
          'New deficiency reported: ' || NEW.title,
          '/deficiencies?id=' || NEW.id
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_deficiency_created
AFTER INSERT ON deficiencies
FOR EACH ROW
EXECUTE FUNCTION notify_deficiency_created();

-- 7. Safety Form Submitted Notification
CREATE OR REPLACE FUNCTION public.notify_safety_form_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pm RECORD;
BEGIN
  -- Only trigger if status changed to submitted
  IF OLD.status != 'submitted' AND NEW.status = 'submitted' THEN
    -- Notify all project managers
    FOR _pm IN
      SELECT DISTINCT pm.user_id
      FROM project_members pm
      WHERE pm.project_id = NEW.project_id
        AND (
          has_role(pm.user_id, 'project_manager'::app_role)
          OR is_admin(pm.user_id)
        )
    LOOP
      IF user_wants_notification(_pm.user_id, 'safety_alert') THEN
        INSERT INTO notifications (user_id, project_id, type, title, message, link_url)
        VALUES (
          _pm.user_id,
          NEW.project_id,
          'safety_alert',
          'Safety Form Submitted',
          'Safety form submitted: ' || NEW.title,
          '/safety?formId=' || NEW.id
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_safety_form_submitted
AFTER UPDATE ON safety_forms
FOR EACH ROW
EXECUTE FUNCTION notify_safety_form_submitted();

-- 8. Document Uploaded Notification
CREATE OR REPLACE FUNCTION public.notify_document_uploaded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pm RECORD;
BEGIN
  -- Only notify for important document types
  IF NEW.document_type IN ('rfi', 'permit', 'plan', 'contract', 'specification') THEN
    -- Notify project managers
    FOR _pm IN
      SELECT DISTINCT pm.user_id
      FROM project_members pm
      WHERE pm.project_id = NEW.project_id
        AND (
          has_role(pm.user_id, 'project_manager'::app_role)
          OR is_admin(pm.user_id)
        )
        AND pm.user_id != NEW.uploaded_by  -- Don't notify the uploader
    LOOP
      IF user_wants_notification(_pm.user_id, 'document_uploaded') THEN
        INSERT INTO notifications (user_id, project_id, type, title, message, link_url)
        VALUES (
          _pm.user_id,
          NEW.project_id,
          'document_uploaded',
          'New Document',
          'New document uploaded: ' || NEW.file_name,
          '/documents'
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_document_uploaded
AFTER INSERT ON attachments
FOR EACH ROW
EXECUTE FUNCTION notify_document_uploaded();

-- Add updated_at trigger for notification_preferences
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON notification_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();