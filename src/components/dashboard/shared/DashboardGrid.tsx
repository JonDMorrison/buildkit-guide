import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardGridProps {
  /** Number of columns at different breakpoints */
  columns?: 1 | 2 | 3 | 4 | 5;
  /** Gap size between grid items */
  gap?: "sm" | "md" | "lg";
  /** Grid children */
  children: ReactNode;
  /** Additional className */
  className?: string;
}

const columnClasses: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
};

const gapClasses: Record<string, string> = {
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-6",
};

/**
 * Responsive grid layout for dashboard cards.
 * Provides consistent spacing and column behavior.
 */
export function DashboardGrid({
  columns = 3,
  gap = "md",
  children,
  className,
}: DashboardGridProps) {
  return (
    <div className={cn("grid", columnClasses[columns], gapClasses[gap], className)}>
      {children}
    </div>
  );
}
