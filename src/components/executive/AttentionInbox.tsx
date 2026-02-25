import { Link } from 'react-router-dom';
import { DashboardCard } from '@/components/dashboard/shared/DashboardCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouteAccess } from '@/hooks/useRouteAccess';
import {
  AlertTriangle, TrendingDown, TrendingUp, Flame, CheckCircle2,
  ExternalLink, Eye, ArrowRight,
} from 'lucide-react';

// ── Types (reuse shapes from ChangeFeedData) ────────────────────────────

interface TopChange {
  project_id: string;
  project_name: string;
  risk_change: number;
  margin_change: number;
  burn_change: number;
  classification: string;
}

interface AttentionProject {
  project_id: string;
  project_name: string;
  attention_score: number;
  risk_change: number;
  margin_change: number;
  burn_change: number;
}

// ── Static next-step mapping by classification ──────────────────────────

const NEXT_STEP: Record<string, string> = {
  new_risks: 'Review risk drivers and verify margin projection',
  worsening: 'Investigate root cause of degradation',
  burn_increase: 'Audit labor burn rate against forecast',
  resolved_risks: 'Confirm resolution and update stakeholders',
  improving: 'Monitor trend continuation next cycle',
};

function nextStepText(classification: string): string {
  return NEXT_STEP[classification] ?? 'Review project details';
}

// ── Classification helpers ──────────────────────────────────────────────

function classificationIcon(c: string) {
  switch (c) {
    case 'new_risks':      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case 'resolved_risks': return <CheckCircle2  className="h-4 w-4 text-primary" />;
    case 'improving':      return <TrendingUp    className="h-4 w-4 text-primary" />;
    case 'worsening':      return <TrendingDown  className="h-4 w-4 text-destructive" />;
    case 'burn_increase':  return <Flame         className="h-4 w-4 text-accent-foreground" />;
    default:               return <Eye           className="h-4 w-4 text-muted-foreground" />;
  }
}

const CLASS_LABEL: Record<string, string> = {
  new_risks: 'New Risk',
  resolved_risks: 'Resolved',
  improving: 'Improving',
  worsening: 'Worsening',
  burn_increase: 'Burn ↑',
};

function severityVariant(c: string): 'destructive' | 'warning' | 'success' | 'secondary' {
  switch (c) {
    case 'new_risks':
    case 'worsening':     return 'destructive';
    case 'burn_increase': return 'warning';
    case 'resolved_risks':
    case 'improving':     return 'success';
    default:              return 'secondary';
  }
}

function DeltaValue({ value, suffix = '', invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const negative = invert ? value > 0 : value < 0;
  if (value === 0) return <span className="text-xs font-mono text-muted-foreground">—</span>;
  return (
    <span className={`text-xs font-mono font-medium ${negative ? 'text-destructive' : positive ? 'text-primary' : 'text-muted-foreground'}`}>
      {value > 0 ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  );
}

// ── Main component ──────────────────────────────────────────────────────

interface Props {
  /** attention_ranked_projects from rpc_executive_change_feed */
  attentionProjects: AttentionProject[];
  /** top_changes from rpc_executive_change_feed — used for classification lookup */
  topChanges?: TopChange[];
  /** Compact mode shows fewer items and smaller cards (for PM dashboard) */
  compact?: boolean;
  loading?: boolean;
}

export function AttentionInbox({ attentionProjects, topChanges = [], compact = false, loading = false }: Props) {
  const { canViewDiagnostics, canViewExecutive } = useRouteAccess();

  const limit = compact ? 5 : 25;
  const items = attentionProjects.slice(0, limit);

  // Build a map of project_id -> classification from topChanges
  const classificationMap = new Map<string, string>();
  topChanges.forEach(c => {
    if (!classificationMap.has(c.project_id)) {
      classificationMap.set(c.project_id, c.classification);
    }
  });

  // Derive classification for each attention project
  function getClassification(p: AttentionProject): string {
    const fromChanges = classificationMap.get(p.project_id);
    if (fromChanges) return fromChanges;
    // Fallback: derive from deltas
    if (p.risk_change > 10) return 'new_risks';
    if (p.risk_change > 0) return 'worsening';
    if (p.burn_change > 0.05) return 'burn_increase';
    if (p.risk_change < -5) return 'improving';
    return 'worsening'; // default for attention items
  }

  if (compact) {
    return (
      <DashboardCard
        title="My Attention"
        description="Projects needing your review"
        icon={Eye}
        loading={loading}
        variant="table"
        empty={!loading && items.length === 0}
        emptyMessage="No urgent attention items right now."
      >
        <div className="space-y-1.5">
          {items.map((p, i) => {
            const cls = getClassification(p);
            return (
              <Link
                key={p.project_id}
                to={`/projects/${p.project_id}`}
                className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2 hover:bg-muted/40 transition-colors group"
              >
                {classificationIcon(cls)}
                <span className="text-sm font-medium text-foreground truncate flex-1 group-hover:text-primary transition-colors">
                  {p.project_name}
                </span>
                <Badge variant={severityVariant(cls)} className="text-[10px] px-1.5 py-0">
                  {CLASS_LABEL[cls] ?? 'Attention'}
                </Badge>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      </DashboardCard>
    );
  }

  // Full mode — executive inbox
  return (
    <DashboardCard
      title="Attention Inbox"
      description={`Top ${items.length} projects requiring executive review`}
      icon={Eye}
      loading={loading}
      variant="table"
      traceSource="rpc_executive_change_feed → attention_ranked_projects"
      empty={!loading && items.length === 0}
      emptyMessage="No urgent attention items right now."
    >
      <div className="space-y-2">
        {items.map((p, i) => {
          const cls = getClassification(p);
          return (
            <div
              key={p.project_id}
              className="rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors space-y-2"
            >
              {/* Row 1: Rank + Name + Severity */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-5 text-right shrink-0">
                  #{i + 1}
                </span>
                {classificationIcon(cls)}
                <Link
                  to={`/projects/${p.project_id}`}
                  className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1 truncate"
                >
                  {p.project_name}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </Link>
                <Badge variant={severityVariant(cls)} className="text-[10px] ml-auto shrink-0">
                  {CLASS_LABEL[cls] ?? 'Attention'}
                </Badge>
              </div>

              {/* Row 2: Deltas + Score */}
              <div className="flex items-center gap-4 pl-8 text-xs text-muted-foreground">
                <span>Score: <span className="font-mono font-medium text-foreground">{p.attention_score.toFixed(1)}</span></span>
                <span>Risk Δ: <DeltaValue value={p.risk_change} invert /></span>
                <span>Margin Δ: <DeltaValue value={p.margin_change} suffix="%" /></span>
                <span>Burn Δ: <DeltaValue value={p.burn_change} invert /></span>
              </div>

              {/* Row 3: Next step + CTAs */}
              <div className="flex items-center justify-between pl-8">
                <span className="text-xs text-muted-foreground italic">
                  → {nextStepText(cls)}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {(canViewDiagnostics || canViewExecutive) && (
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" asChild>
                      <Link to={`/projects/${p.project_id}/financials`}>
                        View Evidence
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="h-6 text-[11px] px-2" asChild>
                    <Link to={`/projects/${p.project_id}`}>
                      Open Project
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
