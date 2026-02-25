import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useDefaultHomeRoute } from "@/hooks/useDefaultHomeRoute";
import { Loader2 } from "lucide-react";

/**
 * Route-level gate for Admin + PM roles.
 * Redirects unauthorized users to their role-appropriate home route
 * and logs a console warning.
 */
export function AdminOrPMRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isPM, loading } = useAuthRole();
  const { homeRoute } = useDefaultHomeRoute();
  const navigate = useNavigate();

  const authorised = isAdmin || isPM();

  useEffect(() => {
    if (!loading && !authorised) {
      console.warn("Unauthorized access attempt — Admin or PM required");
      navigate(homeRoute, { replace: true });
    }
  }, [loading, authorised, navigate, homeRoute]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authorised) return null;

  return <>{children}</>;
}
