
-- Add invoice snapshot fields for historical stability
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS bill_to_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bill_to_name text,
  ADD COLUMN IF NOT EXISTS bill_to_address text,
  ADD COLUMN IF NOT EXISTS ship_to_address text,
  ADD COLUMN IF NOT EXISTS send_to_emails text;

-- Index for lookup by billing client
CREATE INDEX IF NOT EXISTS idx_invoices_bill_to_client ON public.invoices (bill_to_client_id);

COMMENT ON COLUMN public.invoices.bill_to_client_id IS 'Snapshot of the billing client at invoice creation time';
COMMENT ON COLUMN public.invoices.bill_to_name IS 'Snapshot of billing customer name at invoice creation';
COMMENT ON COLUMN public.invoices.bill_to_address IS 'Snapshot of billing address at invoice creation';
COMMENT ON COLUMN public.invoices.ship_to_address IS 'Snapshot of shipping/job site address at invoice creation';
COMMENT ON COLUMN public.invoices.send_to_emails IS 'Comma-separated email addresses for sending this invoice';
