import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ActiveTimeEntry {
  id: string;
  check_in_at: string;
  project_id: string;
  project_name: string | null;
  job_site_id: string | null;
  job_site_name: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
  notes: string | null;
  organization_id: string;
}

export function useActiveTimeEntry(projectId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['active-time-entry', user?.id, projectId],
    queryFn: async (): Promise<ActiveTimeEntry | null> => {
      if (!user?.id) return null;

      let query = supabase
        .from('v_time_entries_enriched')
        .select('*')
        .eq('user_id', user.id)
        .is('check_out_at', null)
        .order('check_in_at', { ascending: false })
        .limit(1);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query.single();

      if (error) {
        // No active entry found is not an error
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return {
        id: data.id,
        check_in_at: data.check_in_at,
        project_id: data.project_id,
        project_name: data.project_name,
        job_site_id: data.job_site_id,
        job_site_name: data.job_site_name,
        is_flagged: data.is_flagged,
        flag_reason: data.flag_reason,
        notes: data.notes,
        organization_id: data.organization_id,
      };
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds to keep timer in sync
  });
}
