-- Create enums for roles and statuses
CREATE TYPE public.app_role AS ENUM ('admin', 'project_manager', 'foreman', 'internal_worker', 'external_trade');

CREATE TYPE public.task_status AS ENUM ('not_started', 'in_progress', 'blocked', 'done');

CREATE TYPE public.deficiency_status AS ENUM ('open', 'in_progress', 'fixed', 'verified');

CREATE TYPE public.safety_status AS ENUM ('draft', 'submitted', 'reviewed');

CREATE TYPE public.notification_type AS ENUM ('task_assigned', 'blocker_added', 'safety_alert', 'manpower_request', 'general');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table (CRITICAL: roles must be in separate table)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create trades/companies table
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  trade_type TEXT NOT NULL, -- electrical, plumbing, hvac, etc.
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_trades_trade_type ON public.trades(trade_type);
CREATE INDEX idx_trades_is_active ON public.trades(is_active);

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'planning', -- planning, active, completed
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_created_by ON public.projects(created_by);
CREATE INDEX idx_projects_is_deleted ON public.projects(is_deleted) WHERE is_deleted = false;

-- Create project_members table (assigns users to projects)
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trade_id UUID REFERENCES public.trades(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX idx_project_members_user_id ON public.project_members(user_id);
CREATE INDEX idx_project_members_trade_id ON public.project_members(trade_id);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'not_started',
  priority INTEGER NOT NULL DEFAULT 3, -- 1=urgent, 5=low
  due_date DATE,
  assigned_trade_id UUID REFERENCES public.trades(id) ON DELETE SET NULL,
  location TEXT,
  estimated_hours DECIMAL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_assigned_trade_id ON public.tasks(assigned_trade_id);
CREATE INDEX idx_tasks_is_deleted ON public.tasks(is_deleted) WHERE is_deleted = false;

-- Create task_dependencies table
CREATE TABLE public.task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, depends_on_task_id),
  CHECK (task_id != depends_on_task_id)
);

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_task_dependencies_task_id ON public.task_dependencies(task_id);
CREATE INDEX idx_task_dependencies_depends_on ON public.task_dependencies(depends_on_task_id);

-- Create task_assignments table
CREATE TABLE public.task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, user_id)
);

ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_task_assignments_task_id ON public.task_assignments(task_id);
CREATE INDEX idx_task_assignments_user_id ON public.task_assignments(user_id);

-- Create blockers table (task blockers)
CREATE TABLE public.blockers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  blocking_trade_id UUID REFERENCES public.trades(id) ON DELETE SET NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.blockers ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_blockers_task_id ON public.blockers(task_id);
CREATE INDEX idx_blockers_is_resolved ON public.blockers(is_resolved);

-- Create manpower_requests table
CREATE TABLE public.manpower_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  requested_count INTEGER NOT NULL,
  required_date DATE NOT NULL,
  duration_days INTEGER,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, denied
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.manpower_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_manpower_requests_project_id ON public.manpower_requests(project_id);
CREATE INDEX idx_manpower_requests_trade_id ON public.manpower_requests(trade_id);
CREATE INDEX idx_manpower_requests_status ON public.manpower_requests(status);

-- Create deficiencies table
CREATE TABLE public.deficiencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  status public.deficiency_status NOT NULL DEFAULT 'open',
  priority INTEGER NOT NULL DEFAULT 3,
  assigned_trade_id UUID REFERENCES public.trades(id) ON DELETE SET NULL,
  due_date DATE,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.deficiencies ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_deficiencies_project_id ON public.deficiencies(project_id);
CREATE INDEX idx_deficiencies_status ON public.deficiencies(status);
CREATE INDEX idx_deficiencies_assigned_trade_id ON public.deficiencies(assigned_trade_id);

-- Create safety_forms table
CREATE TABLE public.safety_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  form_type TEXT NOT NULL, -- incident, inspection, toolbox_talk
  status public.safety_status NOT NULL DEFAULT 'draft',
  inspection_date DATE,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.safety_forms ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_safety_forms_project_id ON public.safety_forms(project_id);
CREATE INDEX idx_safety_forms_status ON public.safety_forms(status);
CREATE INDEX idx_safety_forms_form_type ON public.safety_forms(form_type);

