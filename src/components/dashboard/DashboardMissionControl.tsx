import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useRouteAccess } from "@/hooks/useRouteAccess";
import { useSnapshotCoverageReport } from "@/hooks/rpc/useSnapshotCoverageReport";
import { useDataQualityAudit } from "@/hooks/rpc/useDataQualityAudit";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { DashboardGrid } from "@/components/dashboard/shared/DashboardGrid";
import { ConfidenceRibbon } from "@/components/ConfidenceRibbon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, ListChecks, ArrowRight, RefreshCw } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Gate                                                                 */
/* ------------------------------------------------------------------ */

export function DashboardMissionControl() {
  const { loading, isAdmin, isPM, canViewExecutive, canViewDiagnostics } = useRouteAccess();

  if (loading) {
    return <MissionControlSkeleton />;
  }

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
/* Skeleton                                                             */
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
  const [lastRefresh, setLastRefresh] = useState(0);

  // ── Shared RPC hooks ───────────────────────────────────────────
  const {
    data: coverageData,
    isLoading: coverageLoading,
    error: coverageError,
    dataUpdatedAt: coverageUpdatedAt,
    refetch: refetchCoverage,
  } = useSnapshotCoverageReport();

  const {
    data: qualityData,
    isLoading: qualityLoading,
    error: qualityError,
    refetch: refetchQuality,
  } = useDataQualityAudit();

  const handleRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefresh < 15_000) return; // 15s throttle
    setLastRefresh(now);
    refetchCoverage();
    refetchQuality();
  }, [lastRefresh, refetchCoverage, refetchQuality]);

  // ── Derived values ──────────────────────────────────────────────

  // Coverage %
  const coveragePercent = (() => {
    if (!coverageData) return null;
    // The shared hook normalizes to SnapshotCoverageData which has coverage_percent
    return (coverageData as any).coverage_percent ?? (coverageData as any).coverage_pct ?? null;
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

  const ribbonCoverage = coveragePercent;
  const ribbonIssues = qualityIssueCount;
  const ribbonAsOf = coverageUpdatedAt ? new Date(coverageUpdatedAt) : null;

  return (
    <section className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Mission Control
        </h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="px-2"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
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
      </div>

      {/* Confidence Ribbon */}
      {!loading && (coverageData || qualityData) && (
        <ConfidenceRibbon
          coveragePercent={ribbonCoverage}
          issuesCount={ribbonIssues}
          asOf={ribbonAsOf}
          compact
        />
      )}

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
