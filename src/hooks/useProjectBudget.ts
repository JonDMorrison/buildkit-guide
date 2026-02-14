import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProjectBudget {
  id: string;
  organization_id: string;
  project_id: string;
  client_id: string | null;
  contract_value: number;
  planned_labor_hours: number;
  planned_labor_cost: number;
  planned_material_cost: number;
  planned_machine_cost: number;
  planned_other_cost: number;
  planned_billable_amount: number;
  currency: string;
}

export interface ScopeRollup {
  totalPlannedHours: number;
  totalMaterialCost: number;
  totalMachineCost: number;
  totalPlannedTotal: number;
  itemCount: number;
}

export interface ActualCosts {
  actual_labor_hours: number;
  actual_labor_cost: number;
  actual_material_cost: number;
  actual_machine_cost: number;
  actual_other_cost: number;
  actual_total_cost: number;
  actual_unclassified_cost: number;
  unclassified_receipt_count: number;
  labor_hours_missing_cost_rate: number;
  labor_hours_missing_membership: number;
  labor_entry_count_missing_cost_rate: number;
  labor_entry_count_missing_membership: number;
}

export interface VarianceSummary {
  contract_value: number;
  planned_labor_hours: number;
  planned_labor_cost: number;
  planned_material_cost: number;
  planned_machine_cost: number;
  planned_other_cost: number;
  planned_total_cost: number;
  planned_profit: number;
  planned_margin_percent: number;
  actual_labor_hours: number;
  actual_labor_cost: number;
  actual_material_cost: number;
  actual_machine_cost: number;
  actual_other_cost: number;
  actual_total_cost: number;
  actual_profit: number;
  actual_margin_percent: number;
  labor_hours_delta: number;
  labor_cost_delta: number;
  material_cost_delta: number;
  machine_cost_delta: number;
  other_cost_delta: number;
  total_cost_delta: number;
  labor_hours_missing_cost_rate: number;
  labor_hours_missing_membership: number;
  actual_unclassified_cost: number;
}

export function useProjectBudget(projectId: string) {
  const { toast } = useToast();
  const [budget, setBudget] = useState<ProjectBudget | null>(null);
  const [scopeRollup, setScopeRollup] = useState<ScopeRollup | null>(null);
  const [actuals, setActuals] = useState<ActualCosts | null>(null);
  const [variance, setVariance] = useState<VarianceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasBudget, setHasBudget] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Parallel fetch budget, scope rollup, actuals, variance
      const [budgetRes, scopeRes, actualsRes, varianceRes] = await Promise.all([
        supabase
          .from('project_budgets')
          .select('*')
          .eq('project_id', projectId)
          .maybeSingle(),
        supabase
          .from('project_scope_items')
          .select('planned_hours, planned_material_cost, planned_machine_cost, planned_total')
          .eq('project_id', projectId)
          .eq('item_type', 'labor')
          .eq('is_archived', false),
        supabase.rpc('project_actual_costs', { p_project_id: projectId }),
        supabase.rpc('project_variance_summary', { p_project_id: projectId }),
      ]);

      if (budgetRes.error) throw budgetRes.error;
      setBudget(budgetRes.data as ProjectBudget | null);
      setHasBudget(!!budgetRes.data);

      // Scope rollup
      const items = scopeRes.data || [];
      setScopeRollup({
        totalPlannedHours: items.reduce((s, i) => s + (Number(i.planned_hours) || 0), 0),
        totalMaterialCost: items.reduce((s, i) => s + (Number(i.planned_material_cost) || 0), 0),
        totalMachineCost: items.reduce((s, i) => s + (Number(i.planned_machine_cost) || 0), 0),
        totalPlannedTotal: items.reduce((s, i) => s + (Number(i.planned_total) || 0), 0),
        itemCount: items.length,
      });

      // Actuals
      if (!actualsRes.error && actualsRes.data) {
        const row = Array.isArray(actualsRes.data) ? actualsRes.data[0] : actualsRes.data;
        if (row) setActuals(row as unknown as ActualCosts);
      }

      // Variance
      if (!varianceRes.error && varianceRes.data) {
        const row = Array.isArray(varianceRes.data) ? varianceRes.data[0] : varianceRes.data;
        if (row) setVariance(row as unknown as VarianceSummary);
      }
    } catch (err: any) {
      toast({ title: 'Error loading budget data', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createBudget = async () => {
    setSaving(true);
    try {
      const { data: proj } = await supabase
        .from('projects')
        .select('organization_id')
        .eq('id', projectId)
        .single();
      if (!proj) throw new Error('Project not found');

      const { data, error } = await supabase
        .from('project_budgets')
        .insert({ project_id: projectId, organization_id: proj.organization_id })
        .select()
        .single();
      if (error) throw error;
      setBudget(data as unknown as ProjectBudget);
      setHasBudget(true);
      toast({ title: 'Budget created' });
    } catch (err: any) {
      toast({ title: 'Error creating budget', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateBudget = async (updates: Partial<ProjectBudget>) => {
    if (!budget) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('project_budgets')
        .update(updates as any)
        .eq('id', budget.id);
      if (error) throw error;
      setBudget({ ...budget, ...updates });
      toast({ title: 'Budget updated' });
    } catch (err: any) {
      toast({ title: 'Error updating budget', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const applyRollup = async () => {
    if (!budget || !scopeRollup) return;
    await updateBudget({
      planned_labor_hours: scopeRollup.totalPlannedHours,
      planned_material_cost: scopeRollup.totalMaterialCost,
      planned_machine_cost: scopeRollup.totalMachineCost,
    });
  };

  return {
    budget, scopeRollup, actuals, variance,
    loading, saving, hasBudget,
    createBudget, updateBudget, applyRollup, refresh: fetchAll,
  };
}
