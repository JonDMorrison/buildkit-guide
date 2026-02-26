-- Create has_org_role function that the playbook RPCs depend on.
-- Must handle both 'pm' (actual DB value) and 'project_manager' (used in RPCs) as equivalent.
CREATE OR REPLACE FUNCTION public.has_org_role(
  _org_id uuid,
  _roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships
    WHERE user_id = auth.uid()
      AND organization_id = _org_id
      AND is_active = true
      AND (
        role = ANY(_roles)
        -- Normalize: treat 'pm' and 'project_manager' as equivalent
        OR (role = 'pm' AND 'project_manager' = ANY(_roles))
        OR (role = 'project_manager' AND 'pm' = ANY(_roles))
      )
  )
$$;

-- Restrict access
REVOKE ALL ON FUNCTION public.has_org_role(uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, text[]) TO postgres;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, text[]) TO service_role;