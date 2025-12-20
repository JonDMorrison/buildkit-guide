-- Allow workers to create Right to Refuse safety forms specifically
-- This is a BC compliance requirement

-- First, drop the existing insert policy
DROP POLICY IF EXISTS "Foreman+ can create safety forms" ON public.safety_forms;

-- Create new insert policy that allows:
-- 1. PM/Foreman: can create any safety form type
-- 2. Workers (internal_worker, external_trade): can ONLY create right_to_refuse forms
CREATE POLICY "Users can create safety forms based on role and type"
ON public.safety_forms
FOR INSERT
WITH CHECK (
  -- Admins can do anything
  is_admin(auth.uid()) 
  OR 
  -- PM/Foreman can create any form type
  has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
  OR
  -- Workers can ONLY create right_to_refuse forms (BC compliance)
  (
    has_any_project_role(auth.uid(), project_id, ARRAY['internal_worker'::app_role, 'external_trade'::app_role])
    AND form_type = 'right_to_refuse'
  )
);

-- Also update the SELECT policy to allow workers to view right_to_refuse forms they created
DROP POLICY IF EXISTS "PM, Foreman view safety forms" ON public.safety_forms;

CREATE POLICY "Users can view safety forms based on role"
ON public.safety_forms
FOR SELECT
USING (
  is_admin(auth.uid()) 
  OR 
  -- PM/Foreman can view all forms in their projects
  has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
  OR
  -- Workers can view right_to_refuse forms they created
  (
    has_any_project_role(auth.uid(), project_id, ARRAY['internal_worker'::app_role, 'external_trade'::app_role])
    AND form_type = 'right_to_refuse'
    AND created_by = auth.uid()
  )
);

-- Create notification function for Right to Refuse submissions
CREATE OR REPLACE FUNCTION public.notify_right_to_refuse_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _pm RECORD;
  _worker_name TEXT;
BEGIN
  -- Only trigger for right_to_refuse forms
  IF NEW.form_type = 'right_to_refuse' AND NEW.status = 'submitted' THEN
    -- Get worker name
    SELECT full_name INTO _worker_name
    FROM profiles
    WHERE id = NEW.created_by;
    
    -- Notify all project managers and foremen
    FOR _pm IN
      SELECT DISTINCT pm.user_id
      FROM project_members pm
      WHERE pm.project_id = NEW.project_id
        AND pm.role IN ('project_manager', 'foreman')
        AND pm.user_id != NEW.created_by
    LOOP
      IF user_wants_notification(_pm.user_id, 'safety_alert') THEN
        INSERT INTO notifications (user_id, project_id, type, title, message, link_url)
        VALUES (
          _pm.user_id,
          NEW.project_id,
          'safety_alert',
          'Right to Refuse Submitted',
          COALESCE(_worker_name, 'A worker') || ' has submitted a Right to Refuse Unsafe Work form',
          '/safety?formId=' || NEW.id
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for Right to Refuse notifications
DROP TRIGGER IF EXISTS tr_notify_right_to_refuse ON public.safety_forms;
CREATE TRIGGER tr_notify_right_to_refuse
  AFTER INSERT ON public.safety_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_right_to_refuse_submitted();