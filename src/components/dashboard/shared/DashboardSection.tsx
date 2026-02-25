import { ReactNode } from "react";
import { LazySection } from "@/components/LazySection";
import { cn } from "@/lib/utils";

interface DashboardSectionProps {
  /** Section title */
  title?: string;
  /** Whether to lazy-load this section */
  lazy?: boolean;
  /** Skeleton height for lazy loading placeholder */
  skeletonHeight?: string;
  /** Number of skeleton rows */
  skeletonCount?: number;
  /** Section content */
  children: ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * A titled section within a dashboard page.
 * Supports optional lazy loading via IntersectionObserver.
 */
export function DashboardSection({
  title,
  lazy = false,
  skeletonHeight = "h-40",
  skeletonCount = 1,
  children,
  className,
}: DashboardSectionProps) {
  const content = (
    <div className={cn("space-y-3", className)}>
      {title && (
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h2>
      )}
      {children}
    </div>
  );

  if (lazy) {
    return (
      <LazySection skeletonHeight={skeletonHeight} skeletonCount={skeletonCount}>
        {content}
      </LazySection>
    );
  }

  return content;
}
