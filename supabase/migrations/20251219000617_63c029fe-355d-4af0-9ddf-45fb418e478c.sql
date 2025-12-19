-- Fix is_project_member function to bypass RLS by querying as service role
-- The function is SECURITY DEFINER but still respects RLS unless we explicitly bypass it

CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
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
  )
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_project_member(UUID, UUID) TO authenticated;

-- Also ensure the is_admin function works correctly
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
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

GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;