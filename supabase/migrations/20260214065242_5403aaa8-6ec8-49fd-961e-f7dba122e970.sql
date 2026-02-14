
-- ============================================================
-- P0 FIX: Remove is_admin() cross-org escalation
-- Scope: project_members, tasks, receipts, safety_forms
-- ============================================================

-- ── 1. Helper function: org-scoped project access ──
-- Returns true if auth.uid() is an active org member for the
-- project's organization, optionally filtering by org role.
CREATE OR REPLACE FUNCTION public.has_project_access(
  p_project_id uuid,
  p_org_roles text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.organization_memberships om
      ON om.organization_id = p.organization_id
    WHERE p.id = p_project_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND (p_org_roles IS NULL OR om.role = ANY(p_org_roles))
  )
$$;

-- ── 2. Helper: is user a member of project (org-scoped) ──
-- Replaces is_project_member which had no org check.
CREATE OR REPLACE FUNCTION public.is_org_scoped_project_member(
  p_user_id uuid,
  p_project_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    JOIN public.projects p ON p.id = pm.project_id
    JOIN public.organization_memberships om
      ON om.organization_id = p.organization_id
      AND om.user_id = pm.user_id
      AND om.is_active = true
    WHERE pm.user_id = p_user_id
      AND pm.project_id = p_project_id
  )
$$;

-- ════════════════════════════════════════════════════════════
-- TABLE 1: project_members
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members FORCE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view project members of their projects" ON public.project_members;
DROP POLICY IF EXISTS "Admin, PM, org admin, or creator can add project members" ON public.project_members;
DROP POLICY IF EXISTS "Admins and PMs can update project members" ON public.project_members;
DROP POLICY IF EXISTS "Admins and PMs can remove project members" ON public.project_members;

-- SELECT: org members who share project access
CREATE POLICY "pm_select_org_scoped"
ON public.project_members FOR SELECT
TO authenticated
USING (
  -- User is an active org member for this project's org
  has_project_access(project_id)
  -- AND either they are a project member themselves, or they are org admin/PM
  AND (
    user_id = auth.uid()
    OR is_org_scoped_project_member(auth.uid(), project_id)
    OR has_project_access(project_id, ARRAY['admin', 'pm'])
  )
);

-- INSERT: org admin, org PM, or project creator adding themselves
CREATE POLICY "pm_insert_org_scoped"
ON public.project_members FOR INSERT
TO authenticated
WITH CHECK (
  has_project_access(project_id)
  AND (
    -- Org admin or PM can add members
    has_project_access(project_id, ARRAY['admin', 'pm'])
    -- Project PM can add members
    OR has_project_role(auth.uid(), project_id, 'project_manager')
    -- Creator can add themselves
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id AND p.created_by = auth.uid()
      )
    )
  )
);

-- UPDATE: org admin, org PM, or project PM
CREATE POLICY "pm_update_org_scoped"
ON public.project_members FOR UPDATE
TO authenticated
USING (
  has_project_access(project_id)
  AND (
    has_project_access(project_id, ARRAY['admin', 'pm'])
    OR has_project_role(auth.uid(), project_id, 'project_manager')
  )
)
WITH CHECK (
  has_project_access(project_id)
  AND (
    has_project_access(project_id, ARRAY['admin', 'pm'])
    OR has_project_role(auth.uid(), project_id, 'project_manager')
  )
);

-- DELETE: org admin, org PM, or project PM
CREATE POLICY "pm_delete_org_scoped"
ON public.project_members FOR DELETE
TO authenticated
USING (
  has_project_access(project_id)
  AND (
    has_project_access(project_id, ARRAY['admin', 'pm'])
    OR has_project_role(auth.uid(), project_id, 'project_manager')
  )
);

-- ════════════════════════════════════════════════════════════
-- TABLE 2: tasks
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members view tasks" ON public.tasks;
DROP POLICY IF EXISTS "PM, Foreman can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "PM, Foreman can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Workers can update assigned task status" ON public.tasks;

-- SELECT: org-scoped, role-aware visibility
CREATE POLICY "tasks_select_org_scoped"
ON public.tasks FOR SELECT
TO authenticated
USING (
  has_project_access(project_id)
  AND (
    -- PM/Foreman/Org admin see all tasks in project
    has_project_access(project_id, ARRAY['admin', 'pm'])
    OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager', 'foreman']::app_role[])
    -- External trade: own trade tasks or assigned
    OR (
      has_project_role(auth.uid(), project_id, 'external_trade')
      AND (
        assigned_trade_id IN (
          SELECT trade_id FROM public.project_members
          WHERE user_id = auth.uid() AND project_id = tasks.project_id
        )
        OR is_assigned_to_task(auth.uid(), id)
      )
    )
    -- Internal worker: assigned tasks only
    OR (
      has_project_role(auth.uid(), project_id, 'internal_worker')
      AND is_assigned_to_task(auth.uid(), id)
    )
  )
);

