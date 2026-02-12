
-- Add currency column to invoice_settings
ALTER TABLE public.invoice_settings ADD COLUMN IF NOT EXISTS currency text DEFAULT 'CAD';

-- Add from_email column to invoice_settings  
ALTER TABLE public.invoice_settings ADD COLUMN IF NOT EXISTS from_email text DEFAULT NULL;
