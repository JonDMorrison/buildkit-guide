
-- ============================================
-- RLS POLICIES FOR TIME TRACKING TABLES
-- ============================================

-- A. Enable RLS on all time tracking tables
ALTER TABLE public.job_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entry_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_exports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- B. POLICIES: job_sites
-- ============================================

-- SELECT: Project members can read
CREATE POLICY "Project members can view job sites"
ON public.job_sites
FOR SELECT
USING (
  has_org_membership(organization_id)
  AND has_project_membership(project_id)
);

-- INSERT: Admin/PM only
CREATE POLICY "Admin and PM can create job sites"
ON public.job_sites
FOR INSERT
WITH CHECK (
  has_org_membership(organization_id)
  AND org_role(organization_id) IN ('admin', 'project_manager')
  AND has_project_membership(project_id)
);

-- UPDATE: Admin/PM only
CREATE POLICY "Admin and PM can update job sites"
ON public.job_sites
FOR UPDATE
USING (
  has_org_membership(organization_id)
  AND org_role(organization_id) IN ('admin', 'project_manager')
  AND has_project_membership(project_id)
);

-- DELETE: Disallowed for everyone (no policy = no access)

-- ============================================
-- C. POLICIES: time_entries
-- ============================================

-- SELECT: Workers see own, Foreman/PM see project, HR/Admin see org
CREATE POLICY "Users can view time entries based on role"
ON public.time_entries
FOR SELECT
USING (
  has_org_membership(organization_id)
  AND (
    -- Own entries
    user_id = auth.uid()
    -- HR/Admin see all in org
    OR org_role(organization_id) IN ('admin', 'hr_accounting')
    -- PM/Foreman see project entries
    OR (
      org_role(organization_id) IN ('project_manager', 'foreman')
      AND has_project_membership(project_id)
    )
  )
);

-- INSERT/UPDATE/DELETE: Disallowed for authenticated users
-- Only service role (edge functions) can modify

-- ============================================
-- D. POLICIES: time_events (immutable log)
-- ============================================

-- SELECT: Same visibility as time_entries
CREATE POLICY "Users can view time events based on role"
ON public.time_events
FOR SELECT
USING (
  has_org_membership(organization_id)
  AND (
    -- Own events
    user_id = auth.uid()
    -- HR/Admin see all in org
    OR org_role(organization_id) IN ('admin', 'hr_accounting')
    -- PM/Foreman see project events
    OR (
      org_role(organization_id) IN ('project_manager', 'foreman')
      AND has_project_membership(project_id)
    )
  )
);

-- INSERT/UPDATE/DELETE: Disallowed for authenticated users
-- DB triggers already prevent UPDATE/DELETE

-- ============================================
-- E. POLICIES: time_entry_adjustments
-- ============================================

-- SELECT: HR/Admin see all, PM/Foreman see project, workers see own
CREATE POLICY "Users can view adjustments based on role"
ON public.time_entry_adjustments
FOR SELECT
USING (
  has_org_membership(organization_id)
  AND (
    -- HR/Admin see all in org
    org_role(organization_id) IN ('admin', 'hr_accounting')
    -- Workers see adjustments on their own entries
    OR EXISTS (
      SELECT 1 FROM public.time_entries te
      WHERE te.id = time_entry_adjustments.time_entry_id
        AND te.user_id = auth.uid()
    )
    -- PM/Foreman see adjustments for their projects
    OR (
      org_role(organization_id) IN ('project_manager', 'foreman')
      AND EXISTS (
        SELECT 1 FROM public.time_entries te
        WHERE te.id = time_entry_adjustments.time_entry_id
          AND has_project_membership(te.project_id)
      )
    )
  )
);

-- INSERT/UPDATE/DELETE: Disallowed for authenticated users

-- ============================================
-- F. POLICIES: payroll_exports
-- ============================================

-- SELECT: HR/Admin only
CREATE POLICY "HR and Admin can view payroll exports"
ON public.payroll_exports
FOR SELECT
USING (
  has_org_membership(organization_id)
  AND org_role(organization_id) IN ('admin', 'hr_accounting')
);

-- INSERT/UPDATE/DELETE: Disallowed for authenticated users
