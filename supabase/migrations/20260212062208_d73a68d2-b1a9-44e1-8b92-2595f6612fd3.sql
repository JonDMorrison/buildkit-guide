
-- Add payment_instructions to invoice_settings for reusable payment info (cheque, e-transfer, etc.)
ALTER TABLE public.invoice_settings
ADD COLUMN payment_instructions text DEFAULT NULL;
