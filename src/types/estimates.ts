export type EstimateStatus = 'draft' | 'approved' | 'archived';

export interface Estimate {
  id: string;
  organization_id: string;
  project_id: string;
  client_id: string | null;
  parent_client_id: string | null;
  estimate_number: string;
  status: EstimateStatus;
  customer_po_number: string | null;
  customer_pm_name: string | null;
  customer_pm_email: string | null;
  customer_pm_phone: string | null;
  bill_to_name: string | null;
  bill_to_address: string | null;
  bill_to_ap_email: string | null;
  ship_to_name: string | null;
  ship_to_address: string | null;
  contract_value: number;
  currency: string;
  planned_labor_hours: number;
  planned_labor_bill_rate: number;
  planned_labor_bill_amount: number;
  planned_material_cost: number;
  planned_machine_cost: number;
  planned_other_cost: number;
  planned_total_cost: number;
  planned_profit: number;
  planned_margin_percent: number;
  note_for_customer: string | null;
  memo_on_statement: string | null;
  internal_notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  converted_invoice_id?: string | null;
  playbook_id?: string | null;
  // Joined
  project?: { name: string; job_number: string | null } | null;
  client?: { name: string } | null;
}

export type EstimateLineItemType = 'labor' | 'material' | 'machine' | 'other';

export interface EstimateLineItem {
  id: string;
  organization_id: string;
  estimate_id: string;
  sort_order: number;
  item_type: EstimateLineItemType;
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  rate: number;
  amount: number;
  sales_tax_rate: number;
  sales_tax_amount: number;
  scope_item_id: string | null;
  task_id: string | null;
}

export interface EstimateVarianceSummary {
  has_estimate: boolean;
  estimate_id: string | null;
  currency: string;
  planned: {
    labor_hours: number;
    labor_bill_amount: number;
    labor_cost_rate: number;
    material_cost: number;
    machine_cost: number;
    other_cost: number;
    total_cost: number;
    contract_value: number;
    profit: number;
    margin_percent: number;
  };
  actual: {
    labor_hours: number;
    labor_cost: number;
    material_cost: number;
    machine_cost: number;
    other_cost: number;
    unclassified_cost: number;
    total_cost: number;
  };
  deltas: {
    labor_hours: number;
    labor_cost: number;
    material: number;
    machine: number;
    other: number;
    total_cost: number;
  };
  margin: {
    contract_value: number;
    actual_profit: number;
    actual_margin_percent: number;
  };
  diagnostics: {
    missing_cost_rates_hours: number;
    missing_cost_rates_count: number;
    unassigned_time_hours: number;
    unclassified_receipts_amount: number;
    currency_mismatch_hours: number;
    currency_mismatch_count: number;
    currency_mismatch_detected: boolean;
    missing_estimate: boolean;
  };
}
