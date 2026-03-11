import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';

export type CertificationTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

export interface CertificationResult {
  tier: CertificationTier;
  previous_tier: CertificationTier;
  reasons: string[];
  has_profile: boolean;
  scores?: Record<string, number>;
  audit?: {
    has_recent: boolean;
    pass_count: number;
    fail_count: number;
    p0_blockers: number;
  };
  thresholds?: Record<string, string>;
  calculated_at?: string;
}

export function useCertificationTier() {
  const { activeOrganizationId } = useOrganization();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['certification-tier', activeOrganizationId],
    queryFn: async (): Promise<CertificationResult | null> => {
      if (!activeOrganizationId) return null;

      // Read current tier from profile (fast, no recalc)
      const { data: profile, error } = await supabase
        .from('organization_operational_profile')
        .select('certification_tier,certification_updated_at,score_snapshot')
        .eq('organization_id', activeOrganizationId)
        .maybeSingle();

      if (error || !profile) return null;

      return {
        tier: (profile.certification_tier as CertificationTier) || 'none',
        previous_tier: 'none',
        reasons: [],
        has_profile: true,
        scores: profile.score_snapshot as any,
      };
    },
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000,
  });

  const recalculate = useMutation({
    mutationFn: async (): Promise<CertificationResult> => {
      if (!activeOrganizationId) throw new Error('No org');
      const { data, error } = await supabase.rpc('rpc_calculate_certification_tier', {
        p_organization_id: activeOrganizationId,
      });
      if (error) throw error;
      return data as unknown as CertificationResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certification-tier', activeOrganizationId] });
    },
  });

  return {
    tier: data?.tier ?? 'none',
    certification: data,
    isLoading,
    recalculate: recalculate.mutateAsync,
    isRecalculating: recalculate.isPending,
  };
}
