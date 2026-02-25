import { ReactNode, forwardRef } from "react";
import { LazySection } from "@/components/LazySection";
import { SectionHelp } from "@/components/dashboard/shared/SectionHelp";
import { cn } from "@/lib/utils";

interface DashboardSectionProps {
  /** Section title */
  title?: string;
  /** Plain-English help tooltip shown via a ? icon */
  helpText?: string;
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
      helpText,
      lazy = false,
      skeletonHeight = "h-40",
      skeletonCount = 1,
      children,
      className,
    },
    ref,
  ) {
    const content = (
      <section ref={ref} className={cn("space-y-3 pt-4 first:pt-0", className)}>
        {title && (
          <div className="flex items-center justify-between pb-1 border-b border-border/30 mb-1">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              {title}
            </h2>
            {helpText && <SectionHelp text={helpText} />}
          </div>
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
