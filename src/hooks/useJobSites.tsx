import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface JobSite {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_meters: number;
  is_active: boolean;
}

export function useJobSites(projectId: string | undefined) {
  return useQuery({
    queryKey: ['job-sites', projectId],
    queryFn: async (): Promise<JobSite[]> => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('job_sites')
        .select('id,name,address,latitude,longitude,geofence_radius_meters,is_active')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });
}
