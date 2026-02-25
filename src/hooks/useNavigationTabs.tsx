import { useMemo } from "react";
import { Home, CheckSquare, Calendar, Users, AlertCircle, Shield, Receipt, Clock, Layers, BarChart3, DollarSign, FileText, TrendingUp, Workflow, Settings, Brain, FileDiff, Rocket, BookOpen, Crown, Cpu } from "lucide-react";
import { useProjectRole } from "@/hooks/useProjectRole";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { useUserRole } from "@/hooks/useUserRole";
import { useTimeTrackingEnabled } from "@/hooks/useTimeTrackingEnabled";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/useCurrentProject";

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
  requiresWorkflow?: boolean;
}

export const tabs: TabConfig[] = [
  { name: "Dashboard", path: "/dashboard", icon: Home, tiers: ['all', 'office'] },
  { name: "Workflow", path: "/workflow", icon: Workflow, tiers: ['all'], requiresWorkflow: true },
  { name: "Tasks", path: "/tasks", icon: CheckSquare, tiers: ['all', 'field', 'minimal'] },
  { name: "Time", path: "/time", icon: Clock, tiers: ['all', 'field', 'minimal'], requiresTimeTracking: true },
  { name: "Hours", path: "/hours-tracking", icon: BarChart3, tiers: ['all', 'office'] },
  { name: "Job Cost", path: "/job-cost-report", icon: DollarSign, tiers: ['all', 'office'] },
  { name: "Invoicing", path: "/invoicing", icon: FileText, tiers: ['all', 'office'] },
  { name: "Estimates", path: "/estimates", icon: FileText, tiers: ['all', 'office'] },
  { name: "Quotes", path: "/quotes", icon: FileText, tiers: ['all', 'office'] },
  { name: "Proposals", path: "/proposals", icon: FileText, tiers: ['all'] },
  { name: "Change Orders", path: "/change-orders", icon: FileDiff, tiers: ['all', 'office'] },
  { name: "Insights", path: "/insights", icon: TrendingUp, tiers: ['all', 'office'] },
  { name: "Intelligence", path: "/intelligence", icon: Brain, tiers: ['all'] },
  { name: "Lookahead", path: "/lookahead", icon: Calendar, tiers: ['all'] },
  { name: "Manpower", path: "/manpower", icon: Users, tiers: ['all'] },
  { name: "Drawings", path: "/drawings", icon: Layers, tiers: ['all'] },
  { name: "Deficiencies", path: "/deficiencies", icon: AlertCircle, tiers: ['all'] },
  { name: "Safety", path: "/safety", icon: Shield, tiers: ['all', 'field'] },
  { name: "Receipts", path: "/receipts", icon: Receipt, tiers: ['all', 'office', 'field', 'minimal'] },
  { name: "Labor Rates", path: "/settings/labor-rates", icon: Settings, tiers: ['all', 'office'] },
  { name: "Executive", path: "/executive", icon: Crown, tiers: ['all'] },
  { name: "AI Brain", path: "/insights/ai-brain", icon: Cpu, tiers: ['all'] },
  { name: "Playbooks", path: "/playbooks", icon: BookOpen, tiers: ['all'] },
  { name: "Release", path: "/release", icon: Rocket, tiers: ['all'] },
];

export const useNavigationTabs = () => {
  const { isGlobalAdmin, projectRoles, loading: roleLoading } = useProjectRole();
  const { role: orgRole, isLoading: orgRoleLoading } = useOrganizationRole();
  const { hasRole, loading: userRoleLoading } = useUserRole();
  const { enabled: timeTrackingEnabled, loading: timeTrackingLoading } = useTimeTrackingEnabled();
  const { currentProjectId } = useCurrentProject();

  // Lightweight check for workflow mode
  const { data: workflowEnabled } = useQuery({
    queryKey: ['project-workflow-mode', currentProjectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_workflows')
        .select('flow_mode')
        .eq('project_id', currentProjectId!)
        .maybeSingle();
      return data?.flow_mode === 'ai_optimized';
    },
    enabled: !!currentProjectId,
  });

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

  // Derived role booleans for route-level access filtering
  const isAdmin = isGlobalAdmin || orgRole === 'admin';
  const isPM = orgRole === 'pm' || projectRoles.some(r => r.role === 'project_manager');
  const isForeman = orgRole === 'foreman' || projectRoles.some(r => r.role === 'foreman');

  /**
   * Route-level access filter — mirrors page-level gates.
   * Returns false for routes the current role cannot actually access.
   */
  const canAccessRoute = useMemo(() => {
    return (path: string): boolean => {
      switch (path) {
        // Admin-only routes
        case '/insights/ai-brain':
          return isAdmin;
        // Admin or PM routes
        case '/executive':
          return isAdmin || isPM;
        default:
          return true;
      }
    };
  }, [isAdmin, isPM]);

  const visibleTabs = useMemo(() => {
    if (isLoading) return tabs;

    return tabs.filter(tab => {
      if (!tab.tiers.includes(navTier)) return false;
      if (tab.requiresTimeTracking && !timeTrackingEnabled) return false;
      if (tab.requiresWorkflow && !workflowEnabled) return false;
      if (!canAccessRoute(tab.path)) return false;
      return true;
    });
  }, [navTier, timeTrackingEnabled, workflowEnabled, isLoading, canAccessRoute]);

  return { tabs, visibleTabs, isLoading };
};
