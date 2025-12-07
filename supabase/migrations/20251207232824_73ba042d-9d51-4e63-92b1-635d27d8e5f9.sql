-- Add column to track when accounting was notified
ALTER TABLE public.receipts 
ADD COLUMN notified_accounting_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create function to set notified_accounting_at after notification is created
CREATE OR REPLACE FUNCTION public.set_receipt_notified_at()
RETURNS TRIGGER AS $$
BEGIN
  -- When a notification is created for a receipt upload, mark the receipt as notified
  IF NEW.type = 'document_uploaded' AND NEW.link_url LIKE '%/receipts%' THEN
    -- Extract receipt context from notification if possible
    NULL; -- This is a placeholder, we'll update receipts differently
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update existing receipts to mark them as notified (since trigger already ran for them)
UPDATE public.receipts 
SET notified_accounting_at = uploaded_at 
WHERE notified_accounting_at IS NULL;

-- Create trigger to auto-set notified_accounting_at on new receipts
CREATE OR REPLACE FUNCTION public.mark_receipt_notified()
RETURNS TRIGGER AS $$
BEGIN
  -- Set notified_accounting_at to now when receipt is created
  -- This works because the notification trigger fires on insert
  NEW.notified_accounting_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_receipt_notified_on_insert
  BEFORE INSERT ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_receipt_notified();