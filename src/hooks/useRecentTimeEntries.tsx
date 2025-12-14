import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TimeEntry {
  id: string;
  check_in_at: string;
  check_out_at: string | null;
  project_id: string;
  project_name: string | null;
  job_site_id: string | null;
  job_site_name: string | null;
  duration_hours: number | null;
  duration_minutes: number | null;
  status: string;
  is_flagged: boolean;
  flag_reason: string | null;
  closed_method: string | null;
}

export function useRecentTimeEntries(limit = 20) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recent-time-entries', user?.id, limit],
    queryFn: async (): Promise<TimeEntry[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('v_time_entries_enriched')
        .select('*')
        .eq('user_id', user.id)
        .order('check_in_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((entry) => ({
        id: entry.id,
        check_in_at: entry.check_in_at,
        check_out_at: entry.check_out_at,
        project_id: entry.project_id,
        project_name: entry.project_name,
        job_site_id: entry.job_site_id,
        job_site_name: entry.job_site_name,
        duration_hours: entry.duration_hours,
        duration_minutes: entry.duration_minutes,
        status: entry.status,
        is_flagged: entry.is_flagged,
        flag_reason: entry.flag_reason,
        closed_method: entry.closed_method,
      }));
    },
    enabled: !!user?.id,
  });
}
