import { ReactNode, forwardRef } from "react";
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
 * Provides consistent vertical rhythm and
 * optional lazy loading via IntersectionObserver.
 */
export const DashboardSection = forwardRef<HTMLElement, DashboardSectionProps>(
  function DashboardSection(
    {
      title,
      lazy = false,
      skeletonHeight = "h-40",
      skeletonCount = 1,
      children,
      className,
    },
    ref,
  ) {
    const content = (
      <section ref={ref} className={cn("space-y-3 pt-2", className)}>
        {title && (
          <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest pb-1">
            {title}
          </h2>
        )}
        {children}
      </section>
    );

    if (lazy) {
      return (
        <LazySection skeletonHeight={skeletonHeight} skeletonCount={skeletonCount}>
          {content}
        </LazySection>
      );
    }

    return content;
  },
);
