-- Phase 1: Add job_number to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS job_number text;

-- Phase 3: Add sort_order to tasks for reordering
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Phase 3: Add review_requested tracking to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS review_requested_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS review_requested_by uuid REFERENCES public.profiles(id);

-- Phase 5: Create notification function for receipts to admin/accounting
CREATE OR REPLACE FUNCTION public.notify_receipt_uploaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _project RECORD;
  _admin_user RECORD;
BEGIN
  -- Get project details including job_number
  SELECT name, job_number INTO _project
  FROM projects
  WHERE id = NEW.project_id;
  
  -- Notify all users with accounting or admin role
  FOR _admin_user IN
    SELECT DISTINCT ur.user_id
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'accounting')
  LOOP
    IF user_wants_notification(_admin_user.user_id, 'general') THEN
      INSERT INTO notifications (user_id, project_id, type, title, message, link_url)
      VALUES (
        _admin_user.user_id,
        NEW.project_id,
        'general',
        'New Receipt Uploaded',
        'Receipt uploaded for ' || COALESCE(_project.job_number || ' - ', '') || _project.name,
        '/accounting/receipts'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for receipt notifications
DROP TRIGGER IF EXISTS on_receipt_uploaded ON public.receipts;
CREATE TRIGGER on_receipt_uploaded
  AFTER INSERT ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_receipt_uploaded();