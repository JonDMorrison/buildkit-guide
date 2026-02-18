
-- Update quote immutability trigger to allow setting converted_invoice_id on approved quotes
CREATE OR REPLACE FUNCTION public.enforce_quote_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow status transitions (e.g., draft->approved, approved->archived)
  IF OLD.status IN ('approved','rejected') AND NEW.status = OLD.status THEN
    -- Allow ONLY converted_invoice_id to be set on approved quotes (for conversion RPC)
    IF OLD.status = 'approved' AND OLD.converted_invoice_id IS NULL AND NEW.converted_invoice_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify an approved/rejected quote.';
  END IF;
  RETURN NEW;
END;
$$;
