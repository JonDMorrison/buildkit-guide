
-- RPC to create a conversion test fixture
-- Creates parent client, project, quote, and line items for testing
CREATE OR REPLACE FUNCTION public.rpc_create_conversion_test_fixture(p_org_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_ts text := to_char(now(), 'YYYYMMDD-HH24MISS');
  v_parent_client_id uuid;
  v_project_id uuid;
  v_quote_id uuid;
  v_quote_number text;
BEGIN
  -- Verify caller has org membership
  IF NOT public.has_org_membership(p_org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization' USING ERRCODE = '42501';
  END IF;

  -- 1) Create parent client with AP email
  INSERT INTO public.clients (
    organization_id, name, billing_address, ap_email, ap_contact_name, email
  ) VALUES (
    p_org_id,
    '[TEST-CONV] Parent Client ' || v_ts,
    '123 Test Billing St, Suite 100, Toronto ON M5V 2T6',
    'ap-test@example.com',
    'Test AP Contact',
    'general@example.com'
  ) RETURNING id INTO v_parent_client_id;

  -- 2) Create project with location (ship-to source)
  INSERT INTO public.projects (
    organization_id, name, location, created_by, status
  ) VALUES (
    p_org_id,
    '[TEST-CONV] Test Project ' || v_ts,
    '456 Job Site Ave, Unit 5, Vancouver BC V6B 1A1',
    v_actor,
    'in_progress'
  ) RETURNING id INTO v_project_id;

  -- 3) Create quote linked to project and parent client
  v_quote_number := get_next_quote_number(p_org_id);

  INSERT INTO public.quotes (
    organization_id, project_id, parent_client_id,
    quote_number, status,
    customer_pm_name, customer_pm_email,
    bill_to_name, bill_to_address, bill_to_ap_email,
    ship_to_name, ship_to_address,
    subtotal, gst, pst, total,
    created_by
  ) VALUES (
    p_org_id, v_project_id, v_parent_client_id,
    v_quote_number, 'approved',
    'Test PM Person', 'pm-test@example.com',
    '[TEST-CONV] Parent Client ' || v_ts, '123 Test Billing St, Suite 100, Toronto ON M5V 2T6', 'ap-test@example.com',
    '[TEST-CONV] Test Project ' || v_ts, '456 Job Site Ave, Unit 5, Vancouver BC V6B 1A1',
    1500.00, 75.00, 0.00, 1575.00,
    v_actor
  ) RETURNING id INTO v_quote_id;

  -- 4) Create 2 line items
  INSERT INTO public.quote_line_items (organization_id, quote_id, sort_order, product_or_service, description, quantity, rate, amount, sales_tax_rate, sales_tax_amount)
  VALUES
    (p_org_id, v_quote_id, 1, 'Labour', 'Electrical rough-in', 10, 100.00, 1000.00, 0.05, 50.00),
    (p_org_id, v_quote_id, 2, 'Materials', 'Wire and conduit', 5, 100.00, 500.00, 0.05, 25.00);

  RETURN json_build_object(
    'parent_client_id', v_parent_client_id,
    'project_id', v_project_id,
    'quote_id', v_quote_id,
    'quote_number', v_quote_number,
    'notes', 'All records prefixed with [TEST-CONV]. Quote status set to approved.'
  );
END;
$$;
