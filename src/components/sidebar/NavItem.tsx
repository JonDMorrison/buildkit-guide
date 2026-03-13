import { forwardRef } from "react";
import { NavLink } from "../NavLink";
import { cn } from "@/lib/utils";
import { usePrefetchRoute } from "@/hooks/usePrefetchRoute";
import { useCallback } from "react";

interface NavItemProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  badgeCount?: number;
  collapsed?: boolean;
}

export const NavItem = forwardRef<HTMLAnchorElement, NavItemProps>(({ label, icon: Icon, route, badgeCount, collapsed }, ref) => {
  const { prefetchRoute } = usePrefetchRoute();

  const handleMouseEnter = useCallback(() => {
    prefetchRoute(route);
  }, [prefetchRoute, route]);

  return (
    <NavLink
      to={route}
      onMouseEnter={handleMouseEnter}
      onFocus={handleMouseEnter}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl",
        "border-l-[3px] border-transparent text-slate-400 hover:text-white hover:bg-white/5 transition-colors duration-150",
        "active:scale-[0.98]",
        collapsed ? "justify-center px-0 py-2.5 mx-2" : "px-3 py-2.5 mx-2",
      )}
      activeClassName="border-l-[3px] !border-amber-500 bg-white/5 !text-white font-medium"
    >
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-300",
        "group-hover:bg-sidebar-primary/5 group-hover:shadow-inner"
      )}>
        <Icon
          className={cn(
            "shrink-0 transition-all duration-300 ease-out",
            collapsed ? "h-5 w-5" : "h-[19px] w-[19px]",
            "group-hover:scale-110 group-hover:text-sidebar-primary"
          )}
        />
      </div>

      {!collapsed && (
        <span className="text-[14px] font-medium leading-none tracking-tight transition-transform duration-300 group-hover:translate-x-0.5">
          {label}
        </span>
      )}

      {/* Improved Badge */}
      {badgeCount != null && badgeCount > 0 && (
        collapsed ? (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar animate-pulse" />
        ) : (
          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-bold tabular-nums text-primary border border-primary/20 shadow-sm animate-in fade-in zoom-in duration-300">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )
      )}
    </NavLink>
  );
});

NavItem.displayName = "NavItem";
