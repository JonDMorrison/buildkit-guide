import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Estimate, EstimateLineItem, EstimateVarianceSummary } from '@/types/estimates';

export const useEstimates = (projectId?: string | null) => {
  const { activeOrganizationId } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEstimates = useCallback(async () => {
    if (!activeOrganizationId) return;
    setLoading(true);
    let query = supabase
      .from('estimates')
      .select('*, projects(name, job_number), clients(name)')
      .eq('organization_id', activeOrganizationId)
      .order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Error loading estimates', description: error.message, variant: 'destructive' });
    }
    const mapped = ((data as any[]) || []).map((e: any) => ({
      ...e,
      project: e.projects || null,
      client: e.clients || null,
    }));
    setEstimates(mapped);
    setLoading(false);
  }, [activeOrganizationId, projectId]);

  useEffect(() => { fetchEstimates(); }, [fetchEstimates]);

  const createEstimate = async (
    estimate: Partial<Estimate>,
    lineItems: Partial<EstimateLineItem>[]
  ) => {
    if (!activeOrganizationId || !user) return null;

    // Get next estimate number
    const { data: estNum } = await supabase.rpc('get_next_estimate_number', { p_org_id: activeOrganizationId });

    // Compute line item amounts
    const computedItems = lineItems.map((li, i) => {
      const qty = Number(li.quantity) || 0;
      const rate = Number(li.rate) || 0;
      const amount = Math.round(qty * rate * 100) / 100;
      const taxRate = Number(li.sales_tax_rate) || 0;
      const taxAmount = Math.round(amount * (taxRate / 100) * 100) / 100;
      return { ...li, sort_order: i, amount, sales_tax_amount: taxAmount };
    });

    // Compute rollups
    const laborItems = computedItems.filter(li => li.item_type === 'task' || li.item_type === 'service');
    const laborHours = laborItems.reduce((s, li) => s + (Number(li.quantity) || 0), 0);
    const laborBillAmount = laborItems.reduce((s, li) => s + (li.amount || 0), 0);
    const laborBillRate = laborHours > 0 ? Math.round((laborBillAmount / laborHours) * 100) / 100 : 0;
    const materialCost = Number(estimate.planned_material_cost) || 0;
    const machineCost = Number(estimate.planned_machine_cost) || 0;
    const otherCost = Number(estimate.planned_other_cost) || 0;
    const totalCost = Math.round((laborBillAmount + materialCost + machineCost + otherCost) * 100) / 100;
    const contractValue = Number(estimate.contract_value) || 0;
    const profit = Math.round((contractValue - totalCost) * 100) / 100;
    const marginPercent = contractValue > 0 ? Math.round((profit / contractValue) * 1000) / 10 : 0;

    const { data, error } = await supabase
      .from('estimates')
      .insert({
        ...estimate,
        organization_id: activeOrganizationId,
        created_by: user.id,
        estimate_number: estNum || 'EST-0001',
        planned_labor_hours: laborHours,
        planned_labor_bill_rate: laborBillRate,
        planned_labor_bill_amount: laborBillAmount,
        planned_total_cost: totalCost,
        planned_profit: profit,
        planned_margin_percent: marginPercent,
      } as any)
      .select()
      .single();

    if (error) {
      toast({ title: 'Error creating estimate', description: error.message, variant: 'destructive' });
      return null;
    }

    if (computedItems.length > 0 && data) {
      const rows = computedItems.map(li => ({
        ...li,
        estimate_id: (data as any).id,
        organization_id: activeOrganizationId,
      }));
      await supabase.from('estimate_line_items').insert(rows as any);
    }

    await fetchEstimates();
    return data;
  };

  const updateEstimate = async (id: string, updates: Partial<Estimate>) => {
    const { error } = await supabase
      .from('estimates')
      .update(updates as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error updating estimate', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchEstimates();
    return true;
  };

  const approveEstimate = async (id: string) => {
    const { error } = await supabase
      .from('estimates')
      .update({ status: 'approved', approved_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error approving estimate', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Estimate approved', description: 'This estimate is now locked.' });
    await fetchEstimates();
    return true;
  };

  const duplicateEstimate = async (sourceId: string) => {
    // Fetch source estimate and line items
    const { data: source } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', sourceId)
      .single();
    if (!source) return null;

    const { data: sourceItems } = await supabase
      .from('estimate_line_items')
      .select('*')
      .eq('estimate_id', sourceId)
      .order('sort_order');

    const s = source as any;
    const items = ((sourceItems as any[]) || []).map(({ id, estimate_id, ...rest }: any) => rest);

    return createEstimate(
      {
        project_id: s.project_id,
        client_id: s.client_id,
        parent_client_id: s.parent_client_id,
        customer_po_number: s.customer_po_number,
        customer_pm_name: s.customer_pm_name,
        customer_pm_email: s.customer_pm_email,
        customer_pm_phone: s.customer_pm_phone,
        bill_to_name: s.bill_to_name,
        bill_to_address: s.bill_to_address,
        bill_to_ap_email: s.bill_to_ap_email,
        ship_to_name: s.ship_to_name,
        ship_to_address: s.ship_to_address,
        contract_value: s.contract_value,
        planned_material_cost: s.planned_material_cost,
        planned_machine_cost: s.planned_machine_cost,
        planned_other_cost: s.planned_other_cost,
        note_for_customer: s.note_for_customer,
        memo_on_statement: s.memo_on_statement,
        internal_notes: s.internal_notes,
      },
      items
    );
  };

  const deleteEstimate = async (id: string) => {
    await supabase.from('estimate_line_items').delete().eq('estimate_id', id);
    const { error } = await supabase.from('estimates').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error deleting estimate', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchEstimates();
    return true;
  };

  const fetchLineItems = async (estimateId: string): Promise<EstimateLineItem[]> => {
    const { data } = await supabase
      .from('estimate_line_items')
      .select('*')
      .eq('estimate_id', estimateId)
      .order('sort_order');
    return (data as any[]) || [];
  };

  const saveLineItems = async (estimateId: string, items: Partial<EstimateLineItem>[]) => {
    await supabase.from('estimate_line_items').delete().eq('estimate_id', estimateId);
    if (items.length > 0) {
      const rows = items.map((li, i) => {
        const qty = Number(li.quantity) || 0;
        const rate = Number(li.rate) || 0;
        const amount = Math.round(qty * rate * 100) / 100;
        const taxRate = Number(li.sales_tax_rate) || 0;
        const taxAmount = Math.round(amount * (taxRate / 100) * 100) / 100;
        return {
          ...li,
          estimate_id: estimateId,
          organization_id: activeOrganizationId,
          sort_order: i,
          amount,
          sales_tax_amount: taxAmount,
        };
      });
      await supabase.from('estimate_line_items').insert(rows as any);
    }
  };

  const fetchVariance = async (projId: string): Promise<EstimateVarianceSummary | null> => {
    const { data, error } = await supabase.rpc('estimate_variance_summary', { p_project_id: projId });
    if (error) {
      toast({ title: 'Error loading variance', description: error.message, variant: 'destructive' });
      return null;
    }
    return data as unknown as EstimateVarianceSummary;
  };

  return {
    estimates,
    loading,
    fetchEstimates,
    createEstimate,
    updateEstimate,
    approveEstimate,
    duplicateEstimate,
    deleteEstimate,
    fetchLineItems,
    saveLineItems,
    fetchVariance,
  };
};
