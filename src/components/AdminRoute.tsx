import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { useDefaultHomeRoute } from "@/hooks/useDefaultHomeRoute";
import { Loader2 } from "lucide-react";

/**
 * Route-level admin gate.
 * Checks both user_roles AND organization_memberships for admin status.
 * Redirects non-admin users to their role-appropriate home route.
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin: isGlobalAdmin, loading: globalLoading } = useUserRole();
  const { isAdmin: isOrgAdmin, isLoading: orgLoading } = useOrganizationRole();
  const { homeRoute } = useDefaultHomeRoute();
  const navigate = useNavigate();

  const loading = globalLoading || orgLoading;
  const isAdmin = isGlobalAdmin || isOrgAdmin;

  useEffect(() => {
    if (!loading && !isAdmin) {
      console.warn("Unauthorized diagnostics access attempt");
      navigate(homeRoute, { replace: true });
    }
  }, [loading, isAdmin, navigate, homeRoute]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return <>{children}</>;
}
