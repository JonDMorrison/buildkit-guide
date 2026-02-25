import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  /** Card title */
  title: string;
  /** Optional subtitle / description */
  subtitle?: string;
  /** Optional icon rendered next to the title */
  icon?: React.ComponentType<{ className?: string }>;
  /** Primary value display (number, badge, etc.) */
  value?: ReactNode;
  /** Data source trace label shown in tooltip */
  traceSource?: string;
  /** Loading state — shows skeleton */
  loading?: boolean;
  /** Empty state — shown when data is absent */
  empty?: boolean;
  /** Custom empty message */
  emptyMessage?: string;
  /** Card body content */
  children?: ReactNode;
  /** Additional className for the Card root */
  className?: string;
  /** Additional className for the CardContent */
  contentClassName?: string;
  /** Header action slot (buttons, badges, etc.) */
  headerAction?: ReactNode;
  /** Variant for visual emphasis */
  variant?: "default" | "danger" | "warning" | "success" | "muted";
}

const variantStyles: Record<string, string> = {
  default: "",
  danger: "border-destructive/40",
  warning: "border-accent",
  success: "border-primary/40",
  muted: "border-muted",
};

/**
 * Unified dashboard card with built-in loading, empty, and trace states.
 * Use across all dashboard surfaces for consistent UX.
 */
export function DashboardCard({
  title,
  subtitle,
  icon: Icon,
  value,
  traceSource,
  loading = false,
  empty = false,
  emptyMessage = "No data available",
  children,
  className,
  contentClassName,
  headerAction,
  variant = "default",
}: DashboardCardProps) {
  if (loading) {
    return (
      <Card className={cn("relative", variantStyles[variant], className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </CardHeader>
        <CardContent className={cn("space-y-3", contentClassName)}>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("relative", variantStyles[variant], className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
          <div className="min-w-0">
            <CardTitle className="text-sm font-medium text-muted-foreground truncate">
              {title}
            </CardTitle>
            {subtitle && (
              <CardDescription className="text-xs mt-0.5">{subtitle}</CardDescription>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {headerAction}
          {traceSource && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs max-w-xs">
                  <span className="font-mono text-[10px]">Source: {traceSource}</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-2", contentClassName)}>
        {value && (
          <div className="text-2xl font-bold text-foreground">{value}</div>
        )}
        {empty ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{emptyMessage}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
