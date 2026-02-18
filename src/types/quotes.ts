export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'archived';

export interface Quote {
  id: string;
  organization_id: string;
  project_id: string | null;
  client_id: string | null;
  parent_client_id: string | null;
  quote_number: string;
  status: QuoteStatus;
  customer_po_number: string | null;
  customer_pm_name: string | null;
  customer_pm_email: string | null;
  customer_pm_phone: string | null;
  bill_to_name: string | null;
  bill_to_address: string | null;
  bill_to_ap_email: string | null;
  ship_to_name: string | null;
  ship_to_address: string | null;
  subtotal: number;
  gst: number;
  pst: number;
  total: number;
  currency: string;
  note_for_customer: string | null;
  memo_on_statement: string | null;
  internal_notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  // Joined
  project?: { name: string; job_number: string | null } | null;
  client?: { name: string } | null;
}

export interface QuoteLineItem {
  id: string;
  organization_id: string;
  quote_id: string;
  sort_order: number;
  product_or_service: string;
  description: string | null;
  quantity: number;
  rate: number;
  amount: number;
  sales_tax_rate: number;
  sales_tax_amount: number;
}

export interface QuoteConversion {
  id: string;
  organization_id: string;
  quote_id: string;
  invoice_id: string;
  converted_by: string;
  converted_at: string;
}
