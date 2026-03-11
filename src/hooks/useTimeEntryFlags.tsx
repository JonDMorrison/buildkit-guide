import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TimeEntryFlag {
  id: string;
  time_entry_id: string;
  flag_code: string;
  severity: 'info' | 'warning' | 'critical';
  metadata: Record<string, unknown>;
  created_at: string;
  resolved_at: string | null;
}

/**
 * Hook to fetch persisted flags for a specific time entry
 */
export function useTimeEntryFlags(timeEntryId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['time-entry-flags', timeEntryId],
    queryFn: async (): Promise<TimeEntryFlag[]> => {
      if (!timeEntryId) return [];

      const { data, error } = await supabase
        .from('time_entry_flags')
        .select('id,time_entry_id,flag_code,severity,metadata,created_at,resolved_at')
        .eq('time_entry_id', timeEntryId)
        .is('resolved_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching time entry flags:', error);
        throw error;
      }

      return (data || []).map(flag => ({
        id: flag.id,
        time_entry_id: flag.time_entry_id,
        flag_code: flag.flag_code,
        severity: flag.severity as 'info' | 'warning' | 'critical',
        metadata: (flag.metadata as Record<string, unknown>) || {},
        created_at: flag.created_at,
        resolved_at: flag.resolved_at,
      }));
    },
    enabled: !!user?.id && !!timeEntryId,
    staleTime: 30000,
  });
}

/**
 * Hook to fetch all flags for multiple time entries (batch)
 */
export function useTimeEntriesFlags(timeEntryIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['time-entries-flags', timeEntryIds.sort().join(',')],
    queryFn: async (): Promise<Record<string, TimeEntryFlag[]>> => {
      if (timeEntryIds.length === 0) return {};

      const { data, error } = await supabase
        .from('time_entry_flags')
        .select('id,time_entry_id,flag_code,severity,metadata,created_at,resolved_at')
        .in('time_entry_id', timeEntryIds)
        .is('resolved_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching time entries flags:', error);
        throw error;
      }

      // Group by time_entry_id
      const grouped: Record<string, TimeEntryFlag[]> = {};
      for (const flag of data || []) {
        if (!grouped[flag.time_entry_id]) {
          grouped[flag.time_entry_id] = [];
        }
        grouped[flag.time_entry_id].push({
          id: flag.id,
          time_entry_id: flag.time_entry_id,
          flag_code: flag.flag_code,
          severity: flag.severity as 'info' | 'warning' | 'critical',
          metadata: (flag.metadata as Record<string, unknown>) || {},
          created_at: flag.created_at,
          resolved_at: flag.resolved_at,
        });
      }

      return grouped;
    },
    enabled: !!user?.id && timeEntryIds.length > 0,
    staleTime: 30000,
  });
}

/**
 * Map flag codes to UI indicator types (DB-backed)
 */
export type FlagIndicatorType =
  | 'normal'
  | 'manual'
  | 'auto_closed'
  | 'location_unverified'
  | 'offline_sync'
  | 'edited_after_submission'
  | 'gps_accuracy_low'
  | 'missing_job_site'
  | 'long_shift'
  | 'force_checkout'
  | 'flagged';

export function mapFlagCodeToIndicator(flagCode: string): FlagIndicatorType {
  const mapping: Record<string, FlagIndicatorType> = {
    'location_unverified': 'location_unverified',
    'gps_accuracy_low': 'gps_accuracy_low',
    'geofence_not_verified': 'location_unverified',
    'offline_sync': 'offline_sync',
    'manual_time_added': 'manual',
    'auto_closed': 'auto_closed',
    'edited_after_submission': 'edited_after_submission',
    'missing_job_site': 'missing_job_site',
    'long_shift': 'long_shift',
    'force_checkout': 'force_checkout',
    'checkout_location_missing': 'location_unverified',
  };
  
  return mapping[flagCode] || 'flagged';
}

/**
 * Get unique indicator types from a list of flags
 */
export function getIndicatorsFromFlags(flags: TimeEntryFlag[]): FlagIndicatorType[] {
  const indicatorSet = new Set<FlagIndicatorType>();
  
  for (const flag of flags) {
    indicatorSet.add(mapFlagCodeToIndicator(flag.flag_code));
  }
  
  return Array.from(indicatorSet);
}
