import { NavLink } from "./NavLink";
import { Briefcase, CheckSquare, Calendar, Shield, MessageSquare } from "lucide-react";

const tabs = [
  { name: "Projects", path: "/", icon: Briefcase },
  { name: "Tasks", path: "/tasks", icon: CheckSquare },
  { name: "Lookahead", path: "/lookahead", icon: Calendar },
  { name: "Safety", path: "/safety", icon: Shield },
  { name: "AI", path: "/ai", icon: MessageSquare },
];

export const TabBar = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-tab-bar bg-card border-t border-border">
      <div className="flex items-center justify-around h-full px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-muted-foreground transition-colors"
              activeClassName="text-primary"
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs font-medium">{tab.name}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
