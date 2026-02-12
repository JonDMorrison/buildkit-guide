
-- =====================================================
-- INVOICING MODULE EXPANSION: Progress Billing, Holdbacks,
-- Multi-Tax, Approval Workflow, Late Reminders, Deposits,
-- PO Linking, Receipt Linking, Audit Trail, Dashboard Views
-- =====================================================

-- 1. Add invoice_type to support progress billing, deposits, credit notes
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_type text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS retainage_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retainage_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retainage_released boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retainage_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS progress_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_applied_to uuid REFERENCES public.invoices(id),
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS po_number text,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer DEFAULT 0;

-- 2. Multi-tax support table
CREATE TABLE IF NOT EXISTS public.invoice_tax_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tax_name text NOT NULL DEFAULT 'Tax',
  tax_rate numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.invoice_tax_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tax lines for their invoices"
  ON public.invoice_tax_lines FOR SELECT
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_tax_lines.invoice_id AND is_org_member(auth.uid(), i.organization_id)));

CREATE POLICY "Users can insert tax lines for their invoices"
  ON public.invoice_tax_lines FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_tax_lines.invoice_id AND is_org_member(auth.uid(), i.organization_id)));

CREATE POLICY "Users can update tax lines for their invoices"
  ON public.invoice_tax_lines FOR UPDATE
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_tax_lines.invoice_id AND is_org_member(auth.uid(), i.organization_id)));

CREATE POLICY "Users can delete tax lines for their invoices"
  ON public.invoice_tax_lines FOR DELETE
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_tax_lines.invoice_id AND is_org_member(auth.uid(), i.organization_id)));

-- 3. Invoice activity/audit log
CREATE TABLE IF NOT EXISTS public.invoice_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  details text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view invoice activity"
  ON public.invoice_activity_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_activity_log.invoice_id AND is_org_member(auth.uid(), i.organization_id)));

CREATE POLICY "Org members can insert invoice activity"
  ON public.invoice_activity_log FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_activity_log.invoice_id AND is_org_member(auth.uid(), i.organization_id)));

-- 4. Receipt-to-invoice linking table
CREATE TABLE IF NOT EXISTS public.invoice_receipt_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  receipt_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  UNIQUE(invoice_id, receipt_id)
);

ALTER TABLE public.invoice_receipt_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view receipt links"
  ON public.invoice_receipt_links FOR SELECT
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_receipt_links.invoice_id AND is_org_member(auth.uid(), i.organization_id)));

CREATE POLICY "Org members can insert receipt links"
  ON public.invoice_receipt_links FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_receipt_links.invoice_id AND is_org_member(auth.uid(), i.organization_id)));

CREATE POLICY "Org members can delete receipt links"
  ON public.invoice_receipt_links FOR DELETE
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_receipt_links.invoice_id AND is_org_member(auth.uid(), i.organization_id)));

-- 5. Add multi-tax fields to invoice_settings
ALTER TABLE public.invoice_settings
  ADD COLUMN IF NOT EXISTS tax2_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax2_label text DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_retainage_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS require_approval boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_days integer[] DEFAULT ARRAY[7, 14, 30];

-- 6. Cron secret for late payment reminders
INSERT INTO public.cron_secrets (name, secret)
VALUES ('invoice_reminder_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;
