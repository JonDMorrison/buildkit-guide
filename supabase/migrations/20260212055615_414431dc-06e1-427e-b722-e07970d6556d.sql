
-- Create invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'void');

-- Clients directory
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  billing_address TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view clients"
  ON public.clients FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins and PMs can insert clients"
  ON public.clients FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins and PMs can update clients"
  ON public.clients FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can delete clients"
  ON public.clients FOR DELETE
  USING (is_org_admin(auth.uid(), organization_id));

-- Invoice settings (per-org branding & defaults)
CREATE TABLE public.invoice_settings (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE PRIMARY KEY,
  company_name TEXT,
  company_address TEXT,
  logo_url TEXT,
  default_payment_terms TEXT DEFAULT 'Net 30',
  next_invoice_number INTEGER NOT NULL DEFAULT 1,
  invoice_prefix TEXT DEFAULT 'INV-',
  tax_rate NUMERIC DEFAULT 0,
  tax_label TEXT DEFAULT 'Tax',
  notes_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view invoice settings"
  ON public.invoice_settings FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can insert invoice settings"
  ON public.invoice_settings FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can update invoice settings"
  ON public.invoice_settings FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));

-- Invoices
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id),
  client_id UUID REFERENCES public.clients(id),
  invoice_number TEXT NOT NULL,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view invoices"
  ON public.invoices FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can create invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update invoices"
  ON public.invoices FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can delete invoices"
  ON public.invoices FOR DELETE
  USING (is_org_admin(auth.uid(), organization_id));

-- Invoice line items
CREATE TABLE public.invoice_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'other'
);

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view line items for their invoices"
  ON public.invoice_line_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
    AND is_org_member(auth.uid(), i.organization_id)
  ));

CREATE POLICY "Users can insert line items for their invoices"
  ON public.invoice_line_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
    AND is_org_member(auth.uid(), i.organization_id)
  ));

CREATE POLICY "Users can update line items for their invoices"
  ON public.invoice_line_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
    AND is_org_member(auth.uid(), i.organization_id)
  ));

CREATE POLICY "Users can delete line items for their invoices"
  ON public.invoice_line_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
    AND is_org_member(auth.uid(), i.organization_id)
  ));

-- Function to auto-increment invoice number
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix TEXT;
  next_num INTEGER;
  result TEXT;
BEGIN
  -- Get or create settings
  INSERT INTO public.invoice_settings (organization_id)
  VALUES (org_id)
  ON CONFLICT (organization_id) DO NOTHING;

  -- Atomically increment and return
  UPDATE public.invoice_settings
  SET next_invoice_number = next_invoice_number + 1,
      updated_at = now()
  WHERE organization_id = org_id
  RETURNING invoice_prefix, next_invoice_number - 1 INTO prefix, next_num;

  result := COALESCE(prefix, 'INV-') || LPAD(next_num::TEXT, 4, '0');
  RETURN result;
END;
$$;
