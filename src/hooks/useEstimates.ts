import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useToast } from '@/hooks/use-toast';
import type { Estimate, EstimateLineItem, EstimateVarianceSummary } from '@/types/estimates';

export const useEstimates = (projectId?: string | null) => {
  const { activeOrganizationId } = useOrganization();
  const { toast } = useToast();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEstimates = useCallback(async () => {
    if (!activeOrganizationId) return;
    setLoading(true);
    let query = supabase
      .from('estimates')
      .select('*,projects(name,job_number),clients:clients!estimates_client_id_fkey(name)')
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

  // All writes go through SECURITY DEFINER RPCs

  const createEstimate = async (projId: string) => {
    const { data, error } = await (supabase as any).rpc('rpc_create_estimate', {
      p_project_id: projId,
    });
    if (error) {
      toast({ title: 'Error creating estimate', description: error.message, variant: 'destructive' });
      return null;
    }
    await fetchEstimates();
    return data;
  };

  const updateEstimateHeader = async (estimateId: string, patch: Record<string, any>) => {
    const { data, error } = await (supabase as any).rpc('rpc_update_estimate_header', {
      p_estimate_id: estimateId,
      p_patch: patch,
    });
    if (error) {
      toast({ title: 'Error updating estimate', description: error.message, variant: 'destructive' });
      return null;
    }
    await fetchEstimates();
    return data;
  };

  const approveEstimate = async (id: string) => {
    const { data, error } = await (supabase as any).rpc('rpc_approve_estimate', {
      p_estimate_id: id,
    });
    if (error) {
      toast({ title: 'Error approving estimate', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Estimate approved', description: 'This estimate is now locked.' });
    await fetchEstimates();
    return true;
  };

  const duplicateEstimate = async (sourceId: string) => {
    const { data, error } = await (supabase as any).rpc('rpc_duplicate_estimate', {
      p_estimate_id: sourceId,
    });
    if (error) {
      toast({ title: 'Error duplicating estimate', description: error.message, variant: 'destructive' });
      return null;
    }
    await fetchEstimates();
    return data;
  };

  const deleteEstimate = async (id: string) => {
    const { error } = await (supabase as any).rpc('rpc_delete_estimate', {
      p_estimate_id: id,
    });
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

  const upsertLineItem = async (estimateId: string, lineItemId: string | null, payload: Record<string, any>) => {
    const { data, error } = await (supabase as any).rpc('rpc_upsert_estimate_line_item', {
      p_estimate_id: estimateId,
      p_line_item_id: lineItemId,
      p_payload: payload,
    });
    if (error) {
      toast({ title: 'Error saving line item', description: error.message, variant: 'destructive' });
      return null;
    }
    return data;
  };

  const deleteLineItem = async (lineItemId: string) => {
    const { error } = await (supabase as any).rpc('rpc_delete_estimate_line_item', {
      p_line_item_id: lineItemId,
    });
    if (error) {
      toast({ title: 'Error deleting line item', description: error.message, variant: 'destructive' });
      return false;
    }
    return true;
  };

  const generateTasksFromEstimate = async (estimateId: string) => {
    const { data, error } = await (supabase as any).rpc('rpc_generate_tasks_from_estimate', {
      p_estimate_id: estimateId,
    });
    if (error) {
      toast({ title: 'Error generating tasks', description: error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: 'Tasks generated', description: `${data?.created_scope_items ?? 0} scope items created, ${data?.skipped_existing ?? 0} skipped.` });
    return data;
  };

  const fetchVariance = async (projId: string): Promise<EstimateVarianceSummary | null> => {
    const { data, error } = await (supabase as any).rpc('estimate_variance_summary', { p_project_id: projId });
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
    updateEstimateHeader,
    approveEstimate,
    duplicateEstimate,
    deleteEstimate,
    fetchLineItems,
    upsertLineItem,
    deleteLineItem,
    generateTasksFromEstimate,
    fetchVariance,
  };
};
