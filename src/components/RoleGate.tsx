import React, { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useRouteAccess } from "@/hooks/useRouteAccess";
import { useDefaultHomeRoute } from "@/hooks/useDefaultHomeRoute";
import { ListPageSkeleton } from "./dashboard/shared/PageSkeletons";

interface RoleGateProps {
  children: ReactNode;
  allowedRoles?: ("admin" | "pm" | "foreman" | "accounting")[];
  requirement?: "canViewExecutive" | "canViewDiagnostics" | "canViewFinancials";
  skeleton?: ReactNode;
}

/**
 * Unified Role Gate component that handles:
 * 1. Role resolution via useRouteAccess
 * 2. Skeleton loading state (no flickers)
 * 3. Redirects for unauthorized users
 * 4. Query gating (only renders children when ready)
 */
export function RoleGate({ 
  children, 
  allowedRoles, 
  requirement, 
  skeleton = <ListPageSkeleton /> 
}: RoleGateProps) {
  const { loading, ...access } = useRouteAccess();
  const { homeRoute } = useDefaultHomeRoute();
  const location = useLocation();

  const isAuthorised = () => {
    if (loading) return false;
    
    // Check specific requirement if provided
    if (requirement && !access[requirement]) return false;
    
    // Check allowed roles if provided
    if (allowedRoles) {
      const hasRole = allowedRoles.some(role => {
        if (role === 'admin') return access.isAdmin;
        if (role === 'pm') return access.isPM;
        if (role === 'foreman') return access.isForeman;
        if (role === 'accounting') return access.isAccounting;
        return false;
      });
      if (!hasRole) return false;
    }
    
    return true;
  };

  const authorised = isAuthorised();

  if (loading) {
    return <>{skeleton}</>;
  }

  if (!authorised) {
    console.warn(`Unauthorized access attempt to ${location.pathname}`);
    return <Navigate to={homeRoute} replace />;
  }

  return <>{children}</>;
}
