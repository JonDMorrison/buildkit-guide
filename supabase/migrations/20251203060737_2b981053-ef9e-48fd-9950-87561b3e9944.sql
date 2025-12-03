-- Create security definer function to check if user is assigned to task
CREATE OR REPLACE FUNCTION public.is_assigned_to_task(_user_id uuid, _task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_assignments
    WHERE user_id = _user_id
      AND task_id = _task_id
  )
$$;

-- Create security definer function to get task's project_id
CREATE OR REPLACE FUNCTION public.get_task_project_id(_task_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT project_id
  FROM public.tasks
  WHERE id = _task_id
  LIMIT 1
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Project members view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view task assignments in their projects" ON public.task_assignments;
DROP POLICY IF EXISTS "Workers can update assigned task status" ON public.tasks;
DROP POLICY IF EXISTS "Users view attachments they have access to" ON public.attachments;

-- Recreate tasks SELECT policy using security definer function
CREATE POLICY "Project members view tasks" ON public.tasks
FOR SELECT USING (
  is_admin(auth.uid()) 
  OR (
    is_project_member(auth.uid(), project_id) 
    AND (
      has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
      OR (
        has_project_role(auth.uid(), project_id, 'external_trade'::app_role) 
        AND (
          assigned_trade_id IN (
            SELECT trade_id FROM project_members 
            WHERE user_id = auth.uid() AND project_id = tasks.project_id
          )
          OR is_assigned_to_task(auth.uid(), id)
        )
      )
      OR (
        has_project_role(auth.uid(), project_id, 'internal_worker'::app_role) 
        AND is_assigned_to_task(auth.uid(), id)
      )
    )
  )
);

-- Recreate task_assignments SELECT policy using security definer function
CREATE POLICY "Users can view task assignments in their projects" ON public.task_assignments
FOR SELECT USING (
  is_project_member(auth.uid(), get_task_project_id(task_id))
);

-- Recreate workers update policy using security definer function
CREATE POLICY "Workers can update assigned task status" ON public.tasks
FOR UPDATE USING (
  is_assigned_to_task(auth.uid(), id)
  AND has_any_project_role(auth.uid(), project_id, ARRAY['internal_worker'::app_role, 'external_trade'::app_role])
);

-- Recreate attachments SELECT policy using security definer functions
CREATE POLICY "Users view attachments they have access to" ON public.attachments
FOR SELECT USING (
  is_admin(auth.uid()) 
  OR (
    is_project_member(auth.uid(), project_id) 
    AND (
      has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
      OR (
        task_id IS NOT NULL 
        AND (
          is_assigned_to_task(auth.uid(), task_id)
          OR EXISTS (
            SELECT 1 FROM tasks t 
            WHERE t.id = attachments.task_id 
            AND t.assigned_trade_id IN (
              SELECT trade_id FROM project_members 
              WHERE user_id = auth.uid() AND project_id = t.project_id
            )
          )
        )
      )
      OR (
        deficiency_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM deficiencies d
          WHERE d.id = attachments.deficiency_id 
          AND (
            has_any_project_role(auth.uid(), d.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
            OR d.assigned_trade_id IN (
              SELECT trade_id FROM project_members 
              WHERE user_id = auth.uid() AND project_id = d.project_id
            )
          )
        )
      )
      OR (safety_form_id IS NOT NULL AND has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
      OR (document_type IS NOT NULL AND has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
    )
  )
);