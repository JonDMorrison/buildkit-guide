-- Drop existing SELECT policy for time_adjustment_requests
DROP POLICY IF EXISTS "View time adjustment requests" ON public.time_adjustment_requests;

-- Create updated SELECT policy with shares_any_project check for PM/Foreman
CREATE POLICY "View time adjustment requests" ON public.time_adjustment_requests
FOR SELECT TO authenticated
USING (
  has_org_membership(organization_id)
  AND (
    -- Own request (requester or target)
    requester_user_id = auth.uid()
    OR target_user_id = auth.uid()
    -- Admin/HR see all in org
    OR org_role(organization_id) IN ('admin', 'hr')
    -- PM/Foreman see only if they share a project with the target user
    OR (
      org_role(organization_id) IN ('pm', 'foreman')
      AND has_project_membership(project_id)
      AND shares_any_project(organization_id, auth.uid(), target_user_id)
    )
  )
);