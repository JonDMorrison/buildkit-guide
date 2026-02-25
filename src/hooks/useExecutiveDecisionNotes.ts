import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DecisionNote {
  id: string;
  organization_id: string;
  created_by: string;
  created_at: string;
  as_of: string;
  template_type: 'weekly' | 'project' | 'risk';
  top3_projects: string[];
  body: string;
  source: string;
  project_id: string | null;
}

export interface InsertDecisionNote {
  organization_id: string;
  created_by: string;
  as_of: string;
  template_type: 'weekly' | 'project' | 'risk';
  top3_projects: string[];
  body: string;
  source?: string;
  client_hash?: string;
}

// ── Canonical key ──────────────────────────────────────────────────────────

export const DECISION_NOTES_QUERY_KEY = 'executive-decision-notes';

// ── Hook ───────────────────────────────────────────────────────────────────

export function useExecutiveDecisionNotes(orgId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [DECISION_NOTES_QUERY_KEY, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('executive_decision_notes')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as DecisionNote[];
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  const insertMutation = useMutation({
    mutationFn: async (note: InsertDecisionNote) => {
      const { data, error } = await supabase
        .from('executive_decision_notes')
        .insert(note)
        .select()
        .single();
      // Treat unique constraint violation (duplicate client_hash) as success
      if (error && error.code === '23505') return null;
      if (error) throw error;
      return data as DecisionNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DECISION_NOTES_QUERY_KEY, orgId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('executive_decision_notes')
        .delete()
        .eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DECISION_NOTES_QUERY_KEY, orgId] });
    },
  });

  return {
    notes: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    insertNote: insertMutation.mutateAsync,
    deleteNote: deleteMutation.mutateAsync,
    isInserting: insertMutation.isPending,
  };
}
