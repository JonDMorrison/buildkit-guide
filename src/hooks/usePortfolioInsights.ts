import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';

export interface PortfolioRow {
  project_id: string;
  job_number: string | null;
  customer_name: string | null;
  project_name: string;
  status: string;
  contract_value: number;
  invoiced_amount: number;
  invoiced_amount_strict: number;
  invoiced_amount_relaxed: number;
  remainder_to_invoice: number;
  billed_percentage: number;
  current_percent_to_bill: number;
  planned_labor_hours: number;
  actual_labor_hours: number;
  labor_hours_delta: number;
  planned_total_cost: number;
  actual_total_cost: number;
  total_cost_delta: number;
  planned_profit: number;
  actual_profit: number;
  planned_margin_percent: number;
  actual_margin_percent: number;
  // Diagnostics
  labor_hours_missing_cost_rate: number;
  labor_hours_missing_membership: number;
  actual_unclassified_cost: number;
  // Budget detection (UI-only flag)
  has_budget: boolean;
}

export const usePortfolioInsights = (statusFilter: string | null) => {
  const { activeOrganizationId } = useOrganization();
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keep previous data visible during refetch
  const prevRowsRef = useRef<PortfolioRow[]>([]);

  useEffect(() => {
    if (!activeOrganizationId) {
      setRows([]);
      prevRowsRef.current = [];
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: any = { p_org_id: activeOrganizationId };
        if (statusFilter) params.p_status_filter = statusFilter;

        // Fetch portfolio data and budget existence in parallel
        const [rpcRes, budgetsRes] = await Promise.all([
          supabase.rpc('project_portfolio_report' as any, params),
          supabase
            .from('project_budgets')
            .select('project_id')
            .eq('organization_id', activeOrganizationId),
        ]);

        if (rpcRes.error) throw rpcRes.error;

        const budgetProjectIds = new Set(
          (budgetsRes.data || []).map((b: any) => b.project_id)
        );

        const mapped: PortfolioRow[] = (rpcRes.data || []).map((r: any) => ({
          project_id: r.project_id,
          job_number: r.job_number,
          customer_name: r.customer_name,
          project_name: r.project_name,
          status: r.status,
          contract_value: Number(r.contract_value) || 0,
          invoiced_amount: Number(r.invoiced_amount) || 0,
          invoiced_amount_strict: Number(r.invoiced_amount_strict) || 0,
          invoiced_amount_relaxed: Number(r.invoiced_amount_relaxed) || 0,
          remainder_to_invoice: Number(r.remainder_to_invoice) || 0,
          billed_percentage: Number(r.billed_percentage) || 0,
          current_percent_to_bill: Number(r.current_percent_to_bill) || 0,
          planned_labor_hours: Number(r.planned_labor_hours) || 0,
          actual_labor_hours: Number(r.actual_labor_hours) || 0,
          labor_hours_delta: Number(r.labor_hours_delta) || 0,
          planned_total_cost: Number(r.planned_total_cost) || 0,
          actual_total_cost: Number(r.actual_total_cost) || 0,
          total_cost_delta: Number(r.total_cost_delta) || 0,
          planned_profit: Number(r.planned_profit) || 0,
          actual_profit: Number(r.actual_profit) || 0,
          planned_margin_percent: Number(r.planned_margin_percent) || 0,
          actual_margin_percent: Number(r.actual_margin_percent) || 0,
          labor_hours_missing_cost_rate: Number(r.labor_hours_missing_cost_rate) || 0,
          labor_hours_missing_membership: Number(r.labor_hours_missing_membership) || 0,
          actual_unclassified_cost: Number(r.actual_unclassified_cost) || 0,
          has_budget: budgetProjectIds.has(r.project_id),
        }));

        setRows(mapped);
        prevRowsRef.current = mapped;
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeOrganizationId, statusFilter]);

  // Return previous rows while loading to avoid flicker
  const displayRows = loading && prevRowsRef.current.length > 0 ? prevRowsRef.current : rows;

  return { rows: displayRows, loading, error };
};
