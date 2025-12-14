-- Enable RLS on time_adjustment_requests if not already enabled
ALTER TABLE public.time_adjustment_requests ENABLE ROW LEVEL SECURITY;

-- Enable RLS on timesheet_periods if not already enabled
ALTER TABLE public.timesheet_periods ENABLE ROW LEVEL SECURITY;

-- Enable RLS on time_entry_flags if not already enabled
ALTER TABLE public.time_entry_flags ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to recreate cleanly)
DROP POLICY IF EXISTS "Users can view their own requests" ON public.time_adjustment_requests;
DROP POLICY IF EXISTS "Users can view requests they can review" ON public.time_adjustment_requests;
DROP POLICY IF EXISTS "Users can view their own periods" ON public.timesheet_periods;
DROP POLICY IF EXISTS "Users can view periods they can review" ON public.timesheet_periods;
DROP POLICY IF EXISTS "Users can view their own flags" ON public.time_entry_flags;
DROP POLICY IF EXISTS "Reviewers can view flags" ON public.time_entry_flags;

-- =====================================================
-- RLS: time_adjustment_requests
-- =====================================================

-- SELECT: Users can view their own requests OR requests they have authority to review
CREATE POLICY "View time adjustment requests"
ON public.time_adjustment_requests
FOR SELECT
USING (
  has_org_membership(organization_id) AND (
    -- Own requests (requester or target)
    requester_user_id = auth.uid() OR
    target_user_id = auth.uid() OR
    -- Admin/HR can see all org requests
    org_role(organization_id) IN ('admin', 'hr') OR
    -- PM/Foreman can see requests for their projects
    (org_role(organization_id) IN ('pm', 'foreman') AND has_project_membership(project_id))
  )
);

-- INSERT: Block direct client inserts (requests created via edge function with service role)
-- No INSERT policy means clients cannot insert

-- UPDATE: No direct updates allowed (handled via edge functions)
-- No UPDATE policy means clients cannot update

-- DELETE: No deletes allowed
-- No DELETE policy means clients cannot delete

-- =====================================================
-- RLS: timesheet_periods
-- =====================================================

-- SELECT: Users can view their own periods OR periods they have authority to review
CREATE POLICY "View timesheet periods"
ON public.timesheet_periods
FOR SELECT
USING (
  has_org_membership(organization_id) AND (
    -- Own periods
    user_id = auth.uid() OR
    -- Admin/HR can see all org periods
    org_role(organization_id) IN ('admin', 'hr') OR
    -- PM/Foreman can see periods for users on shared projects
    (org_role(organization_id) IN ('pm', 'foreman') AND shares_any_project(organization_id, auth.uid(), user_id))
  )
);

-- INSERT: Block direct client inserts (periods created via edge function)
-- No INSERT policy

-- UPDATE: Block direct client updates (period changes via edge functions only)
-- No UPDATE policy

-- DELETE: No deletes allowed
-- No DELETE policy

-- =====================================================
-- RLS: time_entry_flags
-- =====================================================

-- SELECT: Users can view their own flags OR flags they have authority to review
CREATE POLICY "View time entry flags"
ON public.time_entry_flags
FOR SELECT
USING (
  has_org_membership(organization_id) AND (
    -- Own flags
    user_id = auth.uid() OR
    -- Admin/HR can see all org flags
    org_role(organization_id) IN ('admin', 'hr') OR
    -- PM/Foreman can see flags for their projects
    (org_role(organization_id) IN ('pm', 'foreman') AND has_project_membership(project_id))
  )
);

-- INSERT: Block direct client inserts (flags created via RPC/edge functions)
-- No INSERT policy

-- UPDATE: Block direct updates
-- No UPDATE policy

-- DELETE: Block direct deletes
-- No DELETE policy