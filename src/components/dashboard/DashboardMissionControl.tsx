import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRouteAccess } from "@/hooks/useRouteAccess";
import { useOrganization } from "@/hooks/useOrganization";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { DashboardGrid } from "@/components/dashboard/shared/DashboardGrid";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, ListChecks, ArrowRight } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Gate                                                                 */
/* ------------------------------------------------------------------ */

export function DashboardMissionControl() {
  const { loading, isAdmin, isPM, canViewExecutive, canViewDiagnostics } = useRouteAccess();

  // While roles are resolving, render nothing — no queries fire
  if (loading) {
    return <MissionControlSkeleton />;
  }

  // Only Admin or PM may see the strip
  if (!isAdmin && !isPM) {
    return null;
  }

  return (
    <DashboardMissionControlContent
      canViewExecutive={canViewExecutive}
      canViewDiagnostics={canViewDiagnostics}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton (shown while gate is loading)                               */
/* ------------------------------------------------------------------ */

function MissionControlSkeleton() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-36 rounded" />
        <Skeleton className="h-8 w-40 rounded" />
      </div>
      <DashboardGrid columns={2}>
        <Skeleton className="h-[140px] rounded-xl" />
        <Skeleton className="h-[140px] rounded-xl" />
      </DashboardGrid>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Content (only mounted after gate passes — safe to query)             */
/* ------------------------------------------------------------------ */

interface ContentProps {
  canViewExecutive: boolean;
  canViewDiagnostics: boolean;
}

function DashboardMissionControlContent({ canViewExecutive, canViewDiagnostics }: ContentProps) {
  const navigate = useNavigate();
  const { activeOrganizationId } = useOrganization();

  // ── RPC: snapshot coverage ──────────────────────────────────────
  const {
    data: coverageData,
    isLoading: coverageLoading,
    error: coverageError,
  } = useQuery({
    queryKey: ["mission-control-coverage", activeOrganizationId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("rpc_snapshot_coverage_report", {
        p_org_id: activeOrganizationId!,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!activeOrganizationId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // ── RPC: data quality audit ─────────────────────────────────────
  const {
    data: qualityData,
    isLoading: qualityLoading,
    error: qualityError,
  } = useQuery({
    queryKey: ["mission-control-quality", activeOrganizationId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("rpc_data_quality_audit", {
        p_org_id: activeOrganizationId!,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!activeOrganizationId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // ── Derived values ──────────────────────────────────────────────

  // Coverage %
  const coveragePercent = (() => {
    if (!coverageData) return null;
    // The RPC returns an array of project rows; compute average coverage
    if (Array.isArray(coverageData)) {
      if (coverageData.length === 0) return 100;
      const total = coverageData.reduce((sum: number, row: any) => {
        const pct = row.coverage_pct ?? row.coverage_percent ?? 0;
        return sum + Number(pct);
      }, 0);
      return Math.round(total / coverageData.length);
    }
    // Might be a single object with a summary field
    return coverageData.coverage_pct ?? coverageData.coverage_percent ?? null;
  })();

  // Projects with quality issues
  const qualityIssueCount = (() => {
    if (!qualityData) return null;
    if (Array.isArray(qualityData)) {
      return qualityData.filter((row: any) => {
        const issues = row.issues ?? row.issue_count ?? 0;
        return Array.isArray(issues) ? issues.length > 0 : Number(issues) > 0;
      }).length;
    }
    return null;
  })();

  // Top 3 issue categories from quality audit
  const topIssues: { category: string; count: number }[] = (() => {
    if (!qualityData || !Array.isArray(qualityData)) return [];
    const categoryMap = new Map<string, number>();
    for (const row of qualityData) {
      const issues = row.issues ?? [];
      if (Array.isArray(issues)) {
        for (const issue of issues) {
          const cat = typeof issue === "string" ? issue : issue.category ?? issue.type ?? "Unknown";
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
        }
      }
    }
    return Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  })();

  const loading = coverageLoading || qualityLoading;

  return (
    <section className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Mission Control
        </h2>
        {canViewExecutive && (
          <Button
            size="sm"
            variant="outline"
            className="px-3 w-fit"
            onClick={() => navigate("/executive")}
          >
            Open Executive Brief <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      {/* Cards */}
      <DashboardGrid columns={2}>
        {/* A) Confidence Status */}
        <DashboardCard
          title="Data Confidence"
          icon={ShieldCheck}
          loading={loading}
          error={
            coverageError && qualityError
              ? "Confidence unavailable"
              : null
          }
          variant="metric"
          traceSource="rpc_snapshot_coverage_report + rpc_data_quality_audit"
          value={
            coveragePercent !== null
              ? `${coveragePercent}%`
              : undefined
          }
        >
          <p className="text-sm text-muted-foreground">
            {coverageError
              ? "Coverage data unavailable"
              : `Snapshot coverage across projects`}
          </p>
          {qualityIssueCount !== null && qualityIssueCount > 0 && (
            <p className="text-sm text-destructive/80 font-medium">
              {qualityIssueCount} project{qualityIssueCount !== 1 ? "s" : ""} with data quality issues
            </p>
          )}
          {qualityIssueCount === 0 && !qualityError && (
            <p className="text-sm text-primary font-medium">
              All projects passing quality checks
            </p>
          )}
          {qualityError && !coverageError && (
            <p className="text-sm text-muted-foreground">Quality audit unavailable</p>
          )}
        </DashboardCard>

        {/* B) Next Actions */}
        <DashboardCard
          title="Top Issues"
          icon={ListChecks}
          loading={loading}
          error={qualityError && !coverageError ? null : undefined}
          variant="table"
          traceSource="rpc_data_quality_audit"
          empty={topIssues.length === 0 && !qualityError}
          emptyMessage="No data quality issues found"
          actions={
            canViewDiagnostics && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/data-health")}
                className="text-xs"
              >
                Open Data Health
              </Button>
            )
          }
        >
          {qualityError ? (
            <p className="text-sm text-muted-foreground">Quality data unavailable</p>
          ) : (
            <div className="space-y-1.5">
              {topIssues.map((issue) => (
                <div
                  key={issue.category}
                  className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0"
                >
                  <span className="text-foreground truncate">{issue.category}</span>
                  <span className="text-muted-foreground font-mono text-xs shrink-0 ml-2">
                    {issue.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>
      </DashboardGrid>
    </section>
  );
}
