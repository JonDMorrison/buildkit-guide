import { NavLink } from "./NavLink";
import { useNavigationTabs } from "@/hooks/useNavigationTabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

export const TabBar = () => {
  const { visibleTabs, isLoading, tabs: allTabs } = useNavigationTabs();
  const isMobile = useIsMobile();

  // Only render on mobile
  if (!isMobile) return null;

  if (isLoading) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 h-tab-bar bg-card border-t border-border overflow-x-auto">
        <div className="flex items-center h-full px-2 min-w-max">
          {allTabs.map((tab) => (
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
