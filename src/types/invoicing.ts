export interface Client {
  id: string;
  organization_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceSettings {
  organization_id: string;
  company_name: string | null;
  company_address: string | null;
  logo_url: string | null;
  default_payment_terms: string;
  next_invoice_number: number;
  invoice_prefix: string;
  tax_rate: number;
  tax_label: string;
  notes_template: string | null;
  payment_instructions: string | null;
  currency: string;
  from_email: string | null;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';

export interface Invoice {
  id: string;
  organization_id: string;
  project_id: string | null;
  client_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  credit_note_for: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  paid_at: string | null;
  // Joined
  client?: Client | null;
  project?: { name: string; job_number: string | null } | null;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
  category: string;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface RecurringInvoiceTemplate {
  id: string;
  organization_id: string;
  client_id: string | null;
  project_id: string | null;
  frequency: string;
  next_issue_date: string;
  is_active: boolean;
  line_items: any[];
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  client?: Client | null;
  project?: { name: string } | null;
}
