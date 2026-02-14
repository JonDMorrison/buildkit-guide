import { useMemo } from "react";
import { Home, CheckSquare, Calendar, Users, AlertCircle, Shield, Receipt, Clock, Layers, BarChart3, DollarSign, FileText, TrendingUp } from "lucide-react";
import { useProjectRole } from "@/hooks/useProjectRole";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { useUserRole } from "@/hooks/useUserRole";
import { useTimeTrackingEnabled } from "@/hooks/useTimeTrackingEnabled";

/**
 * Navigation tiers:
 * - Tier 1 (all): Admin, PM, Foreman — All tabs
 * - Tier 2 (office): Accounting/HR — Dashboard, Hours, Job Cost, Invoicing, Receipts
 * - Tier 3 (field): Internal Worker — Tasks, Time, Safety, Receipts
 * - Tier 4 (minimal): External Trade — Tasks, Time, Receipts
 */
type NavTier = 'all' | 'office' | 'field' | 'minimal';

export interface TabConfig {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  tiers: NavTier[];
  requiresTimeTracking?: boolean;
}

export const tabs: TabConfig[] = [
  { name: "Dashboard", path: "/dashboard", icon: Home, tiers: ['all', 'office'] },
  { name: "Tasks", path: "/tasks", icon: CheckSquare, tiers: ['all', 'field', 'minimal'] },
  { name: "Time", path: "/time", icon: Clock, tiers: ['all', 'field', 'minimal'], requiresTimeTracking: true },
  { name: "Hours", path: "/hours-tracking", icon: BarChart3, tiers: ['all', 'office'] },
  { name: "Job Cost", path: "/job-cost-report", icon: DollarSign, tiers: ['all', 'office'] },
  { name: "Invoicing", path: "/invoicing", icon: FileText, tiers: ['all', 'office'] },
  { name: "Estimates", path: "/estimates", icon: FileText, tiers: ['all', 'office'] },
  { name: "Quotes", path: "/quotes", icon: FileText, tiers: ['all', 'office'] },
  { name: "Insights", path: "/insights", icon: TrendingUp, tiers: ['all', 'office'] },
  { name: "Lookahead", path: "/lookahead", icon: Calendar, tiers: ['all'] },
  { name: "Manpower", path: "/manpower", icon: Users, tiers: ['all'] },
  { name: "Drawings", path: "/drawings", icon: Layers, tiers: ['all'] },
  { name: "Deficiencies", path: "/deficiencies", icon: AlertCircle, tiers: ['all'] },
  { name: "Safety", path: "/safety", icon: Shield, tiers: ['all', 'field'] },
  { name: "Receipts", path: "/receipts", icon: Receipt, tiers: ['all', 'office', 'field', 'minimal'] },
];

export const useNavigationTabs = () => {
  const { isGlobalAdmin, projectRoles, loading: roleLoading } = useProjectRole();
  const { role: orgRole, isLoading: orgRoleLoading } = useOrganizationRole();
  const { hasRole, loading: userRoleLoading } = useUserRole();
  const { enabled: timeTrackingEnabled, loading: timeTrackingLoading } = useTimeTrackingEnabled();

  const isLoading = roleLoading || timeTrackingLoading || orgRoleLoading || userRoleLoading;

  const navTier = useMemo((): NavTier => {
    if (isLoading) return 'all';
    if (isGlobalAdmin) return 'all';
    if (hasRole('accounting' as any)) return 'office';
    if (orgRole === 'admin' || orgRole === 'hr') return 'all';
    if (orgRole === 'pm' || orgRole === 'foreman') return 'all';

    const hasManagementRole = projectRoles.some(r =>
      r.role === 'project_manager' || r.role === 'foreman'
    );
    if (hasManagementRole) return 'all';

    const hasInternalWorkerRole = projectRoles.some(r => r.role === 'internal_worker');
    if (hasInternalWorkerRole) return 'field';

    const hasExternalTradeRole = projectRoles.some(r => r.role === 'external_trade');
    if (hasExternalTradeRole) return 'minimal';

    return 'minimal';
  }, [isLoading, isGlobalAdmin, orgRole, projectRoles, hasRole]);

  const visibleTabs = useMemo(() => {
    if (isLoading) return tabs;

    return tabs.filter(tab => {
      if (!tab.tiers.includes(navTier)) return false;
      if (tab.requiresTimeTracking && !timeTrackingEnabled) return false;
      return true;
    });
  }, [navTier, timeTrackingEnabled, isLoading]);

  return { tabs, visibleTabs, isLoading };
};
