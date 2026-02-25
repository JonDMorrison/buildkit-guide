import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardGridProps {
  /** Number of columns at desktop breakpoint */
  columns?: 1 | 2 | 3 | 4 | 5;
  /** Gap size between grid items */
  gap?: "sm" | "md" | "lg";
  /** Enable staggered card-enter animation */
  animate?: boolean;
  /** Grid children */
  children: ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Standardised responsive grid:
 *   Desktop  → columns (default 3)
 *   Laptop   → 2
 *   Tablet   → 1
 *
 * The 4- and 5-column variants keep their own responsive steps
 * because they are used for KPI strips.
 */
const columnClasses: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
};

const gapClasses: Record<string, string> = {
  sm: "gap-3",
  md: "gap-4 lg:gap-5",
  lg: "gap-6",
};

export function DashboardGrid({
  columns = 3,
  gap = "md",
  animate = true,
  children,
  className,
}: DashboardGridProps) {
  return (
    <div
      className={cn(
        "grid",
        columnClasses[columns],
        gapClasses[gap],
        animate && "stagger-in",
        className,
      )}
    >
      {children}
    </div>
  );
}
