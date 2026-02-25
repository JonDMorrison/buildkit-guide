import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type CardVariant = "metric" | "table" | "chart" | "alert" | "ai_insight";

export interface DashboardCardProps {
  /** Card title */
  title: string;
  /** Optional description below the title */
  description?: string;
  /** Optional icon rendered next to the title */
  icon?: React.ComponentType<{ className?: string }>;
  /** Loading state — renders a variant-aware skeleton */
  loading?: boolean;
  /** Error state — renders an inline error message */
  error?: string | null;
  /** Header action slot (buttons, badges, links) */
  actions?: ReactNode;
  /** Card body content */
  children?: ReactNode;

  /* ── Extended props (backwards-compatible) ── */

  /** Layout / content variant — controls skeleton shape & accent styling */
  variant?: CardVariant;
  /** Primary value display (metric variant) */
  value?: ReactNode;
  /** Data source trace label shown in tooltip */
  traceSource?: string;
  /** Empty state flag */
  empty?: boolean;
  /** Custom empty message */
  emptyMessage?: string;
  /** Additional className for the Card root */
  className?: string;
  /** Additional className for the CardContent */
  contentClassName?: string;

  /** @deprecated Use `actions` instead */
  headerAction?: ReactNode;
  /** @deprecated Use `description` instead */
  subtitle?: string;
}

/* ------------------------------------------------------------------ */
/* Variant accent borders                                              */
/* ------------------------------------------------------------------ */

const variantAccent: Record<CardVariant, string> = {
  metric: "",
  table: "",
  chart: "",
  alert: "border-l-4 border-l-destructive/60",
  ai_insight: "border-l-4 border-l-accent",
};

/* ------------------------------------------------------------------ */
/* Skeleton loaders per variant                                        */
/* ------------------------------------------------------------------ */

function MetricSkeleton() {
  return (
    <>
      <Skeleton className="h-9 w-28 rounded" />
      <Skeleton className="h-3.5 w-40 rounded" />
    </>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full rounded" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-full rounded" />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return <Skeleton className="h-44 w-full rounded-lg" />;
}

function AlertSkeleton() {
  return (
    <div className="flex items-start gap-3">
      <Skeleton className="h-5 w-5 rounded-full shrink-0" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3.5 w-full rounded" />
      </div>
    </div>
  );
}

function AiInsightSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-5/6 rounded" />
      <Skeleton className="h-4 w-2/3 rounded" />
    </div>
  );
}

const skeletonMap: Record<CardVariant, () => JSX.Element> = {
  metric: MetricSkeleton,
  table: TableSkeleton,
  chart: ChartSkeleton,
  alert: AlertSkeleton,
  ai_insight: AiInsightSkeleton,
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const BASE_CARD =
  "relative rounded-xl border border-border/60 bg-card shadow-sm transition-shadow duration-200 hover:shadow-md";

/**
 * Universal dashboard card with variant-aware skeletons, error states,
 * trace tooltips, and clean SaaS styling.
 *
 * Works with all existing RPC data responses — just pass the data as children.
 */
export function DashboardCard({
  title,
  description,
  subtitle, // deprecated alias
  icon: Icon,
  loading = false,
  error = null,
  actions,
  headerAction, // deprecated alias
  children,
  variant = "metric",
  value,
  traceSource,
  empty = false,
  emptyMessage = "No data available",
  className,
  contentClassName,
}: DashboardCardProps) {
  const resolvedDescription = description || subtitle;
  const resolvedActions = actions || headerAction;

  /* ── Loading state ──────────────────────────────────────────────── */
  if (loading) {
    const SkeletonComponent = skeletonMap[variant];
    return (
      <Card className={cn(BASE_CARD, variantAccent[variant], className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-28 rounded" />
          </div>
          <Skeleton className="h-4 w-4 rounded-full" />
        </CardHeader>
        <CardContent className={cn("px-5 pb-5 space-y-3", contentClassName)}>
          <SkeletonComponent />
        </CardContent>
      </Card>
    );
  }

  /* ── Error state ────────────────────────────────────────────────── */
  if (error) {
    return (
      <Card className={cn(BASE_CARD, "border-destructive/30", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <CardTitle className="text-sm font-medium text-destructive truncate">
              {title}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <p className="text-sm text-destructive/80">{error}</p>
        </CardContent>
      </Card>
    );
  }

  /* ── Normal render ──────────────────────────────────────────────── */
  return (
    <Card className={cn(BASE_CARD, variantAccent[variant], className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
          <div className="min-w-0">
            <CardTitle className="text-sm font-medium text-muted-foreground truncate">
              {title}
            </CardTitle>
            {resolvedDescription && (
              <CardDescription className="text-xs mt-0.5">
                {resolvedDescription}
              </CardDescription>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {resolvedActions}
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

      <CardContent className={cn("px-5 pb-5 space-y-2", contentClassName)}>
        {value !== undefined && value !== null && (
          <div className="text-2xl font-bold text-foreground leading-none">{value}</div>
        )}
        {empty ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{emptyMessage}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
