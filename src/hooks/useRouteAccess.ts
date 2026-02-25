import { useMemo } from 'react';
import { useUserRole } from './useUserRole';
import { useProjectRole } from './useProjectRole';
import { useOrganizationRole } from './useOrganizationRole';

/**
 * Unified route-access hook reconciling all role sources.
 * Use this as the single source of truth for page/route gates.
 */
export function useRouteAccess() {
  const { isAdmin: isGlobalAdmin, hasRole, loading: userRoleLoading } = useUserRole();
  const { isGlobalAdmin: isProjectGlobalAdmin, projectRoles, loading: projectRoleLoading } = useProjectRole();
  const { role: orgRole, isLoading: orgRoleLoading, isAdmin: isOrgAdmin, isHR, isPM: isOrgPM, isForeman: isOrgForeman } = useOrganizationRole();

  const loading = userRoleLoading || projectRoleLoading || orgRoleLoading;

  const derived = useMemo(() => {
    const isAdmin = isGlobalAdmin || isProjectGlobalAdmin || isOrgAdmin;

    const isPM = isOrgPM || projectRoles.some(r => r.role === 'project_manager');
    const isForeman = isOrgForeman || projectRoles.some(r => r.role === 'foreman');
    const isAccounting = hasRole('accounting' as any);
    const isHRRole = isHR;

    const canViewFinancials = isAdmin || isPM || isForeman || isAccounting;
    const canWriteFinancials = isAdmin || isPM;
    const canViewExecutive = isAdmin || isPM;
    const canViewDiagnostics = isAdmin;

    return {
      isAdmin,
      isPM,
      isForeman,
      isAccounting,
      isHR: isHRRole,
      canViewFinancials,
      canWriteFinancials,
      canViewExecutive,
      canViewDiagnostics,
    };
  }, [isGlobalAdmin, isProjectGlobalAdmin, isOrgAdmin, isOrgPM, isOrgForeman, isHR, projectRoles, hasRole]);

  return { loading, ...derived };
}
