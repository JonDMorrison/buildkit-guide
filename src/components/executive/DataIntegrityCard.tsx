import { DashboardCard } from '@/components/dashboard/shared/DashboardCard';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { DatabaseZap, ExternalLink, CircleAlert, CircleDot, Shield } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface IntegrityIssue {
  project_id: string;
  project_name: string;
  issue_key: string;
  severity: 'high' | 'medium' | 'low';
  detail?: Record<string, unknown>;
}

export interface DataIntegrityData {
  issues: IntegrityIssue[];
  issue_count: number;
  scanned_at?: string;
  error?: string;
}

// ── Issue metadata ─────────────────────────────────────────────────────────

const ISSUE_META: Record<string, { label: string; description: string }> = {
  zero_projected_revenue: {
    label: 'Zero Projected Revenue',
    description: 'No approved estimate or change order found. Financial metrics cannot be computed.',
  },
  no_selected_estimate: {
    label: 'No Approved Estimate',
    description: 'Project has no approved estimate linked. Margin and budget variance are unavailable.',
  },
  unrated_labor: {
    label: 'Unrated Labor Hours',
    description: 'Time entries exist with no cost rate on the worker. Actual cost is understated.',
  },
  negative_margin_no_co: {
    label: 'Negative Margin — No Change Orders',
    description: 'Project is showing a negative margin with no approved change orders to account for it.',
  },
};

function getIssueMeta(key: string) {
  return ISSUE_META[key] ?? { label: key, description: 'Data integrity issue detected.' };
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  integrity: DataIntegrityData | null;
  loading?: boolean;
}

export function DataIntegrityCard({ integrity, loading = false }: Props) {
  const issues = integrity?.issues ?? [];
  const issueCount = integrity?.issue_count ?? 0;
  const highCount = issues.filter(i => i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;

  const variant = highCount > 0 ? 'alert' as const : 'metric' as const;

  return (
    <DashboardCard
      title="Data Integrity"
      description={integrity?.scanned_at ? `Scanned ${integrity.scanned_at}` : undefined}
      icon={DatabaseZap}
      loading={loading}
      variant={variant}
      traceSource="rpc_get_executive_risk_summary → data_integrity"
      error={integrity?.error || null}
      empty={!loading && !integrity}
      emptyMessage="No integrity data available. Load the dashboard to scan."
    >
      {integrity && issueCount === 0 && (
        <div className="flex items-center gap-2 text-sm text-primary py-2">
          <Shield className="h-4 w-4 shrink-0" />
          <span>All active projects passed integrity checks.</span>
        </div>
      )}

      {integrity && issueCount > 0 && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl font-bold tabular-nums text-destructive">{issueCount}</span>
            <div className="text-xs text-muted-foreground leading-tight">
              issue{issueCount !== 1 ? 's' : ''} detected
              {highCount > 0 && <span className="ml-1 text-destructive font-medium">· {highCount} high</span>}
              {mediumCount > 0 && <span className="ml-1 text-accent-foreground font-medium">· {mediumCount} medium</span>}
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {issues.map((issue, idx) => {
              const meta = getIssueMeta(issue.issue_key);
              const isHigh = issue.severity === 'high';
              return (
                <div
                  key={`${issue.project_id}-${issue.issue_key}-${idx}`}
                  className={`rounded-md border px-3 py-2 space-y-0.5 ${
                    isHigh ? 'bg-destructive/5 border-destructive/20' : 'bg-accent/5 border-accent/20'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {isHigh
                      ? <CircleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" />
                      : <CircleDot className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent-foreground" />
                    }
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">{meta.label}</span>
                        <Badge className={`text-[10px] border ${
                          isHigh ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-accent text-accent-foreground border-accent'
                        }`}>
                          {issue.severity}
                        </Badge>
                      </div>
                      <Link
                        to={`/projects/${issue.project_id}`}
                        className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        {issue.project_name}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{meta.description}</p>
                      {issue.detail && Object.keys(issue.detail).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {Object.entries(issue.detail).map(([k, v]) => (
                            <span key={k} className="text-[10px] font-mono text-muted-foreground">
                              {k}: <span className="text-foreground">{String(v)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </DashboardCard>
  );
}
