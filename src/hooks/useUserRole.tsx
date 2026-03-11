import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQuery } from '@tanstack/react-query';

type UserRole = 'admin' | 'project_manager' | 'foreman' | 'internal_worker' | 'external_trade' | 'accounting';

export const useUserRole = () => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id);

      if (error) throw error;
      return (data || []).map(r => r.role as UserRole);
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const loading = query.isLoading && !!user;
  const roles = query.data || [];

  const hasRole = (role: UserRole) => roles.includes(role);
  const isAdmin = hasRole('admin');
  const canManageProjects = isAdmin || hasRole('project_manager');
  const canCreateTasks = isAdmin || hasRole('project_manager') || hasRole('foreman');
  const canMarkBlockers = isAdmin || hasRole('project_manager') || hasRole('foreman');
  const canSubmitSafety = isAdmin || hasRole('project_manager') || hasRole('foreman');
  const canApproveManpower = isAdmin || hasRole('project_manager');
  const canRequestManpower = isAdmin || hasRole('project_manager') || hasRole('foreman');

  return {
    roles,
    loading,
    hasRole,
    isAdmin,
    canManageProjects,
    canCreateTasks,
    canMarkBlockers,
    canSubmitSafety,
    canApproveManpower,
    canRequestManpower,
  };
};