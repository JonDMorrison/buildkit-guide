import { useState, useEffect } from 'react';
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
}

export const usePortfolioInsights = (statusFilter: string | null) => {
  const { activeOrganizationId } = useOrganization();
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeOrganizationId) {
      setRows([]);
      return;
    }

    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: any = { p_org_id: activeOrganizationId };
        if (statusFilter) params.p_status_filter = statusFilter;

        const { data, error: rpcError } = await supabase.rpc(
          'project_portfolio_report' as any,
          params
        );
        if (rpcError) throw rpcError;

        const mapped: PortfolioRow[] = (data || []).map((r: any) => ({
          project_id: r.project_id,
          job_number: r.job_number,
          customer_name: r.customer_name,
          project_name: r.project_name,
          status: r.status,
          contract_value: Number(r.contract_value) || 0,
          invoiced_amount: Number(r.invoiced_amount) || 0,
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
        }));

        setRows(mapped);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [activeOrganizationId, statusFilter]);

  return { rows, loading, error };
};
