import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/hooks/useOrganization';
import { Json } from '@/integrations/supabase/types';

export interface PlaybookSummary {
  id: string;
  name: string;
  job_type: string;
  description: string;
  version: number;
  is_default: boolean;
  is_archived: boolean;
  audience: string;
  trade_id: string | null;
  trade_name: string | null;
  created_at: string;
  updated_at: string;
  phase_count: number;
  task_count: number;
}

export interface PlaybookPhaseTask {
  id: string;
  title: string;
  description: string;
  role_type: string;
  expected_hours_low: number;
  expected_hours_high: number;
  required_flag: boolean;
  allow_skip: boolean;
  density_weight: number;
  sequence_order: number;
}

export interface PlaybookPhase {
  phase: {
    id: string;
    name: string;
    sequence_order: number;
    description: string;
  };
  tasks: PlaybookPhaseTask[];
}

export interface PlaybookDetail {
  playbook: {
    id: string;
    name: string;
    job_type: string;
    description: string;
    version: number;
    is_default: boolean;
    is_archived: boolean;
    organization_id: string;
    created_by: string;
    created_at: string;
    updated_at: string;
  };
  phases: PlaybookPhase[];
}

export interface PlaybookPerformance {
  playbook_id: string;
  projects_using: number;
  total_tasks_generated: number;
  avg_baseline_midpoint: number;
  avg_actual_hours: number;
  variance_percent: number;
  phase_breakdown: {
    phase_name: string;
    baseline_midpoint: number;
    actual_avg: number;
    variance_percent: number;
    task_count: number;
  }[];
}

export function usePlaybookList() {
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id;

  return useQuery({
    queryKey: ['playbooks-list', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'rpc_list_playbooks_by_org',
        { p_organization_id: orgId! }
      );
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as unknown as PlaybookSummary[];
    },
    enabled: !!orgId,
  });
}

export function usePlaybookDetail(playbookId?: string | null) {
  return useQuery({
    queryKey: ['playbook-detail', playbookId],
    queryFn: async () => {
      if (!playbookId) return null;
      // Use the snapshot helper via a direct query
      const { data, error } = await supabase
        .from('playbooks')
        .select('*')
        .eq('id', playbookId)
        .single();
      if (error) throw error;

      const { data: phases } = await supabase
        .from('playbook_phases')
        .select('*')
        .eq('playbook_id', playbookId)
        .order('sequence_order');

      const phaseIds = (phases ?? []).map(p => p.id);
      const { data: tasks } = await supabase
        .from('playbook_tasks')
        .select('*')
        .in('playbook_phase_id', phaseIds.length > 0 ? phaseIds : ['__none__'])
        .order('sequence_order');

      const detail: PlaybookDetail = {
        playbook: data as unknown as PlaybookDetail['playbook'],
        phases: (phases ?? []).map(p => ({
          phase: p as unknown as PlaybookPhase['phase'],
          tasks: (tasks ?? []).filter((t) => (t as any).playbook_phase_id === p.id) as PlaybookPhaseTask[],
        })),
      };
      return detail;
    },
    enabled: !!playbookId,
  });
}

export function usePlaybookPerformance(playbookId?: string | null) {
  return useQuery({
    queryKey: ['playbook-performance', playbookId],
    queryFn: async () => {
      if (!playbookId) return null;
      const { data, error } = await supabase.rpc(
        'rpc_get_playbook_performance',
        { p_playbook_id: playbookId! }
      );
      if (error) throw error;
      return data as unknown as PlaybookPerformance;
    },
    enabled: !!playbookId,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlaybookPerformanceBatch(playbookIds: string[]) {
  return useQuery({
    queryKey: ['playbook-performance-batch', playbookIds.slice().sort().join(',')],
    queryFn: async () => {
      if (playbookIds.length === 0) return {};
      const results = await Promise.all(
        playbookIds.map(async id => {
          const { data } = await supabase.rpc('rpc_get_playbook_performance', { p_playbook_id: id });
          return { id, perf: data as PlaybookPerformance | null };
        })
      );
      return Object.fromEntries(results.map(r => [r.id, r.perf])) as Record<string, PlaybookPerformance | null>;
    },
    enabled: playbookIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlaybookMutations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['playbooks-list'] });
    queryClient.invalidateQueries({ queryKey: ['playbook-detail'] });
  };

  const createPlaybook = useMutation({
    mutationFn: async (args: { name: string; job_type?: string; description?: string; phases?: Json[]; audience?: string; trade_id?: string | null }) => {
      const { data, error } = await supabase.rpc('rpc_create_playbook', {
        p_organization_id: activeOrganization!.id,
        p_name: args.name,
        p_job_type: args.job_type ?? '',
        p_description: args.description ?? '',
        p_phases: args.phases ?? [],
        p_audience: args.audience ?? 'office',
        p_trade_id: args.trade_id ?? null,
      });
      if (error) throw error;
      return data as { playbook: { id: string } };
    },
    onSuccess: () => { invalidate(); toast({ title: 'Playbook created' }); },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updatePlaybook = useMutation({
    mutationFn: async (args: { playbook_id: string; name?: string; job_type?: string; description?: string; is_default?: boolean; phases?: Json[] }) => {
      const { data, error } = await supabase.rpc('rpc_update_playbook', {
        p_playbook_id: args.playbook_id,
        p_name: args.name ?? null,
        p_job_type: args.job_type ?? null,
        p_description: args.description ?? null,
        p_is_default: args.is_default ?? null,
        p_phases: args.phases ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast({ title: 'Playbook updated (new version)' }); },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const duplicatePlaybook = useMutation({
    mutationFn: async (args: { playbook_id: string; new_name?: string }) => {
      const { data, error } = await supabase.rpc('rpc_duplicate_playbook', {
        p_playbook_id: args.playbook_id,
        p_new_name: args.new_name ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast({ title: 'Playbook duplicated' }); },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const archivePlaybook = useMutation({
    mutationFn: async (playbookId: string) => {
      const { data, error } = await supabase.rpc('rpc_archive_playbook', {
        p_playbook_id: playbookId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast({ title: 'Playbook archived' }); },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return { createPlaybook, updatePlaybook, duplicatePlaybook, archivePlaybook };
}
