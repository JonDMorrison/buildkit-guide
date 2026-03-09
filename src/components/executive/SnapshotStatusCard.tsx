import { DashboardCard } from '@/components/dashboard/shared/DashboardCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSnapshotCoverageReport } from '@/hooks/rpc/useSnapshotCoverageReport';
import { useOrgSnapshotCapture } from '@/hooks/rpc/useOrgSnapshotCapture';
import { Camera, Loader2, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
}

export function SnapshotStatusCard({ orgId }: Props) {
  const { data, isLoading: loading, error: queryError, refetch } = useSnapshotCoverageReport(orgId);
  const error = queryError ? String(queryError) : null;
  
  const { capture: captureSnapshots, isCapturing: capturing } = useOrgSnapshotCapture(orgId, async () => {
    await refetch();
  });

  const projects = data?.projects ?? [];
  const uncovered = projects.filter(p => p.snapshot_count < 2);
  const gapped = projects.filter(p => p.has_gap && p.snapshot_count >= 2);

  return (
    <DashboardCard
      title="Snapshot Status"
      description={data ? `${data.coverage_percent}% coverage` : undefined}
      icon={Clock}
      loading={loading && !data}
      error={error}
      variant="table"
      traceSource="rpc_snapshot_coverage_report"
      actions={
        <Button size="sm" variant="outline" onClick={captureSnapshots} disabled={capturing}>
          {capturing
            ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Capturing…</>
            : <><Camera className="h-3.5 w-3.5 mr-1.5" />Capture Now</>
          }
        </Button>
      }
    >
      {data && (
        <div className="space-y-3">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center rounded-lg bg-muted/40 p-2.5">
              <div className="text-2xl font-bold tabular-nums text-foreground">{data.total_projects}</div>
              <div className="text-[10px] text-muted-foreground">Total Projects</div>
            </div>
            <div className="text-center rounded-lg bg-muted/40 p-2.5">
              <div className="text-2xl font-bold tabular-nums text-primary">{data.covered_projects}</div>
              <div className="text-[10px] text-muted-foreground">With Snapshots</div>
            </div>
            <div className="text-center rounded-lg bg-muted/40 p-2.5">
              <div className={`text-2xl font-bold tabular-nums ${data.coverage_percent >= 80 ? 'text-primary' : 'text-destructive'}`}>
                {data.coverage_percent}%
              </div>
              <div className="text-[10px] text-muted-foreground">Coverage</div>
            </div>
          </div>

          {/* Coverage bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${data.coverage_percent >= 80 ? 'bg-primary' : data.coverage_percent >= 50 ? 'bg-accent-foreground/60' : 'bg-destructive'}`}
              style={{ width: `${data.coverage_percent}%` }}
            />
          </div>

          {/* Issues */}
          {uncovered.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-destructive" />
                {uncovered.length} project{uncovered.length !== 1 ? 's' : ''} need more snapshots
              </p>
              <div className="flex flex-wrap gap-1.5">
                {uncovered.slice(0, 6).map(p => (
                  <Badge key={p.project_id} variant="outline" className="text-[10px]">
                    {p.project_name} ({p.snapshot_count})
                  </Badge>
                ))}
                {uncovered.length > 6 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{uncovered.length - 6} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {uncovered.length === 0 && gapped.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>All projects have adequate snapshot coverage.</span>
            </div>
          )}
        </div>
      )}
    </DashboardCard>
  );
}
