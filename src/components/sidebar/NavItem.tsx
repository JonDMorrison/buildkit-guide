import { NavLink } from "../NavLink";
import { cn } from "@/lib/utils";

interface NavItemProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  badgeCount?: number;
  collapsed?: boolean;
}

export const NavItem = ({ label, icon: Icon, route, badgeCount, collapsed }: NavItemProps) => {
  return (
    <NavLink
      to={route}
      className={cn(
        "group relative flex items-center gap-3 rounded-md transition-all duration-150 ease-out",
        "text-sidebar-foreground/50 hover:text-sidebar-foreground/90",
        "hover:bg-white/[0.06] hover:-translate-y-[1px]",
        collapsed ? "justify-center px-2 py-2.5" : "px-4 py-2.5",
      )}
      activeClassName={cn(
        "!text-primary font-semibold bg-primary/[0.08] shadow-[0_0_12px_-4px_hsl(var(--primary)/0.3)]",
        "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r-full before:bg-primary",
        "scale-[1.02] origin-left",
        "hover:translate-y-0",
      )}
    >
      <Icon
        className={cn(
          "shrink-0 transition-all duration-150 ease-out opacity-60 group-hover:opacity-90",
          collapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
          "group-hover:translate-x-0.5",
        )}
      />

      {!collapsed && (
        <span className="text-[15px] leading-tight truncate">{label}</span>
      )}

      {/* Badge */}
      {badgeCount != null && badgeCount > 0 && (
        collapsed ? (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar" />
        ) : (
          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/20 px-1.5 text-[10px] font-bold tabular-nums text-primary">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )
      )}
    </NavLink>
  );
};
