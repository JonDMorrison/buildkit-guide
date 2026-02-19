import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProfitRiskData {
  project_id: string;
  currency: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  estimate_total_cost: number | null;
  actual_total_cost: number;
  projected_final_cost: number | null;
  projected_margin: number | null;
  drivers: Array<{ key: string; label: string; severity: string; evidence: string }>;
  flags: Record<string, boolean>;
  data_completeness_score: number;
}

export interface CostRollupData {
  actual_labor_hours: number;
  actual_labor_cost: number;
  actual_material_cost: number;
  actual_total_cost: number;
  unrated_labor_hours: number;
  unrated_labor_entries_count: number;
  currency: string;
  flags: Record<string, boolean>;
}

export interface VarianceSummaryData {
  project_id: string;
  currency: string;
  integrity_score: number;
  integrity_status: string;
  budget_variance_pct: number | null;
  labor_variance_pct: number | null;
  material_variance_pct: number | null;
  blockers: Array<{ key: string; label: string }>;
}

export interface ReceiptLagData {
  avg_lag_days: number | null;
  pending_count: number;
  oldest_pending_days: number | null;
}

export interface SafetyGapData {
  total_forms_required: number;
  total_forms_submitted: number;
  gap_count: number;
  compliance_pct: number;
}

export function useProfitRisk(projectId: string | null) {
  return useQuery({
    queryKey: ['intelligence', 'profit-risk', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rpc_get_project_profit_risk' as any, {
        p_project_id: projectId,
      });
      if (error) throw error;
      return data as ProfitRiskData;
    },
    enabled: !!projectId,
  });
}

export function useCostRollup(projectId: string | null) {
  return useQuery({
    queryKey: ['intelligence', 'cost-rollup', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rpc_get_project_cost_rollup' as any, {
        p_project_id: projectId,
      });
      if (error) throw error;
      return data as CostRollupData;
    },
    enabled: !!projectId,
  });
}

export function useVarianceSummary(projectId: string | null) {
  return useQuery({
    queryKey: ['intelligence', 'variance', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('estimate_variance_summary' as any, {
        p_project_id: projectId,
      });
      if (error) throw error;
      return data as VarianceSummaryData;
    },
    enabled: !!projectId,
  });
}

export function useReceiptLag(projectId: string | null) {
  return useQuery({
    queryKey: ['intelligence', 'receipt-lag', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receipts')
        .select('created_at, review_status')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) return null;

      const pending = data.filter((r) => r.review_status === 'pending');
      const now = Date.now();
      const lagDays = pending.map((r) =>
        Math.floor((now - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24))
      );

      return {
        avg_lag_days: lagDays.length > 0 ? Math.round(lagDays.reduce((a, b) => a + b, 0) / lagDays.length) : null,
        pending_count: pending.length,
        oldest_pending_days: lagDays.length > 0 ? Math.max(...lagDays) : null,
      } as ReceiptLagData;
    },
    enabled: !!projectId,
  });
}

export function useSafetyGaps(projectId: string | null) {
  return useQuery({
    queryKey: ['intelligence', 'safety-gaps', projectId],
    queryFn: async () => {
      // Count submitted safety forms vs expected (daily logs should have corresponding forms)
      const { data: forms, error } = await supabase
        .from('safety_forms')
        .select('id, status')
        .eq('project_id', projectId!);
      if (error) throw error;

      const { data: logs } = await supabase
        .from('daily_logs')
        .select('id')
        .eq('project_id', projectId!);

      const totalRequired = logs?.length ?? 0;
      const submitted = forms?.filter((f) => f.status === 'submitted' || f.status === 'reviewed').length ?? 0;
      const gap = Math.max(0, totalRequired - submitted);

      return {
        total_forms_required: totalRequired,
        total_forms_submitted: submitted,
        gap_count: gap,
        compliance_pct: totalRequired > 0 ? Math.round((submitted / totalRequired) * 100) : 100,
      } as SafetyGapData;
    },
    enabled: !!projectId,
  });
}
