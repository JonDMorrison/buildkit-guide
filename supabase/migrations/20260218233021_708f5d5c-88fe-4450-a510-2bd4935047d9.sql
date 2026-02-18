
-- RPC to toggle sandbox mode (admin only)
CREATE OR REPLACE FUNCTION public.rpc_set_org_sandbox_mode(p_org_id uuid, p_is_sandbox boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  -- Validate caller is org admin
  IF NOT public.has_org_role(p_org_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Forbidden: must be organization admin' USING ERRCODE = '42501';
  END IF;

  UPDATE public.organizations
  SET is_sandbox = p_is_sandbox
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found' USING ERRCODE = 'P0001';
  END IF;

  RETURN true;
END;
$$;
