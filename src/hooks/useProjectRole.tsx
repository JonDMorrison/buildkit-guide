import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQuery } from '@tanstack/react-query';

export type ProjectRole = 'admin' | 'project_manager' | 'foreman' | 'internal_worker' | 'external_trade';

interface ProjectRoleInfo {
  projectId: string;
  role: ProjectRole;
  tradeId: string | null;
}

export const useProjectRole = (projectId?: string) => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['project-roles', user?.id, projectId],
    queryFn: async () => {
      // Check if user is global admin and get project roles in parallel
      const [adminRes, projectRes] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user!.id)
          .eq('role', 'admin')
          .maybeSingle(),
        (() => {
          let q = supabase
            .from('project_members')
            .select('project_id,role,trade_id')
            .eq('user_id', user!.id);
          if (projectId) {
            q = q.eq('project_id', projectId);
          }
          return q;
        })()
      ]);

      return {
        isGlobalAdmin: !!adminRes.data,
        roles: (projectRes.data || []).map(r => ({
          projectId: r.project_id,
          role: r.role as ProjectRole,
          tradeId: r.trade_id,
        })) as ProjectRoleInfo[]
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const loading = query.isLoading && !!user;
  const data = query.data;

  const projectRoles = data?.roles || [];
  const isGlobalAdmin = data?.isGlobalAdmin || false;

  const getRoleForProject = (pid: string): ProjectRole | null => {
    if (isGlobalAdmin) return 'admin';
    const match = projectRoles.find(r => r.projectId === pid);
    return match ? match.role : null;
  };

  const hasProjectRole = (pid: string, role: ProjectRole): boolean => {
    if (isGlobalAdmin) return true;
    const userRole = getRoleForProject(pid);
    return userRole === role;
  };

  const hasAnyProjectRole = (pid: string, roles: ProjectRole[]): boolean => {
    if (isGlobalAdmin) return true;
    const userRole = getRoleForProject(pid);
    return userRole ? roles.includes(userRole) : false;
  };

  const canManageProject = (pid: string) => {
    return isGlobalAdmin || hasProjectRole(pid, 'project_manager');
  };

  const canCreateTasks = (pid: string) => {
    return isGlobalAdmin || hasAnyProjectRole(pid, ['project_manager', 'foreman']);
  };

  const canMarkBlockers = (pid: string) => {
    return isGlobalAdmin || hasAnyProjectRole(pid, ['project_manager', 'foreman']);
  };

  const canClearBlockers = (pid: string) => {
    return isGlobalAdmin || hasProjectRole(pid, 'project_manager');
  };

  const canSubmitSafety = (pid: string) => {
    return isGlobalAdmin || hasAnyProjectRole(pid, ['project_manager', 'foreman']);
  };

  const canApproveManpower = (pid: string) => {
    return isGlobalAdmin || hasProjectRole(pid, 'project_manager');
  };

  const canRequestManpower = (pid: string) => {
    return isGlobalAdmin || hasAnyProjectRole(pid, ['project_manager', 'foreman']);
  };

  const canViewAllTasks = (pid: string) => {
    return isGlobalAdmin || hasAnyProjectRole(pid, ['project_manager', 'foreman']);
  };

  const isWorkerRole = (pid: string) => {
    const role = getRoleForProject(pid);
    return role === 'internal_worker' || role === 'external_trade';
  };

  // For navigation: workers should only see Tasks and AI
  const shouldShowLimitedNav = () => {
    if (isGlobalAdmin) return false;
    // If user has ANY project where they're PM or Foreman, show full nav
    const hasManagementRole = projectRoles.some(r => 
      r.role === 'project_manager' || r.role === 'foreman'
    );
    return !hasManagementRole;
  };

  return {
    projectRoles,
    loading,
    isGlobalAdmin,
    getRoleForProject,
    hasProjectRole,
    hasAnyProjectRole,
    canManageProject,
    canCreateTasks,
    canMarkBlockers,
    canClearBlockers,
    canSubmitSafety,
    canApproveManpower,
    canRequestManpower,
    canViewAllTasks,
    isWorkerRole,
    shouldShowLimitedNav,
  };
};
