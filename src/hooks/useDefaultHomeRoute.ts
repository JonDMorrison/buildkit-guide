import { useMemo } from 'react';
import { useUserRole } from './useUserRole';
import { useProjectRole } from './useProjectRole';
import { useOrganizationRole } from './useOrganizationRole';
import { getDefaultHomeRoute } from '@/utils/getDefaultHomeRoute';

/**
 * Returns the role-appropriate default home route for the current user.
 * See getDefaultHomeRoute for the full mapping.
 */
export function useDefaultHomeRoute(): { homeRoute: string; loading: boolean } {
  const { roles: globalRoles, isAdmin, loading: userRoleLoading } = useUserRole();
  const { projectRoles, isGlobalAdmin, loading: projectRoleLoading } = useProjectRole();
  const { role: orgRole, isLoading: orgRoleLoading } = useOrganizationRole();

  const loading = userRoleLoading || projectRoleLoading || orgRoleLoading;

  const homeRoute = useMemo(() => {
    if (loading) return '/dashboard'; // safe fallback while loading
    return getDefaultHomeRoute({
      isAdmin: isAdmin || isGlobalAdmin,
      orgRole,
      globalRoles: globalRoles as string[],
      projectRoles,
    });
  }, [loading, isAdmin, isGlobalAdmin, orgRole, globalRoles, projectRoles]);

  return { homeRoute, loading };
}
