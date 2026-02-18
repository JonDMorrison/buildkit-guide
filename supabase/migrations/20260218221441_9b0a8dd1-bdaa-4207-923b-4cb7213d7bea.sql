
-- Add converted_invoice_id column to quotes table (referenced by convert_quote_to_invoice RPC)
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS converted_invoice_id uuid REFERENCES public.invoices(id);
