import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  /** Primary heading */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Right-side action buttons */
  actions?: ReactNode;
  /** Left-side decorations (badges, icons) */
  badge?: ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Consistent dashboard page header with title, subtitle, badge and action slots.
 */
export function DashboardHeader({
  title,
  subtitle,
  actions,
  badge,
  className,
}: DashboardHeaderProps) {
  return (
    <div
      className={cn(
        "widget-card !bg-gradient-to-br !from-card !via-primary/5 !to-secondary/5",
        className
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap">{actions}</div>
        )}
      </div>
    </div>
  );
}
