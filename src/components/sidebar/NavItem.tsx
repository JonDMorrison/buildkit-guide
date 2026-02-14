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
        "group relative flex items-center gap-3 rounded-lg transition-all duration-150 ease-out",
        "text-[hsl(var(--icon-inactive))] hover:text-sidebar-foreground/85",
        "hover:bg-white/[0.03]",
        collapsed ? "justify-center px-2 py-2.5" : "px-4 py-2.5",
      )}
      activeClassName={cn(
        "!text-[hsl(217,91%,70%)] font-semibold bg-primary/[0.10]",
        "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r-full before:bg-primary",
        "hover:translate-y-0",
      )}
    >
      <Icon
        className={cn(
          "shrink-0 transition-all duration-150 ease-out opacity-70 group-hover:opacity-100",
          collapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
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
