import { DashboardLayout } from "./DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";

export const DashboardSkeleton = () => (
  <DashboardLayout>
    <div className="space-y-6">
      {/* Header/Mission Control area */}
      <div className="rounded-xl border border-border bg-muted/20 h-24 animate-pulse" />
      
      {/* Main content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-muted/20 h-48 animate-pulse" />
        <div className="rounded-xl border border-border bg-muted/20 h-48 animate-pulse" />
      </div>

      {/* KPI/Metric strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-muted/20 h-24 animate-pulse" />
        ))}
      </div>
    </div>
  </DashboardLayout>
);

export const ExecutiveSkeleton = () => (
  <DashboardLayout>
    <div className="space-y-6">
      {/* Weekly Brief Hero area */}
      <div className="rounded-xl border border-primary/10 bg-gradient-to-br from-primary/5 via-background to-accent/5 h-40 animate-pulse" />
      
      {/* Attention Inbox area */}
      <div className="space-y-3">
        <div className="h-6 w-32 bg-muted rounded" />
        <div className="rounded-xl border border-border bg-muted/20 h-64 animate-pulse" />
      </div>

      {/* Portfolio Health area */}
      <div className="space-y-3">
        <div className="h-6 w-40 bg-muted rounded" />
        <div className="rounded-xl border border-border bg-muted/20 h-48 animate-pulse" />
      </div>
    </div>
  </DashboardLayout>
);

export const ListPageSkeleton = () => (
  <DashboardLayout>
    <div className="space-y-6">
      {/* Header area */}
      <div className="flex justify-between items-center mb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Table/List area */}
      <div className="rounded-xl border border-border bg-card">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex gap-4">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-48" />
          </div>
        </div>
        <div className="p-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-border last:border-0 flex justify-between items-center">
              <div className="space-y-2">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </DashboardLayout>
);
