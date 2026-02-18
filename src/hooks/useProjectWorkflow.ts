import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface WorkflowRequirement {
  id: string;
  type: string;
  label: string;
  passed: boolean;
  message: string;
}

export interface WorkflowPhase {
  key: string;
  label: string;
  sort_order: number;
  description: string;
  is_approval_required: boolean;
  allowed_requester_roles: string[];
  allowed_approver_roles: string[];
  status: 'not_started' | 'in_progress' | 'blocked' | 'requested' | 'approved';
  requested_by: string | null;
  requested_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  requirements: WorkflowRequirement[];
}

export interface ProjectWorkflowData {
  flow_mode: 'standard' | 'ai_optimized';
  current_phase: string | null;
  phases: WorkflowPhase[];
}

export function useProjectWorkflow(projectId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['project-workflow', projectId],
    queryFn: async (): Promise<ProjectWorkflowData> => {
      const { data, error } = await supabase.rpc('rpc_get_project_workflow', {
        p_project_id: projectId!,
      });
      if (error) throw error;
      return data as unknown as ProjectWorkflowData;
    },
    enabled: !!projectId,
  });

  const setFlowMode = useMutation({
    mutationFn: async (flowMode: 'standard' | 'ai_optimized') => {
      const { data, error } = await supabase.rpc('rpc_set_project_flow_mode', {
        p_project_id: projectId!,
        p_flow_mode: flowMode,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-workflow', projectId] });
      toast({ title: 'Workflow mode updated' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const requestAdvance = useMutation({
    mutationFn: async ({ phaseKey, notes }: { phaseKey: string; notes?: string }) => {
      const { data, error } = await supabase.rpc('rpc_request_phase_advance', {
        p_project_id: projectId!,
        p_phase_key: phaseKey,
        p_notes: notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-workflow', projectId] });
      toast({ title: 'Phase advance requested' });
    },
    onError: (err: any) => {
      toast({ title: 'Cannot advance', description: err.message, variant: 'destructive' });
    },
  });

  const approvePhase = useMutation({
    mutationFn: async ({ phaseKey, approve, message }: { phaseKey: string; approve: boolean; message?: string }) => {
      const { data, error } = await supabase.rpc('rpc_approve_phase', {
        p_project_id: projectId!,
        p_phase_key: phaseKey,
        p_approve: approve,
        p_message: message ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-workflow', projectId] });
      toast({ title: vars.approve ? 'Phase approved' : 'Phase sent back' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return {
    workflow: data ?? null,
    isLoading,
    error,
    setFlowMode,
    requestAdvance,
    approvePhase,
  };
}
