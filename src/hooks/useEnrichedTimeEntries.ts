import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';

/**
 * Enriched time entry from v_time_entries_status view
 * All badge indicators are derived from persisted flags
 */
export interface EnrichedTimeEntry {
  id: string;
  organization_id: string;
  user_id: string;
  project_id: string;
  job_site_id: string | null;
  check_in_at: string;
  check_out_at: string | null;
  duration_minutes: number | null;
  duration_hours: number | null;
  status: string;
  closed_method: string;
  source: string;
  is_flagged: boolean;
  flag_reason: string | null;
  notes: string | null;
  project_timezone: string;
  created_at: string;
  
  // From view joins
  project_name: string | null;
  job_site_name: string | null;
  user_name: string | null;
  user_email: string | null;
  
  // Aggregated flags from time_entry_flags
  flags: string[];
  max_severity: 'info' | 'warning' | 'critical' | null;
  
  // Boolean badge indicators (derived from persisted flags)
  has_manual: boolean;
  has_auto_closed: boolean;
  has_location_unverified: boolean;
  has_offline: boolean;
  has_gps_accuracy_low: boolean;
  has_missing_job_site: boolean;
  has_edited_after_submission: boolean;
  has_long_shift: boolean;
  flag_count: number;
  
  // Derived (not persisted)
  is_stale: boolean;
}

interface UseEnrichedTimeEntriesOptions {
  projectId?: string;
  limit?: number;
}

/**
 * Hook to fetch enriched time entries with all badge indicators
 * Uses v_time_entries_status view for DB-backed badge derivation
 */
export function useEnrichedTimeEntries(options: UseEnrichedTimeEntriesOptions = {}) {
  const { user } = useAuth();
  const { activeOrganization } = useOrganization();
  const { projectId, limit = 50 } = options;

  return useQuery({
    queryKey: ['enriched-time-entries', activeOrganization?.id, user?.id, projectId, limit],
    queryFn: async (): Promise<EnrichedTimeEntry[]> => {
      if (!activeOrganization?.id || !user?.id) return [];

      // Query the enriched view
      let query = supabase
        .from('v_time_entries_status')
        .select('*')
        .eq('organization_id', activeOrganization.id)
        .eq('user_id', user.id)
        .order('check_in_at', { ascending: false })
        .limit(limit);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching enriched time entries:', error);
        throw error;
      }

      return (data || []).map((entry) => ({
        id: entry.id,
        organization_id: entry.organization_id,
        user_id: entry.user_id,
        project_id: entry.project_id,
        job_site_id: entry.job_site_id,
        check_in_at: entry.check_in_at,
        check_out_at: entry.check_out_at,
        duration_minutes: entry.duration_minutes,
        duration_hours: entry.duration_hours,
        status: entry.status,
        closed_method: entry.closed_method,
        source: entry.source,
        is_flagged: entry.is_flagged,
        flag_reason: entry.flag_reason,
        notes: entry.notes,
        project_timezone: entry.project_timezone,
        created_at: entry.created_at,
        project_name: entry.project_name,
        job_site_name: entry.job_site_name,
        user_name: entry.user_name,
        user_email: entry.user_email,
        flags: entry.flags || [],
        max_severity: entry.max_severity as 'info' | 'warning' | 'critical' | null,
        has_manual: entry.has_manual || false,
        has_auto_closed: entry.has_auto_closed || false,
        has_location_unverified: entry.has_location_unverified || false,
        has_offline: entry.has_offline || false,
        has_gps_accuracy_low: entry.has_gps_accuracy_low || false,
        has_missing_job_site: entry.has_missing_job_site || false,
        has_edited_after_submission: entry.has_edited_after_submission || false,
        has_long_shift: entry.has_long_shift || false,
        flag_count: entry.flag_count || 0,
        is_stale: entry.is_stale || false,
      }));
    },
    enabled: !!activeOrganization?.id && !!user?.id,
    staleTime: 30000,
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Hook to fetch a single enriched time entry
 */
export function useEnrichedTimeEntry(entryId: string | null) {
  const { user } = useAuth();
  const { activeOrganization } = useOrganization();

  return useQuery({
    queryKey: ['enriched-time-entry', entryId],
    queryFn: async (): Promise<EnrichedTimeEntry | null> => {
      if (!entryId || !activeOrganization?.id) return null;

      const { data, error } = await supabase
        .from('v_time_entries_status')
        .select('*')
        .eq('id', entryId)
        .eq('organization_id', activeOrganization.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        console.error('Error fetching enriched time entry:', error);
        throw error;
      }

      if (!data) return null;

      return {
        id: data.id,
        organization_id: data.organization_id,
        user_id: data.user_id,
        project_id: data.project_id,
        job_site_id: data.job_site_id,
        check_in_at: data.check_in_at,
        check_out_at: data.check_out_at,
        duration_minutes: data.duration_minutes,
        duration_hours: data.duration_hours,
        status: data.status,
        closed_method: data.closed_method,
        source: data.source,
        is_flagged: data.is_flagged,
        flag_reason: data.flag_reason,
        notes: data.notes,
        project_timezone: data.project_timezone,
        created_at: data.created_at,
        project_name: data.project_name,
        job_site_name: data.job_site_name,
        user_name: data.user_name,
        user_email: data.user_email,
        flags: data.flags || [],
        max_severity: data.max_severity as 'info' | 'warning' | 'critical' | null,
        has_manual: data.has_manual || false,
        has_auto_closed: data.has_auto_closed || false,
        has_location_unverified: data.has_location_unverified || false,
        has_offline: data.has_offline || false,
        has_gps_accuracy_low: data.has_gps_accuracy_low || false,
        has_missing_job_site: data.has_missing_job_site || false,
        has_edited_after_submission: data.has_edited_after_submission || false,
        has_long_shift: data.has_long_shift || false,
        flag_count: data.flag_count || 0,
        is_stale: data.is_stale || false,
      };
    },
    enabled: !!entryId && !!activeOrganization?.id && !!user?.id,
    staleTime: 30000,
  });
}
