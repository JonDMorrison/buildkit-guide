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
        "group relative flex items-center gap-3 rounded-xl transition-all duration-300 ease-in-out",
        "text-sidebar-foreground/60 hover:text-sidebar-foreground",
        "hover:bg-sidebar-accent/40 active:scale-[0.98]",
        "animate-sidebar-item",
        collapsed ? "justify-center px-0 py-2.5 mx-2" : "px-3 py-2.5 mx-2",
      )}
      activeClassName={cn(
        "!text-sidebar-primary font-medium bg-sidebar-primary/8 shadow-sm",
        "before:absolute before:left-[-8px] before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-[4px] before:rounded-r-full before:bg-sidebar-primary before:shadow-[0_0_12px_rgba(var(--sidebar-primary),0.5)]",
        "after:absolute after:inset-0 after:rounded-xl after:ring-1 after:ring-sidebar-primary/20",
      )}
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
