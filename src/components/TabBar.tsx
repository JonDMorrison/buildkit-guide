import { useMemo } from "react";
import { NavLink } from "./NavLink";
import { Home, CheckSquare, Calendar, Users, AlertCircle, Shield, Receipt, Clock, Layers, BarChart3, DollarSign, FileText } from "lucide-react";
import { useProjectRole } from "@/hooks/useProjectRole";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { useUserRole } from "@/hooks/useUserRole";
import { useTimeTrackingEnabled } from "@/hooks/useTimeTrackingEnabled";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Navigation tiers:
 * - Tier 1 (all): Admin, PM, Foreman — All tabs
 * - Tier 2 (office): Accounting/HR — Dashboard, Hours, Job Cost, Invoicing, Receipts
 * - Tier 3 (field): Internal Worker — Tasks, Time, Safety, Receipts
 * - Tier 4 (minimal): External Trade — Tasks, Time, Receipts
 */
type NavTier = 'all' | 'office' | 'field' | 'minimal';

interface TabConfig {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  tiers: NavTier[];
  requiresTimeTracking?: boolean;
}

const tabs: TabConfig[] = [
  { name: "Dashboard", path: "/dashboard", icon: Home, tiers: ['all', 'office'] },
  { name: "Tasks", path: "/tasks", icon: CheckSquare, tiers: ['all', 'field', 'minimal'] },
  { name: "Time", path: "/time", icon: Clock, tiers: ['all', 'field', 'minimal'], requiresTimeTracking: true },
  { name: "Hours", path: "/hours-tracking", icon: BarChart3, tiers: ['all', 'office'] },
  { name: "Job Cost", path: "/job-cost-report", icon: DollarSign, tiers: ['all', 'office'] },
  { name: "Invoicing", path: "/invoicing", icon: FileText, tiers: ['all', 'office'] },
  { name: "Lookahead", path: "/lookahead", icon: Calendar, tiers: ['all'] },
  { name: "Manpower", path: "/manpower", icon: Users, tiers: ['all'] },
  { name: "Drawings", path: "/drawings", icon: Layers, tiers: ['all'] },
  { name: "Deficiencies", path: "/deficiencies", icon: AlertCircle, tiers: ['all'] },
  { name: "Safety", path: "/safety", icon: Shield, tiers: ['all', 'field'] },
  { name: "Receipts", path: "/receipts", icon: Receipt, tiers: ['all', 'office', 'field', 'minimal'] },
];

export const TabBar = () => {
  const { isGlobalAdmin, projectRoles, loading: roleLoading } = useProjectRole();
  const { role: orgRole, isLoading: orgRoleLoading } = useOrganizationRole();
  const { hasRole, loading: userRoleLoading } = useUserRole();
  const { enabled: timeTrackingEnabled, loading: timeTrackingLoading } = useTimeTrackingEnabled();

  const isLoading = roleLoading || timeTrackingLoading || orgRoleLoading || userRoleLoading;

  // Determine the user's navigation tier
  const navTier = useMemo((): NavTier => {
    if (isLoading) return 'all';

    // Admin always sees everything
    if (isGlobalAdmin) return 'all';

    // Check for accounting role (global user_roles table)
    if (hasRole('accounting' as any)) return 'office';

    // Check org role
    if (orgRole === 'admin' || orgRole === 'hr') return 'all';
    if (orgRole === 'pm' || orgRole === 'foreman') return 'all';

    // Check project-level roles
    const hasManagementRole = projectRoles.some(r =>
      r.role === 'project_manager' || r.role === 'foreman'
    );
    if (hasManagementRole) return 'all';

    const hasInternalWorkerRole = projectRoles.some(r => r.role === 'internal_worker');
    if (hasInternalWorkerRole) return 'field';

    const hasExternalTradeRole = projectRoles.some(r => r.role === 'external_trade');
    if (hasExternalTradeRole) return 'minimal';

    // No recognized role — show minimal as safe default
    return 'minimal';
  }, [isLoading, isGlobalAdmin, orgRole, projectRoles, hasRole]);

  // Filter tabs based on tier
  const visibleTabs = useMemo(() => {
    if (isLoading) return tabs;

    return tabs.filter(tab => {
      if (!tab.tiers.includes(navTier)) return false;
      if (tab.requiresTimeTracking && !timeTrackingEnabled) return false;
      return true;
    });
  }, [navTier, timeTrackingEnabled, isLoading]);

  if (isLoading) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 h-tab-bar bg-card border-t border-border overflow-x-auto">
        <div className="flex items-center h-full px-2 min-w-max">
          {tabs.map((tab) => (
            <div key={tab.path} className="flex flex-col items-center justify-center gap-1 flex-1 min-w-[80px] h-full px-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 h-tab-bar bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center h-full w-full overflow-x-auto scrollbar-hide">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] flex-shrink-0 h-full text-muted-foreground transition-colors duration-200 px-1 relative"
              activeClassName="text-primary [&>svg]:scale-110"
              aria-current={undefined}
            >
              <Icon className="h-5 w-5 transition-transform duration-200" />
              <span className="text-[10px] font-medium whitespace-nowrap">{tab.name}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
