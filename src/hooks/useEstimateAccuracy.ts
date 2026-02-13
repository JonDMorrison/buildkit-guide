import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface VarianceData {
  contract_value: number;
  planned_labor_hours: number;
  actual_labor_hours: number;
  labor_hours_delta: number;
  planned_labor_cost: number;
  actual_labor_cost: number;
  labor_cost_delta: number;
  planned_material_cost: number;
  actual_material_cost: number;
  material_cost_delta: number;
  planned_machine_cost: number;
  actual_machine_cost: number;
  machine_cost_delta: number;
  planned_other_cost: number;
  actual_other_cost: number;
  other_cost_delta: number;
  planned_total_cost: number;
  actual_total_cost: number;
  total_cost_delta: number;
  planned_profit: number;
  actual_profit: number;
  planned_margin_percent: number;
  actual_margin_percent: number;
}

export const useEstimateAccuracy = (projectId: string | null) => {
  const [variance, setVariance] = useState<VarianceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setVariance(null);
      return;
    }

    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc(
          'project_variance_summary' as any,
          { p_project_id: projectId }
        );
        if (rpcError) throw rpcError;
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          setVariance({
            contract_value: Number(row.contract_value) || 0,
            planned_labor_hours: Number(row.planned_labor_hours) || 0,
            actual_labor_hours: Number(row.actual_labor_hours) || 0,
            labor_hours_delta: Number(row.labor_hours_delta) || 0,
            planned_labor_cost: Number(row.planned_labor_cost) || 0,
            actual_labor_cost: Number(row.actual_labor_cost) || 0,
            labor_cost_delta: Number(row.labor_cost_delta) || 0,
            planned_material_cost: Number(row.planned_material_cost) || 0,
            actual_material_cost: Number(row.actual_material_cost) || 0,
            material_cost_delta: Number(row.material_cost_delta) || 0,
            planned_machine_cost: Number(row.planned_machine_cost) || 0,
            actual_machine_cost: Number(row.actual_machine_cost) || 0,
            machine_cost_delta: Number(row.machine_cost_delta) || 0,
            planned_other_cost: Number(row.planned_other_cost) || 0,
            actual_other_cost: Number(row.actual_other_cost) || 0,
            other_cost_delta: Number(row.other_cost_delta) || 0,
            planned_total_cost: Number(row.planned_total_cost) || 0,
            actual_total_cost: Number(row.actual_total_cost) || 0,
            total_cost_delta: Number(row.total_cost_delta) || 0,
            planned_profit: Number(row.planned_profit) || 0,
            actual_profit: Number(row.actual_profit) || 0,
            planned_margin_percent: Number(row.planned_margin_percent) || 0,
            actual_margin_percent: Number(row.actual_margin_percent) || 0,
          });
        } else {
          setVariance(null);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [projectId]);

  return { variance, loading, error };
};
