import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';

export type OrgRole = 'admin' | 'hr' | 'pm' | 'foreman' | 'internal_worker' | 'external_trade';

export function useOrganizationRole() {
  const { user } = useAuth();
  const { activeOrganization } = useOrganization();

  const query = useQuery({
    queryKey: ['organization-role', user?.id, activeOrganization?.id],
    queryFn: async (): Promise<OrgRole | null> => {
      const { data, error } = await supabase
        .from('organization_memberships')
        .select('role')
        .eq('user_id', user!.id)
        .eq('organization_id', activeOrganization!.id)
        .eq('is_active', true)
        .single();

      if (error) return null;
      return data?.role as OrgRole;
    },
    enabled: !!user?.id && !!activeOrganization?.id,
  });

  const isLoading = query.isLoading && !!user?.id && !!activeOrganization?.id;
  const role = query.data;

  const isAdmin = role === 'admin';
  const isHR = role === 'hr';
  const isPM = role === 'pm';
  const isForeman = role === 'foreman';
  const isInternalWorker = role === 'internal_worker';
  const isExternalTrade = role === 'external_trade';

  // Permission helpers for time tracking
  const canApproveTimesheets = isAdmin || isHR || isPM || isForeman;
  const canLockPeriods = isAdmin || isHR;
  const canReviewRequests = isAdmin || isHR || isPM || isForeman;
  const canViewAllTimeEntries = isAdmin || isHR || isPM || isForeman;

  return {
    role,
    isLoading,
    isAdmin,
    isHR,
    isPM,
    isForeman,
    isInternalWorker,
    isExternalTrade,
    canApproveTimesheets,
    canLockPeriods,
    canReviewRequests,
    canViewAllTimeEntries,
  };
}
