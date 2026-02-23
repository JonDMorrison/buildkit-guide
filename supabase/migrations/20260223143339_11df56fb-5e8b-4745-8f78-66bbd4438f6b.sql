
CREATE OR REPLACE FUNCTION public.is_project_active(
  p_is_deleted boolean,
  p_status text
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    p_is_deleted = false
    AND p_status IN ('active','in_progress','open');
$$;
