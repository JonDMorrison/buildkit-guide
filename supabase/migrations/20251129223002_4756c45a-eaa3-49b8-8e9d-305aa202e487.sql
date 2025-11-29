-- Phase 1: Extend app_role enum with new roles
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'project_manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'foreman';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'internal_worker';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'external_trade';

-- Phase 2: Add role column to project_members
ALTER TABLE public.project_members 
ADD COLUMN IF NOT EXISTS role app_role;

-- Update existing project_members to have a default role (foreman) if null
UPDATE public.project_members 
SET role = 'foreman' 
WHERE role IS NULL;

-- Make role required going forward
ALTER TABLE public.project_members 
ALTER COLUMN role SET NOT NULL;

-- Phase 3: Create helper functions for project-specific role checks

-- Check if user has a specific role on a project
CREATE OR REPLACE FUNCTION public.has_project_role(_user_id uuid, _project_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE user_id = _user_id
      AND project_id = _project_id
      AND role = _role
  )
$$;

-- Check if user has any of multiple roles on a project
CREATE OR REPLACE FUNCTION public.has_any_project_role(_user_id uuid, _project_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE user_id = _user_id
      AND project_id = _project_id
      AND role = ANY(_roles)
  )
$$;

-- Get user's role on a specific project
CREATE OR REPLACE FUNCTION public.get_user_project_role(_user_id uuid, _project_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.project_members
  WHERE user_id = _user_id
    AND project_id = _project_id
  LIMIT 1
$$;

-- Check if user can manage project (Admin or PM)
CREATE OR REPLACE FUNCTION public.can_manage_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin(_user_id) OR has_project_role(_user_id, _project_id, 'project_manager')
$$;

-- Phase 4: Update RLS policies for tasks table
DROP POLICY IF EXISTS "PM, Foreman can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "PM, Foreman can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks in their projects" ON public.tasks;
DROP POLICY IF EXISTS "Workers can update assigned task status" ON public.tasks;
DROP POLICY IF EXISTS "Project members view tasks" ON public.tasks;

-- Create: PM and Foreman can create tasks
CREATE POLICY "PM, Foreman can create tasks"
ON public.tasks
FOR INSERT
WITH CHECK (
  is_admin(auth.uid()) OR
  has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
);

-- Update: PM and Foreman can update all fields
CREATE POLICY "PM, Foreman can update tasks"
ON public.tasks
FOR UPDATE
USING (
  is_admin(auth.uid()) OR
  has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
);

-- Update: Workers can only update status on assigned tasks
CREATE POLICY "Workers can update assigned task status"
ON public.tasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM task_assignments ta
    WHERE ta.task_id = tasks.id
      AND ta.user_id = auth.uid()
  )
  AND has_any_project_role(auth.uid(), project_id, ARRAY['internal_worker'::app_role, 'external_trade'::app_role])
);

-- Read: All project members can view, scoped by role
CREATE POLICY "Project members view tasks"
ON public.tasks
FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (
    is_project_member(auth.uid(), project_id) AND
    (
      -- PM, Foreman see all project tasks
      has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]) OR
      -- External Trade only sees tasks for their trade
      (
        has_project_role(auth.uid(), project_id, 'external_trade') AND
        (
          assigned_trade_id IN (
            SELECT trade_id FROM project_members
            WHERE user_id = auth.uid() AND project_id = tasks.project_id
          ) OR
          EXISTS (
            SELECT 1 FROM task_assignments ta
            WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
          )
        )
      ) OR
      -- Internal Worker sees only assigned tasks
      (
        has_project_role(auth.uid(), project_id, 'internal_worker') AND
        EXISTS (
          SELECT 1 FROM task_assignments ta
          WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
        )
      )
    )
  )
);

-- Phase 5: Update RLS policies for blockers
DROP POLICY IF EXISTS "Foreman+ can create blockers" ON public.blockers;
DROP POLICY IF EXISTS "PM can update blockers" ON public.blockers;
DROP POLICY IF EXISTS "Users can view blockers in their projects" ON public.blockers;
DROP POLICY IF EXISTS "PM can clear blockers" ON public.blockers;
DROP POLICY IF EXISTS "Users can view blockers they have access to" ON public.blockers;

CREATE POLICY "Foreman+ can create blockers"
ON public.blockers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = blockers.task_id
      AND (
        is_admin(auth.uid()) OR
        has_any_project_role(auth.uid(), t.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
      )
  )
);

CREATE POLICY "PM can clear blockers"
ON public.blockers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = blockers.task_id
      AND (
        is_admin(auth.uid()) OR
        has_project_role(auth.uid(), t.project_id, 'project_manager')
      )
  )
);

CREATE POLICY "Users can view blockers they have access to"
ON public.blockers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = blockers.task_id
      AND (
        is_admin(auth.uid()) OR
        is_project_member(auth.uid(), t.project_id)
      )
  )
);

-- Phase 6: Update RLS policies for deficiencies
DROP POLICY IF EXISTS "Project members can create deficiencies" ON public.deficiencies;
DROP POLICY IF EXISTS "PM+ can update deficiencies" ON public.deficiencies;
DROP POLICY IF EXISTS "Users can view deficiencies in their projects" ON public.deficiencies;
DROP POLICY IF EXISTS "PM, Foreman can create deficiencies" ON public.deficiencies;
DROP POLICY IF EXISTS "PM can update deficiencies" ON public.deficiencies;
DROP POLICY IF EXISTS "Users view deficiencies in scope" ON public.deficiencies;

