import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type UserRole = 'admin' | 'project_manager' | 'foreman' | 'internal_worker' | 'external_trade';

export const useUserRole = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    const fetchRoles = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (!error && data) {
        setRoles(data.map(r => r.role as UserRole));
      }
      setLoading(false);
    };

    fetchRoles();
  }, [user]);

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