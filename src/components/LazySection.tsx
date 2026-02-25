import { useRef, useState, useEffect, ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface LazySectionProps {
  children: ReactNode;
  /** Height of skeleton placeholder while not yet visible */
  skeletonHeight?: string;
  /** Number of skeleton rows to show */
  skeletonCount?: number;
  /** Root margin for IntersectionObserver — how far before viewport to trigger */
  rootMargin?: string;
  /** Optional className for the wrapper */
  className?: string;
}

/**
 * Defers rendering of children until the section scrolls near the viewport.
 * Shows skeleton placeholders until triggered.
 */
export function LazySection({
  children,
  skeletonHeight = "h-32",
  skeletonCount = 1,
  rootMargin = "200px",
  className,
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className}>
      {visible ? (
        children
      ) : (
        <div className="space-y-4">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <Skeleton key={i} className={`w-full ${skeletonHeight} rounded-lg`} />
          ))}
        </div>
      )}
    </div>
  );
}