CREATE POLICY "PM, Foreman can create deficiencies"
ON public.deficiencies
FOR INSERT
WITH CHECK (
  is_admin(auth.uid()) OR
  has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
);

CREATE POLICY "PM can update deficiencies"
ON public.deficiencies
FOR UPDATE
USING (
  is_admin(auth.uid()) OR
  has_project_role(auth.uid(), project_id, 'project_manager')
);

CREATE POLICY "Users view deficiencies in scope"
ON public.deficiencies
FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (
    is_project_member(auth.uid(), project_id) AND
    (
      -- PM, Foreman see all deficiencies
      has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]) OR
      -- External Trade sees deficiencies for their trade
      (
        has_project_role(auth.uid(), project_id, 'external_trade') AND
        assigned_trade_id IN (
          SELECT trade_id FROM project_members
          WHERE user_id = auth.uid() AND project_id = deficiencies.project_id
        )
      )
    )
  )
);

-- Phase 7: Update RLS policies for safety_forms
DROP POLICY IF EXISTS "Foreman+ can create safety forms" ON public.safety_forms;
DROP POLICY IF EXISTS "Foreman+ can update safety forms" ON public.safety_forms;
DROP POLICY IF EXISTS "Users can view safety forms in their projects" ON public.safety_forms;
DROP POLICY IF EXISTS "PM, Foreman view safety forms" ON public.safety_forms;

CREATE POLICY "Foreman+ can create safety forms"
ON public.safety_forms
FOR INSERT
WITH CHECK (
  is_admin(auth.uid()) OR
  has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
);

CREATE POLICY "Foreman+ can update safety forms"
ON public.safety_forms
FOR UPDATE
USING (
  is_admin(auth.uid()) OR
  has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
);

CREATE POLICY "PM, Foreman view safety forms"
ON public.safety_forms
FOR SELECT
USING (
  is_admin(auth.uid()) OR
  has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
);

-- Phase 8: Update RLS policies for manpower_requests
DROP POLICY IF EXISTS "Foreman+ can create manpower requests" ON public.manpower_requests;
DROP POLICY IF EXISTS "PM can update manpower requests" ON public.manpower_requests;
DROP POLICY IF EXISTS "Users can view manpower requests in their projects" ON public.manpower_requests;
DROP POLICY IF EXISTS "PM can approve/deny manpower requests" ON public.manpower_requests;
DROP POLICY IF EXISTS "PM, Foreman view manpower requests" ON public.manpower_requests;

CREATE POLICY "Foreman+ can create manpower requests"
ON public.manpower_requests
FOR INSERT
WITH CHECK (
  is_admin(auth.uid()) OR
  has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
);

CREATE POLICY "PM can approve/deny manpower requests"
ON public.manpower_requests
FOR UPDATE
USING (
  is_admin(auth.uid()) OR
  has_project_role(auth.uid(), project_id, 'project_manager')
);

CREATE POLICY "PM, Foreman view manpower requests"
ON public.manpower_requests
FOR SELECT
USING (
  is_admin(auth.uid()) OR
  has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
);

-- Phase 9: Update RLS policies for attachments
DROP POLICY IF EXISTS "Project members can upload attachments" ON public.attachments;
DROP POLICY IF EXISTS "Users can view attachments in their projects" ON public.attachments;
DROP POLICY IF EXISTS "Users view attachments they have access to" ON public.attachments;

CREATE POLICY "Project members can upload attachments"
ON public.attachments
FOR INSERT
WITH CHECK (
  is_admin(auth.uid()) OR
  is_project_member(auth.uid(), project_id)
);

CREATE POLICY "Users view attachments they have access to"
ON public.attachments
FOR SELECT
USING (
  is_admin(auth.uid()) OR
  (
    is_project_member(auth.uid(), project_id) AND
    (
      -- PM, Foreman see all
      has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]) OR
      -- Workers see attachments on tasks/deficiencies they can access
      (
        (task_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM tasks t
          WHERE t.id = attachments.task_id
            AND (
              EXISTS (SELECT 1 FROM task_assignments WHERE task_id = t.id AND user_id = auth.uid()) OR
              (t.assigned_trade_id IN (SELECT trade_id FROM project_members WHERE user_id = auth.uid() AND project_id = t.project_id))
            )
        )) OR
        (deficiency_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM deficiencies d
          WHERE d.id = attachments.deficiency_id
            AND (
              has_any_project_role(auth.uid(), d.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]) OR
              (d.assigned_trade_id IN (SELECT trade_id FROM project_members WHERE user_id = auth.uid() AND project_id = d.project_id))
            )
        )) OR
        (safety_form_id IS NOT NULL AND has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])) OR
        (document_type IS NOT NULL AND has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
      )
    )
  )
);

-- Phase 10: Update project_members RLS
DROP POLICY IF EXISTS "Admins and PMs can add project members" ON public.project_members;
DROP POLICY IF EXISTS "Admin and PM can add project members" ON public.project_members;

CREATE POLICY "Admin and PM can add project members"
ON public.project_members
FOR INSERT
WITH CHECK (
  is_admin(auth.uid()) OR
  has_project_role(auth.uid(), project_id, 'project_manager')
);

-- Phase 11: Update projects RLS
DROP POLICY IF EXISTS "Admins and PMs can update projects" ON public.projects;
DROP POLICY IF EXISTS "Admin and PM can update projects" ON public.projects;

CREATE POLICY "Admin and PM can update projects"
ON public.projects
FOR UPDATE
USING (
  is_admin(auth.uid()) OR
  has_project_role(auth.uid(), id, 'project_manager')
);