import { NavLink } from "./NavLink";
import { Briefcase, CheckSquare, Calendar, Users, Shield, MessageSquare } from "lucide-react";

const tabs = [
  { name: "Projects", path: "/", icon: Briefcase },
  { name: "Tasks", path: "/tasks", icon: CheckSquare },
  { name: "Lookahead", path: "/lookahead", icon: Calendar },
  { name: "Manpower", path: "/manpower", icon: Users },
  { name: "Safety", path: "/safety", icon: Shield },
  { name: "AI", path: "/ai", icon: MessageSquare },
];

export const TabBar = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-tab-bar bg-card border-t border-border overflow-x-auto">
      <div className="flex items-center h-full px-2 min-w-max">
        {tabs.map((tab) => {
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
