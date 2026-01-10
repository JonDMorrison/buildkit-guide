import { useMemo } from "react";
import { NavLink } from "./NavLink";
import { Home, CheckSquare, Calendar, Users, AlertCircle, Shield, Receipt, Clock, Layers, BarChart3 } from "lucide-react";
import { useProjectRole } from "@/hooks/useProjectRole";
import { useTimeTrackingEnabled } from "@/hooks/useTimeTrackingEnabled";
import { Skeleton } from "@/components/ui/skeleton";

interface TabConfig {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  workerAccess: boolean;
  requiresTimeTracking?: boolean;
}

const tabs: TabConfig[] = [
  { name: "Dashboard", path: "/dashboard", icon: Home, workerAccess: false },
  { name: "Tasks", path: "/tasks", icon: CheckSquare, workerAccess: true },
  { name: "Time", path: "/time", icon: Clock, workerAccess: true, requiresTimeTracking: true },
  { name: "Hours", path: "/hours-tracking", icon: BarChart3, workerAccess: false },
  { name: "Lookahead", path: "/lookahead", icon: Calendar, workerAccess: false },
  { name: "Manpower", path: "/manpower", icon: Users, workerAccess: false },
  { name: "Drawings", path: "/drawings", icon: Layers, workerAccess: false },
  { name: "Deficiencies", path: "/deficiencies", icon: AlertCircle, workerAccess: false },
  { name: "Safety", path: "/safety", icon: Shield, workerAccess: false },
  { name: "Receipts", path: "/receipts", icon: Receipt, workerAccess: true },
];

export const TabBar = () => {
  const { shouldShowLimitedNav, loading: roleLoading } = useProjectRole();
  const { enabled: timeTrackingEnabled, loading: timeTrackingLoading } = useTimeTrackingEnabled();

  // Determine if we're still loading critical data
  const isLoading = roleLoading || timeTrackingLoading;

  // Memoize limitedNav to prevent recalculation on every render
  const limitedNav = useMemo(() => {
    if (isLoading) return false; // Default to full nav while loading
    return shouldShowLimitedNav();
  }, [isLoading, shouldShowLimitedNav]);

  // Memoize visible tabs to prevent array recreation
  const visibleTabs = useMemo(() => {
    if (isLoading) return tabs; // Show all tabs while loading (prevents flicker)
    
    return tabs.filter(tab => {
      if (limitedNav && !tab.workerAccess) return false;
      if (tab.requiresTimeTracking && !timeTrackingEnabled) return false;
      return true;
    });
  }, [limitedNav, timeTrackingEnabled, isLoading]);

  // Show skeleton placeholders while loading
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
    <nav className="fixed bottom-0 left-0 right-0 h-tab-bar bg-card border-t border-border overflow-x-auto">
      <div className="flex items-center h-full px-2 min-w-max">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className="flex flex-col items-center justify-center gap-1 flex-1 min-w-[80px] h-full text-muted-foreground transition-colors px-2"
              activeClassName="text-primary"
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium whitespace-nowrap">{tab.name}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};