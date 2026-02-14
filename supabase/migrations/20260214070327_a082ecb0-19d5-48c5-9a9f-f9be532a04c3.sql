
-- ============================================================
-- QUOTES MODULE: Schema + RLS + RPCs (fully separate from Estimates)
-- ============================================================

-- ── 1. quotes table ──
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  project_id uuid NULL REFERENCES public.projects(id),
  client_id uuid NULL REFERENCES public.clients(id),
  parent_client_id uuid NULL REFERENCES public.clients(id),
  quote_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','approved','rejected','archived')),
  customer_po_number text NULL,
  customer_pm_name text NULL,
  customer_pm_email text NULL,
  customer_pm_phone text NULL,
  -- Address snapshots
  bill_to_name text NULL,
  bill_to_address text NULL,
  bill_to_ap_email text NULL,
  ship_to_name text NULL,
  ship_to_address text NULL,
  -- Money
  subtotal numeric NOT NULL DEFAULT 0,
  gst numeric NOT NULL DEFAULT 0,
  pst numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  -- Notes
  note_for_customer text NULL,
  memo_on_statement text NULL,
  internal_notes text NULL,
  -- Audit
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz NULL,
  UNIQUE (organization_id, quote_number)
);

CREATE TRIGGER set_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. quote_line_items table ──
CREATE TABLE public.quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  product_or_service text NOT NULL,
  description text NULL,
  quantity numeric NOT NULL DEFAULT 1,
  rate numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  sales_tax_rate numeric NOT NULL DEFAULT 0,
  sales_tax_amount numeric NOT NULL DEFAULT 0
);

-- ── 3. quote_conversions audit table ──
CREATE TABLE public.quote_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  quote_id uuid NOT NULL REFERENCES public.quotes(id),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  converted_by uuid NOT NULL,
  converted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id)
);

-- ════════════════════════════════════════════════════
-- RLS: quotes
-- ════════════════════════════════════════════════════
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes FORCE ROW LEVEL SECURITY;

CREATE POLICY "quotes_select" ON public.quotes FOR SELECT TO authenticated
  USING (has_org_membership(organization_id));

CREATE POLICY "quotes_insert" ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm','accounting')
  );

CREATE POLICY "quotes_update" ON public.quotes FOR UPDATE TO authenticated
  USING (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm','accounting')
  )
  WITH CHECK (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm','accounting')
  );

CREATE POLICY "quotes_delete" ON public.quotes FOR DELETE TO authenticated
  USING (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm','accounting')
  );

-- ════════════════════════════════════════════════════
-- RLS: quote_line_items
-- ════════════════════════════════════════════════════
ALTER TABLE public.quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_line_items FORCE ROW LEVEL SECURITY;

CREATE POLICY "qli_select" ON public.quote_line_items FOR SELECT TO authenticated
  USING (has_org_membership(organization_id));

CREATE POLICY "qli_insert" ON public.quote_line_items FOR INSERT TO authenticated
  WITH CHECK (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm','accounting')
  );

CREATE POLICY "qli_update" ON public.quote_line_items FOR UPDATE TO authenticated
  USING (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm','accounting')
  )
  WITH CHECK (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm','accounting')
  );

CREATE POLICY "qli_delete" ON public.quote_line_items FOR DELETE TO authenticated
  USING (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm','accounting')
  );

-- ════════════════════════════════════════════════════
-- RLS: quote_conversions
-- ════════════════════════════════════════════════════
ALTER TABLE public.quote_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_conversions FORCE ROW LEVEL SECURITY;

CREATE POLICY "qc_select" ON public.quote_conversions FOR SELECT TO authenticated
  USING (has_org_membership(organization_id));

-- No client INSERT/UPDATE/DELETE — conversions happen via RPC only
CREATE POLICY "qc_deny_insert" ON public.quote_conversions FOR INSERT TO authenticated
  WITH CHECK (
    has_org_membership(organization_id)
    AND org_role(organization_id) IN ('admin','pm','accounting')
  );

