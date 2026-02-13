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
  // Parent/child model
  parent_client_id: string | null;
  // Extended contact fields
  gst_number: string | null;
  ap_contact_name: string | null;
  ap_email: string | null;
  ap_phone: string | null;
  pm_contact_name: string | null;
  pm_email: string | null;
  pm_phone: string | null;
  site_contact_name: string | null;
  site_contact_email: string | null;
  site_contact_phone: string | null;
  zones: number;
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
  // Multi-tax & new settings
  tax2_rate: number;
  tax2_label: string;
  default_retainage_percent: number;
  require_approval: boolean;
  reminder_enabled: boolean;
  reminder_days: number[];
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
export type InvoiceType = 'standard' | 'progress' | 'deposit' | 'retainage_release';
export type ApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected';

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
  // New fields
  invoice_type: InvoiceType;
  retainage_percent: number;
  retainage_amount: number;
  retainage_released: boolean;
  retainage_released_at: string | null;
  progress_percent: number;
  contract_total: number;
  deposit_applied_to: string | null;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  po_number: string | null;
  last_reminder_sent_at: string | null;
  reminder_count: number;
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

export interface InvoiceTaxLine {
  id: string;
  invoice_id: string;
  tax_name: string;
  tax_rate: number;
  tax_amount: number;
  sort_order: number;
}

export interface InvoiceActivityLog {
  id: string;
  invoice_id: string;
  user_id: string;
  action: string;
  details: string | null;
  metadata: any;
  created_at: string;
}

export interface InvoiceReceiptLink {
  id: string;
  invoice_id: string;
  receipt_id: string;
  created_at: string;
  created_by: string;
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
