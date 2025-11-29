import { ReactNode } from "react";
import { useProjectRole, ProjectRole } from "@/hooks/useProjectRole";

interface RoleBasedAccessProps {
  projectId?: string;
  requiredRole?: ProjectRole;
  requiredRoles?: ProjectRole[];
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Component to conditionally render content based on user's project role
 */
export const RoleBasedAccess = ({
  projectId,
  requiredRole,
  requiredRoles,
  fallback = null,
  children,
}: RoleBasedAccessProps) => {
  const { isGlobalAdmin, hasProjectRole, hasAnyProjectRole, loading } = useProjectRole(projectId);

  if (loading) {
    return <>{fallback}</>;
  }

  // Global admin has access to everything
  if (isGlobalAdmin) {
    return <>{children}</>;
  }

  // No project ID means we can't check project-specific roles
  if (!projectId) {
    return <>{fallback}</>;
  }

  // Check if user has required role(s)
  let hasAccess = false;

  if (requiredRole) {
    hasAccess = hasProjectRole(projectId, requiredRole);
  } else if (requiredRoles && requiredRoles.length > 0) {
    hasAccess = hasAnyProjectRole(projectId, requiredRoles);
  } else {
    // No specific role required, just needs to be on the project
    hasAccess = true;
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

interface RoleGateProps {
  projectId?: string;
  canDo: (projectId: string) => boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Component for permission-based rendering using custom permission checks
 */
export const RoleGate = ({
  projectId,
  canDo,
  fallback = null,
  children,
}: RoleGateProps) => {
  const { isGlobalAdmin, loading } = useProjectRole(projectId);

  if (loading) {
    return <>{fallback}</>;
  }

  if (isGlobalAdmin) {
    return <>{children}</>;
  }

  if (!projectId) {
    return <>{fallback}</>;
  }

  const hasPermission = canDo(projectId);
  return hasPermission ? <>{children}</> : <>{fallback}</>;
};