-- Create safety_entries table (individual items on safety forms)
CREATE TABLE public.safety_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  safety_form_id UUID NOT NULL REFERENCES public.safety_forms(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_value TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.safety_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_safety_entries_form_id ON public.safety_entries(safety_form_id);

-- Create attachments table
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  deficiency_id UUID REFERENCES public.deficiencies(id) ON DELETE CASCADE,
  safety_form_id UUID REFERENCES public.safety_forms(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- photo, pdf, rfi, drawing
  file_url TEXT NOT NULL,
  file_size INTEGER,
  description TEXT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_attachments_project_id ON public.attachments(project_id);
CREATE INDEX idx_attachments_task_id ON public.attachments(task_id);
CREATE INDEX idx_attachments_file_type ON public.attachments(file_type);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Create ai_queries table (log AI interactions)
CREATE TABLE public.ai_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  query_text TEXT NOT NULL,
  response_text TEXT,
  context_data JSONB, -- store relevant context
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_queries ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ai_queries_user_id ON public.ai_queries(user_id);
CREATE INDEX idx_ai_queries_project_id ON public.ai_queries(project_id);
CREATE INDEX idx_ai_queries_created_at ON public.ai_queries(created_at DESC);

-- Create audit_log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL, -- insert, update, delete
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_project_id ON public.audit_log(project_id);
CREATE INDEX idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX idx_audit_log_record_id ON public.audit_log(record_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- Create security definer function to check if user is project member
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE user_id = _user_id
      AND project_id = _project_id
  )
$$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blockers_updated_at
  BEFORE UPDATE ON public.blockers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_manpower_requests_updated_at
  BEFORE UPDATE ON public.manpower_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deficiencies_updated_at
  BEFORE UPDATE ON public.deficiencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_safety_forms_updated_at
  BEFORE UPDATE ON public.safety_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS POLICIES

-- Profiles: Users can view all profiles, but only update their own
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- User Roles: Admins can manage all roles, users can view their own
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Trades: All authenticated users can view, PM+ can manage
CREATE POLICY "Users can view trades"
  ON public.trades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "PM and Admin can insert trades"
  ON public.trades FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    public.has_role(auth.uid(), 'project_manager')
  );

CREATE POLICY "PM and Admin can update trades"
  ON public.trades FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(auth.uid()) OR
    public.has_role(auth.uid(), 'project_manager')
  );

-- Projects: Admins see all, others see projects they're members of
CREATE POLICY "Admins can view all projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (public.is_project_member(auth.uid(), id));

CREATE POLICY "Admins and PMs can insert projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    public.has_role(auth.uid(), 'project_manager')
  );

CREATE POLICY "Admins and PMs can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'project_manager') AND public.is_project_member(auth.uid(), id))
  );

-- Project Members: Admins and PMs can manage
CREATE POLICY "Users can view project members of their projects"
  ON public.project_members FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid()) OR
    public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "Admins and PMs can add project members"
  ON public.project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    public.has_role(auth.uid(), 'project_manager')
  );

CREATE POLICY "Admins and PMs can remove project members"
  ON public.project_members FOR DELETE
  TO authenticated
  USING (
    public.is_admin(auth.uid()) OR
    public.has_role(auth.uid(), 'project_manager')
  );

-- Tasks: Project members can view their project tasks, PM+ can create/edit
CREATE POLICY "Users can view tasks in their projects"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "PM, Foreman can create tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_project_member(auth.uid(), project_id) AND
    (
      public.is_admin(auth.uid()) OR
      public.has_role(auth.uid(), 'project_manager') OR
      public.has_role(auth.uid(), 'foreman')
    )
  );

CREATE POLICY "PM, Foreman can update tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    public.is_project_member(auth.uid(), project_id) AND
    (
      public.is_admin(auth.uid()) OR
      public.has_role(auth.uid(), 'project_manager') OR
      public.has_role(auth.uid(), 'foreman')
    )
  );

-- Task Dependencies: Same as tasks
CREATE POLICY "Users can view task dependencies"
  ON public.task_dependencies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE id = task_dependencies.task_id
        AND public.is_project_member(auth.uid(), project_id)
    )
  );

CREATE POLICY "PM, Foreman can manage task dependencies"
  ON public.task_dependencies FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE id = task_dependencies.task_id
        AND public.is_project_member(auth.uid(), project_id)
        AND (
          public.is_admin(auth.uid()) OR
          public.has_role(auth.uid(), 'project_manager') OR
          public.has_role(auth.uid(), 'foreman')
        )
    )
  );

-- Task Assignments: Project members can view, PM+ can assign
CREATE POLICY "Users can view task assignments in their projects"
  ON public.task_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE id = task_assignments.task_id
        AND public.is_project_member(auth.uid(), project_id)
    )
  );

