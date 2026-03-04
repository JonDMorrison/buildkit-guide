import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export interface Project {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'planning' | 'completed';
  total_tasks: number | string;
  completed_tasks: number | string;
  blocked_tasks: number | string;
  organization_id: string;
}

/**
 * Shared hook to fetch projects for the active organization.
 * Canonical query key: ["projects", orgId]
 */
export function useProjects() {
  const { activeOrganizationId } = useOrganization();

  return useQuery({
    queryKey: ["projects", activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return [];

      const { data, error } = await supabase
        .from('v_project_progress')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .order('name');

      if (error) {
        console.error('Error fetching projects:', error);
        throw error;
      }

      return data as Project[];
    },
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
