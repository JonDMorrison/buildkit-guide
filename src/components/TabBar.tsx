import { NavLink } from "./NavLink";
import { Home, CheckSquare, Calendar, Users, AlertCircle, Shield, MessageSquare } from "lucide-react";
import { useProjectRole } from "@/hooks/useProjectRole";

const tabs = [
  { name: "Dashboard", path: "/dashboard", icon: Home, workerAccess: false },
  { name: "Tasks", path: "/tasks", icon: CheckSquare, workerAccess: true },
  { name: "Lookahead", path: "/lookahead", icon: Calendar, workerAccess: false },
  { name: "Manpower", path: "/manpower", icon: Users, workerAccess: false },
  { name: "Deficiencies", path: "/deficiencies", icon: AlertCircle, workerAccess: false },
  { name: "Safety", path: "/safety", icon: Shield, workerAccess: false },
  { name: "AI", path: "/ai", icon: MessageSquare, workerAccess: true },
];

export const TabBar = () => {
  const { shouldShowLimitedNav } = useProjectRole();
  const limitedNav = shouldShowLimitedNav();

  // Filter tabs based on role
  const visibleTabs = limitedNav 
    ? tabs.filter(tab => tab.workerAccess)
    : tabs;

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
