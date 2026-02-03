import { useAuth } from './useAuth';
import { useUserRole } from './useUserRole';
import { useProjectRole, ProjectRole } from './useProjectRole';

/**
 * Unified hook combining global roles and project-specific roles
 * Use this as the primary permission check hook across the app
 */
export const useAuthRole = (projectId?: string) => {
  const { user } = useAuth();
  const { roles: globalRoles, isAdmin: isGlobalAdmin } = useUserRole();
  const {
    projectRoles,
    isGlobalAdmin: isGlobalAdminFromProject,
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
    loading: projectRolesLoading,
  } = useProjectRole(projectId);

  const loading = projectRolesLoading;

  // Check if user is admin (global or project-level doesn't matter for most checks)
  const isAdmin = isGlobalAdmin || isGlobalAdminFromProject;

  // Get role for specific project
  const currentProjectRole = projectId ? getRoleForProject(projectId) : null;

  // Role check helpers for current project
  const isPM = (pid?: string) => {
    const targetProject = pid || projectId;
    return targetProject ? hasProjectRole(targetProject, 'project_manager') : false;
  };

  const isForeman = (pid?: string) => {
    const targetProject = pid || projectId;
    return targetProject ? hasProjectRole(targetProject, 'foreman') : false;
  };

  const isInternalWorker = (pid?: string) => {
    const targetProject = pid || projectId;
    return targetProject ? hasProjectRole(targetProject, 'internal_worker') : false;
  };

  const isExternalTrade = (pid?: string) => {
    const targetProject = pid || projectId;
    return targetProject ? hasProjectRole(targetProject, 'external_trade') : false;
  };

  const isWorker = (pid?: string) => {
    const targetProject = pid || projectId;
    return targetProject ? isWorkerRole(targetProject) : false;
  };

  // Permission helpers - all require project context
  const can = (permission: string, pid?: string): boolean => {
    // Some permissions are org/global-scoped and should not depend on a selected project.
    // (QuickAdd: creating a new project is allowed for Admins and PMs even if the
    // currently selected project is one they don't manage.)
    if (permission === 'create_projects') {
      const targetProject = pid || projectId;
      return (
        isAdmin ||
        globalRoles.includes('project_manager') ||
        (!!targetProject && isPM(targetProject))
      );
    }

    const targetProject = pid || projectId;
    if (!targetProject) return false;
    if (isAdmin) return true;

    switch (permission) {
      // Task permissions
      case 'create_tasks':
        return canCreateTasks(targetProject);
      case 'edit_tasks':
        return canCreateTasks(targetProject); // PM + Foreman
      case 'delete_tasks':
        return isAdmin || isPM(targetProject);
      case 'view_all_tasks':
        return canViewAllTasks(targetProject);
      case 'edit_task_dates':
        return isPM(targetProject) || isForeman(targetProject);
      case 'edit_task_dependencies':
        return isPM(targetProject) || isForeman(targetProject);
      case 'assign_tasks':
        return isPM(targetProject) || isForeman(targetProject);

      // Blocker permissions
      case 'mark_blocked':
        return canMarkBlockers(targetProject);
      case 'clear_blockers':
        return canClearBlockers(targetProject);

      // Deficiency permissions
      case 'create_deficiencies':
        return isPM(targetProject) || isForeman(targetProject);
      case 'edit_deficiencies':
        return isPM(targetProject);
      case 'delete_deficiencies':
        return isPM(targetProject);

      // Safety permissions
      case 'view_safety':
        return isPM(targetProject) || isForeman(targetProject);
      case 'create_safety':
        return canSubmitSafety(targetProject);
      case 'edit_safety':
        return canSubmitSafety(targetProject);
      case 'submit_safety':
        return canSubmitSafety(targetProject);

      // Manpower permissions
      case 'request_manpower':
        return canRequestManpower(targetProject);
      case 'approve_manpower':
        return canApproveManpower(targetProject);

      // Document permissions
      case 'upload_documents':
        return isPM(targetProject) || isForeman(targetProject);
      case 'delete_documents':
        return isAdmin || isPM(targetProject);

      // Project permissions
      case 'manage_project':
        return canManageProject(targetProject);
      case 'edit_project':
        return canManageProject(targetProject);
      case 'view_lookahead':
        return isPM(targetProject) || isForeman(targetProject);
      case 'edit_lookahead':
        return isPM(targetProject) || isForeman(targetProject);

      default:
        return false;
    }
  };

  return {
    user,
    loading,
    
    // Role identifiers
    isAdmin,
    currentProjectRole,
    globalRoles,
    projectRoles,
    
    // Role checkers
    isPM,
    isForeman,
    isInternalWorker,
    isExternalTrade,
    isWorker,
    
    // Navigation helpers
    shouldShowLimitedNav,
    
    // Permission checker
    can,
    
    // Direct permission helpers (for convenience)
    canManageProject,
    canCreateTasks,
    canMarkBlockers,
    canClearBlockers,
    canSubmitSafety,
    canApproveManpower,
    canRequestManpower,
    canViewAllTasks,
  };
};

/**
 * Simplified permission hook - uses can() helper
 */
export const useCan = (permission: string, projectId?: string) => {
  const { can, loading } = useAuthRole(projectId);
  return { can: can(permission, projectId), loading };
};
