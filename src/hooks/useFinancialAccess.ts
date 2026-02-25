import { useProjectRole } from "@/hooks/useProjectRole";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";

/**
 * Shared access gate for financial pages (Estimates, Change Orders, Invoicing, etc.).
 *
 * - canView: Admin, PM, Foreman, or Accounting
 * - canWrite: Admin or PM only
 *
 * Must resolve (loading = false) before any queries fire.
 */
export function useFinancialAccess() {
  const { isGlobalAdmin, loading: projectRoleLoading } = useProjectRole();
  const { role: orgRole, isLoading: orgRoleLoading } = useOrganizationRole();

  const loading = projectRoleLoading || orgRoleLoading;

  const isAdmin = isGlobalAdmin || orgRole === "admin";
  const isPM = orgRole === "pm";
  const isForeman = orgRole === "foreman";

  const canWrite = isAdmin || isPM;
  const canView = canWrite || isForeman;

  return { canView, canWrite, isAdmin, loading, orgRole };
}