CREATE POLICY "PM, Foreman can create task assignments"
  ON public.task_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE id = task_assignments.task_id
        AND public.is_project_member(auth.uid(), project_id)
        AND (
          public.is_admin(auth.uid()) OR
          public.has_role(auth.uid(), 'project_manager') OR
          public.has_role(auth.uid(), 'foreman')
        )
    )
  );

-- Blockers: Project members can view, Foreman+ can create
CREATE POLICY "Users can view blockers in their projects"
  ON public.blockers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE id = blockers.task_id
        AND public.is_project_member(auth.uid(), project_id)
    )
  );

CREATE POLICY "Foreman+ can create blockers"
  ON public.blockers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE id = blockers.task_id
        AND public.is_project_member(auth.uid(), project_id)
    ) AND
    (
      public.is_admin(auth.uid()) OR
      public.has_role(auth.uid(), 'project_manager') OR
      public.has_role(auth.uid(), 'foreman')
    )
  );

CREATE POLICY "PM can update blockers"
  ON public.blockers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE id = blockers.task_id
        AND public.is_project_member(auth.uid(), project_id)
    ) AND
    (
      public.is_admin(auth.uid()) OR
      public.has_role(auth.uid(), 'project_manager')
    )
  );

-- Manpower Requests: Project members can view, Foreman+ can create, PM can approve
CREATE POLICY "Users can view manpower requests in their projects"
  ON public.manpower_requests FOR SELECT
  TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Foreman+ can create manpower requests"
  ON public.manpower_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_project_member(auth.uid(), project_id) AND
    (
      public.is_admin(auth.uid()) OR
      public.has_role(auth.uid(), 'project_manager') OR
      public.has_role(auth.uid(), 'foreman')
    )
  );

CREATE POLICY "PM can update manpower requests"
  ON public.manpower_requests FOR UPDATE
  TO authenticated
  USING (
    public.is_project_member(auth.uid(), project_id) AND
    (
      public.is_admin(auth.uid()) OR
      public.has_role(auth.uid(), 'project_manager')
    )
  );

-- Deficiencies: Project members can view, all can create, PM+ can manage
CREATE POLICY "Users can view deficiencies in their projects"
  ON public.deficiencies FOR SELECT
  TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can create deficiencies"
  ON public.deficiencies FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "PM+ can update deficiencies"
  ON public.deficiencies FOR UPDATE
  TO authenticated
  USING (
    public.is_project_member(auth.uid(), project_id) AND
    (
      public.is_admin(auth.uid()) OR
      public.has_role(auth.uid(), 'project_manager')
    )
  );

-- Safety Forms: Project members can view, Foreman+ can create, PM can review
CREATE POLICY "Users can view safety forms in their projects"
  ON public.safety_forms FOR SELECT
  TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Foreman+ can create safety forms"
  ON public.safety_forms FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_project_member(auth.uid(), project_id) AND
    (
      public.is_admin(auth.uid()) OR
      public.has_role(auth.uid(), 'project_manager') OR
      public.has_role(auth.uid(), 'foreman')
    )
  );

CREATE POLICY "Foreman+ can update safety forms"
  ON public.safety_forms FOR UPDATE
  TO authenticated
  USING (
    public.is_project_member(auth.uid(), project_id) AND
    (
      public.is_admin(auth.uid()) OR
      public.has_role(auth.uid(), 'project_manager') OR
      public.has_role(auth.uid(), 'foreman')
    )
  );

-- Safety Entries: Same as safety forms
CREATE POLICY "Users can view safety entries"
  ON public.safety_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.safety_forms
      WHERE id = safety_entries.safety_form_id
        AND public.is_project_member(auth.uid(), project_id)
    )
  );

CREATE POLICY "Foreman+ can manage safety entries"
  ON public.safety_entries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.safety_forms
      WHERE id = safety_entries.safety_form_id
        AND public.is_project_member(auth.uid(), project_id)
        AND (
          public.is_admin(auth.uid()) OR
          public.has_role(auth.uid(), 'project_manager') OR
          public.has_role(auth.uid(), 'foreman')
        )
    )
  );

-- Attachments: Project members can view and upload
CREATE POLICY "Users can view attachments in their projects"
  ON public.attachments FOR SELECT
  TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Project members can upload attachments"
  ON public.attachments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_member(auth.uid(), project_id));

-- Notifications: Users can view and update their own
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- AI Queries: Users can view and create their own
CREATE POLICY "Users can view their own AI queries"
  ON public.ai_queries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create AI queries"
  ON public.ai_queries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Audit Log: Admins can view all, users can view their own actions
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own audit logs"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());