-- INSERT: org-scoped PM/Foreman
CREATE POLICY "tasks_insert_org_scoped"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (
  has_project_access(project_id)
  AND (
    has_project_access(project_id, ARRAY['admin', 'pm'])
    OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager', 'foreman']::app_role[])
  )
);

-- UPDATE: org-scoped PM/Foreman
CREATE POLICY "tasks_update_org_scoped"
ON public.tasks FOR UPDATE
TO authenticated
USING (
  has_project_access(project_id)
  AND (
    has_project_access(project_id, ARRAY['admin', 'pm'])
    OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager', 'foreman']::app_role[])
  )
);

-- UPDATE: assigned workers can update their task status
CREATE POLICY "tasks_worker_update_org_scoped"
ON public.tasks FOR UPDATE
TO authenticated
USING (
  has_project_access(project_id)
  AND is_assigned_to_task(auth.uid(), id)
  AND has_any_project_role(auth.uid(), project_id, ARRAY['internal_worker', 'external_trade']::app_role[])
);

-- ════════════════════════════════════════════════════════════
-- TABLE 3: receipts
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized users can view receipts" ON public.receipts;
DROP POLICY IF EXISTS "Accounting can view all receipts" ON public.receipts;
DROP POLICY IF EXISTS "Project members can insert receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can update own receipts or PM/Admin any" ON public.receipts;
DROP POLICY IF EXISTS "Admins and PMs can delete receipts" ON public.receipts;

-- SELECT: org-scoped (own uploads, PM/admin, or accounting role in same org)
CREATE POLICY "receipts_select_org_scoped"
ON public.receipts FOR SELECT
TO authenticated
USING (
  has_project_access(project_id)
  AND (
    uploaded_by = auth.uid()
    OR has_project_access(project_id, ARRAY['admin', 'pm'])
    OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager']::app_role[])
    -- Accounting role scoped to org
    OR EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.organization_memberships om
        ON om.organization_id = p.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role = 'admin'
      WHERE p.id = project_id
    )
  )
);

-- INSERT: org members on the project
CREATE POLICY "receipts_insert_org_scoped"
ON public.receipts FOR INSERT
TO authenticated
WITH CHECK (
  has_project_access(project_id)
  AND is_org_scoped_project_member(auth.uid(), project_id)
);

-- UPDATE: owner or PM/admin (org-scoped)
CREATE POLICY "receipts_update_org_scoped"
ON public.receipts FOR UPDATE
TO authenticated
USING (
  has_project_access(project_id)
  AND (
    uploaded_by = auth.uid()
    OR has_project_access(project_id, ARRAY['admin', 'pm'])
    OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager']::app_role[])
  )
);

-- DELETE: PM/admin only (org-scoped)
CREATE POLICY "receipts_delete_org_scoped"
ON public.receipts FOR DELETE
TO authenticated
USING (
  has_project_access(project_id)
  AND (
    has_project_access(project_id, ARRAY['admin', 'pm'])
    OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager']::app_role[])
  )
);

-- ════════════════════════════════════════════════════════════
-- TABLE 4: safety_forms
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.safety_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_forms FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view safety forms based on role" ON public.safety_forms;
DROP POLICY IF EXISTS "Users can create safety forms based on role and type" ON public.safety_forms;
DROP POLICY IF EXISTS "Foreman+ can update safety forms" ON public.safety_forms;

-- SELECT: org-scoped, role-aware
CREATE POLICY "safety_select_org_scoped"
ON public.safety_forms FOR SELECT
TO authenticated
USING (
  has_project_access(project_id)
  AND (
    -- PM/Foreman/org admin see all
    has_project_access(project_id, ARRAY['admin', 'pm'])
    OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager', 'foreman']::app_role[])
    -- Workers see only their own right_to_refuse
    OR (
      has_any_project_role(auth.uid(), project_id, ARRAY['internal_worker', 'external_trade']::app_role[])
      AND form_type = 'right_to_refuse'
      AND created_by = auth.uid()
    )
  )
);

-- INSERT: org-scoped, role-aware
CREATE POLICY "safety_insert_org_scoped"
ON public.safety_forms FOR INSERT
TO authenticated
WITH CHECK (
  has_project_access(project_id)
  AND (
    has_project_access(project_id, ARRAY['admin', 'pm'])
    OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager', 'foreman']::app_role[])
    OR (
      has_any_project_role(auth.uid(), project_id, ARRAY['internal_worker', 'external_trade']::app_role[])
      AND form_type = 'right_to_refuse'
    )
  )
);

-- UPDATE: org-scoped PM/Foreman/admin
CREATE POLICY "safety_update_org_scoped"
ON public.safety_forms FOR UPDATE
TO authenticated
USING (
  has_project_access(project_id)
  AND (
    has_project_access(project_id, ARRAY['admin', 'pm'])
    OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager', 'foreman']::app_role[])
  )
);