-- ════════════════════════════════════════════════════
-- Immutability: block edits on approved/sent quotes
-- ════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.enforce_quote_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow transitions: approved→archived, sent→approved, sent→rejected
  IF OLD.status IN ('approved','rejected') AND NEW.status = OLD.status THEN
    RAISE EXCEPTION 'Cannot modify an approved/rejected quote.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_quote_immutability_trigger
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_quote_immutability();

CREATE OR REPLACE FUNCTION public.enforce_quote_line_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.quotes WHERE id = COALESCE(OLD.quote_id, NEW.quote_id);
  IF v_status IN ('approved','rejected','archived') THEN
    RAISE EXCEPTION 'Cannot modify line items of an approved/rejected/archived quote.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER enforce_qli_immutability_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.quote_line_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_quote_line_immutability();

-- ════════════════════════════════════════════════════
-- Sequential quote number generator
-- ════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_next_quote_number(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next int;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN quote_number ~ '^QTE-\d+$'
    THEN CAST(SUBSTRING(quote_number FROM 5) AS int)
    ELSE 0 END
  ), 0) + 1
  INTO v_next
  FROM public.quotes
  WHERE organization_id = p_org_id;

  RETURN 'QTE-' || LPAD(v_next::text, 4, '0');
END;
$$;

-- ════════════════════════════════════════════════════
-- RPC: convert_quote_to_invoice
-- ════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.convert_quote_to_invoice(p_quote_id uuid, p_actor_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote RECORD;
  v_existing_conversion RECORD;
  v_invoice_id uuid;
  v_inv_num text;
  v_role text;
BEGIN
  -- Load quote
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  -- Auth check
  IF NOT public.has_org_membership(v_quote.organization_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_role := public.org_role(v_quote.organization_id);
  IF v_role NOT IN ('admin','pm','accounting') THEN
    RAISE EXCEPTION 'Insufficient role';
  END IF;

  -- Must be approved
  IF v_quote.status != 'approved' THEN
    RAISE EXCEPTION 'Quote must be approved before conversion';
  END IF;

  -- Idempotency: check if already converted
  SELECT * INTO v_existing_conversion
  FROM public.quote_conversions WHERE quote_id = p_quote_id;
  IF FOUND THEN
    RETURN v_existing_conversion.invoice_id;
  END IF;

  -- Get next invoice number
  SELECT public.get_next_invoice_number(v_quote.organization_id) INTO v_inv_num;

  -- Create invoice with snapshot fields
  -- CRITICAL: send_to_emails = bill_to_ap_email (AP), NOT customer_pm_email
  INSERT INTO public.invoices (
    organization_id, project_id, client_id, invoice_number, status,
    issue_date, subtotal, tax_amount, total, amount_paid,
    created_by, invoice_type,
    bill_to_client_id, bill_to_name, bill_to_address,
    ship_to_address, send_to_emails,
    po_number, notes
  ) VALUES (
    v_quote.organization_id,
    v_quote.project_id,
    v_quote.client_id,
    v_inv_num,
    'draft',
    CURRENT_DATE,
    v_quote.subtotal,
    v_quote.gst + v_quote.pst,
    v_quote.total,
    0,
    p_actor_id,
    'standard',
    COALESCE(v_quote.parent_client_id, v_quote.client_id),
    v_quote.bill_to_name,
    v_quote.bill_to_address,
    v_quote.ship_to_address,
    v_quote.bill_to_ap_email,  -- AP email, NOT PM email
    v_quote.customer_po_number,
    v_quote.note_for_customer
  ) RETURNING id INTO v_invoice_id;

  -- Copy line items
  INSERT INTO public.invoice_line_items (
    invoice_id, description, quantity, unit_price, amount, sort_order, category
  )
  SELECT
    v_invoice_id,
    COALESCE(qli.description, qli.product_or_service),
    qli.quantity,
    qli.rate,
    qli.amount,
    qli.sort_order,
    'general'
  FROM public.quote_line_items qli
  WHERE qli.quote_id = p_quote_id
  ORDER BY qli.sort_order;

  -- Record conversion
  INSERT INTO public.quote_conversions (
    organization_id, quote_id, invoice_id, converted_by
  ) VALUES (
    v_quote.organization_id, p_quote_id, v_invoice_id, p_actor_id
  );

  RETURN v_invoice_id;
END;
$$;
