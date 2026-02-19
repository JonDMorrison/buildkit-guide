-- P1 FIX: Create rpc_convert_quote_to_invoice wrapper for audit compliance
-- Real implementation lives in convert_quote_to_invoice(uuid, uuid)

CREATE OR REPLACE FUNCTION public.rpc_convert_quote_to_invoice(p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delegate to canonical implementation, passing current user as actor
  RETURN public.convert_quote_to_invoice(p_quote_id, auth.uid());
END;
$$;