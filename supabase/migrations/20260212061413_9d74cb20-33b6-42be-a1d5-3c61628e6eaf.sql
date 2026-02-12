
-- 1. Storage bucket for invoice logos/assets
INSERT INTO storage.buckets (id, name, public) VALUES ('invoice-assets', 'invoice-assets', true);

CREATE POLICY "Anyone can view invoice assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoice-assets');

CREATE POLICY "Authenticated users can upload invoice assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invoice-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update invoice assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'invoice-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete invoice assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'invoice-assets' AND auth.uid() IS NOT NULL);

-- 2. Add amount_paid and credit_note_for columns to invoices
ALTER TABLE public.invoices ADD COLUMN amount_paid NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN credit_note_for UUID REFERENCES public.invoices(id);

-- 3. Invoice payments table (partial payments)
CREATE TABLE public.invoice_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  reference_number TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view invoice payments"
ON public.invoice_payments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM invoices i WHERE i.id = invoice_payments.invoice_id AND is_org_member(auth.uid(), i.organization_id)
));

CREATE POLICY "Org members can insert invoice payments"
ON public.invoice_payments FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM invoices i WHERE i.id = invoice_payments.invoice_id AND is_org_member(auth.uid(), i.organization_id)
));

CREATE POLICY "Org members can update invoice payments"
ON public.invoice_payments FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM invoices i WHERE i.id = invoice_payments.invoice_id AND is_org_member(auth.uid(), i.organization_id)
));

CREATE POLICY "Org admins can delete invoice payments"
ON public.invoice_payments FOR DELETE
USING (EXISTS (
  SELECT 1 FROM invoices i WHERE i.id = invoice_payments.invoice_id AND is_org_admin(auth.uid(), i.organization_id)
));

-- 4. Recurring invoice templates
CREATE TABLE public.recurring_invoice_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  client_id UUID REFERENCES public.clients(id),
  project_id UUID REFERENCES public.projects(id),
  frequency TEXT NOT NULL DEFAULT 'monthly',
  next_issue_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_invoice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view recurring templates"
ON public.recurring_invoice_templates FOR SELECT
USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can create recurring templates"
ON public.recurring_invoice_templates FOR INSERT
WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update recurring templates"
ON public.recurring_invoice_templates FOR UPDATE
USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can delete recurring templates"
ON public.recurring_invoice_templates FOR DELETE
USING (is_org_admin(auth.uid(), organization_id));

-- 5. Trigger to auto-update amount_paid on invoices when payments change
CREATE OR REPLACE FUNCTION public.update_invoice_amount_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.invoices
    SET amount_paid = COALESCE((SELECT SUM(amount) FROM public.invoice_payments WHERE invoice_id = OLD.invoice_id), 0)
    WHERE id = OLD.invoice_id;
    RETURN OLD;
  ELSE
    UPDATE public.invoices
    SET amount_paid = COALESCE((SELECT SUM(amount) FROM public.invoice_payments WHERE invoice_id = NEW.invoice_id), 0)
    WHERE id = NEW.invoice_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_update_invoice_amount_paid
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_invoice_amount_paid();
