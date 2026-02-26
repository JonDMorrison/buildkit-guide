-- Harden has_org_role: pin search_path to 'public, pg_temp' to prevent search_path hijacking.
-- Required by RPC authorization checks (playbooks, change orders, estimates, etc.)
CREATE OR REPLACE FUNCTION public.has_org_role(
  _org_id uuid,
  _roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public, pg_temp'
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

-- Restrict access (idempotent)
REVOKE ALL ON FUNCTION public.has_org_role(uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, text[]) TO postgres;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, text[]) TO service_role;