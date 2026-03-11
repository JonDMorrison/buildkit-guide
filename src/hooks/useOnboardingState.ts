import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface OnboardingState {
  onboarding_step: number | null;
  onboarding_org_id: string | null;
  onboarding_project_id: string | null;
  has_onboarded: boolean;
}

/**
 * Hook to persist and rehydrate wizard state from profiles table.
 * Single source of truth for onboarding resume logic.
 */
export function useOnboardingState() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-state', user?.id],
    queryFn: async (): Promise<OnboardingState> => {
      if (!user) throw new Error('No user');
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_step,onboarding_org_id,onboarding_project_id,has_onboarded')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return {
        onboarding_step: profile.onboarding_step,
        onboarding_org_id: profile.onboarding_org_id,
        onboarding_project_id: profile.onboarding_project_id,
        has_onboarded: profile.has_onboarded,
      };
    },
    enabled: !!user,
    staleTime: 0, // Always refetch on mount for freshest state
    refetchOnWindowFocus: false,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Pick<OnboardingState, 'onboarding_step' | 'onboarding_org_id' | 'onboarding_project_id' | 'has_onboarded'>>) => {
      if (!user) throw new Error('No user');
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-state', user?.id] });
    },
  });

  return {
    state: data ?? null,
    isLoading,
    updateState: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
