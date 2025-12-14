
-- 1) Fix helper function: has_project_membership (use project_members)
CREATE OR REPLACE FUNCTION public.has_project_membership(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pmem
    JOIN public.projects p ON p.id = pmem.project_id
    WHERE pmem.project_id = _project_id
      AND pmem.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.organization_memberships om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = p.organization_id
          AND om.is_active = true
      )
  )
$$;

-- 2) Drop existing policies with old names
DROP POLICY IF EXISTS "Project members can view job sites" ON public.job_sites;
DROP POLICY IF EXISTS "Admin and PM can create job sites" ON public.job_sites;
DROP POLICY IF EXISTS "Admin and PM can update job sites" ON public.job_sites;
DROP POLICY IF EXISTS "Users can view time entries based on role" ON public.time_entries;
DROP POLICY IF EXISTS "Users can view time events based on role" ON public.time_events;
DROP POLICY IF EXISTS "Users can view adjustments based on role" ON public.time_entry_adjustments;
DROP POLICY IF EXISTS "HR and Admin can view payroll exports" ON public.payroll_exports;

-- 3) Recreate job_sites policies with correct role names
CREATE POLICY "Project members can view job sites"
ON public.job_sites
FOR SELECT
USING (
  has_org_membership(organization_id)
  AND has_project_membership(project_id)
);

CREATE POLICY "Admin and PM can create job sites"
ON public.job_sites
FOR INSERT
WITH CHECK (
  has_org_membership(organization_id)
  AND org_role(organization_id) IN ('admin', 'pm')
  AND has_project_membership(project_id)
);

CREATE POLICY "Admin and PM can update job sites"
ON public.job_sites
FOR UPDATE
USING (
  has_org_membership(organization_id)
  AND org_role(organization_id) IN ('admin', 'pm')
  AND has_project_membership(project_id)
);

-- 4) Recreate time_entries policy with correct role names
CREATE POLICY "Users can view time entries based on role"
ON public.time_entries
FOR SELECT
USING (
  has_org_membership(organization_id)
  AND (
    -- Own entries
    user_id = auth.uid()
    -- HR/Admin see all in org
    OR org_role(organization_id) IN ('admin', 'hr')
    -- PM/Foreman see project entries
    OR (
      org_role(organization_id) IN ('pm', 'foreman')
      AND has_project_membership(project_id)
    )
  )
);

-- 5) Recreate time_events policy with correct role names
CREATE POLICY "Users can view time events based on role"
ON public.time_events
FOR SELECT
USING (
  has_org_membership(organization_id)
  AND (
    -- Own events
    user_id = auth.uid()
    -- HR/Admin see all in org
    OR org_role(organization_id) IN ('admin', 'hr')
    -- PM/Foreman see project events
    OR (
      org_role(organization_id) IN ('pm', 'foreman')
      AND has_project_membership(project_id)
    )
  )
);

-- 6) Recreate time_entry_adjustments policy with correct role names
CREATE POLICY "Users can view adjustments based on role"
ON public.time_entry_adjustments
FOR SELECT
USING (
  has_org_membership(organization_id)
  AND (
    -- HR/Admin see all in org
    org_role(organization_id) IN ('admin', 'hr')
    -- Workers see adjustments on their own entries
    OR EXISTS (
      SELECT 1 FROM public.time_entries te
      WHERE te.id = time_entry_adjustments.time_entry_id
        AND te.user_id = auth.uid()
    )
    -- PM/Foreman see adjustments for their projects
    OR (
      org_role(organization_id) IN ('pm', 'foreman')
      AND EXISTS (
        SELECT 1 FROM public.time_entries te
        WHERE te.id = time_entry_adjustments.time_entry_id
          AND has_project_membership(te.project_id)
      )
    )
  )
);

-- 7) Recreate payroll_exports policy with correct role names
CREATE POLICY "HR and Admin can view payroll exports"
ON public.payroll_exports
FOR SELECT
USING (
  has_org_membership(organization_id)
  AND org_role(organization_id) IN ('admin', 'hr')
);
