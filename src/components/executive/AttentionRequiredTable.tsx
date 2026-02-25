import { DashboardCard } from '@/components/dashboard/shared/DashboardCard';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Eye, ExternalLink } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface AttentionProject {
  project_id: string;
  project_name: string;
  attention_score: number;
  risk_change: number;
  margin_change: number;
  burn_change: number;
}

function DeltaBadge({ value, suffix = '', invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const negative = invert ? value > 0 : value < 0;
  if (value === 0) return <span className="text-xs font-mono text-muted-foreground">—</span>;
  return (
    <span className={`text-xs font-mono font-medium ${negative ? 'text-destructive' : positive ? 'text-primary' : 'text-muted-foreground'}`}>
      {value > 0 ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  projects: AttentionProject[];
  loading?: boolean;
}

export function AttentionRequiredTable({ projects, loading = false }: Props) {
  return (
    <DashboardCard
      title="Attention Required"
      description="Top 5 projects needing executive review"
      icon={Eye}
      loading={loading}
      variant="table"
      traceSource="rpc_executive_change_feed → attention_ranked_projects"
      empty={!loading && projects.length === 0}
      emptyMessage="No attention-ranked projects yet."
    >
      <div className="space-y-2">
        {projects.slice(0, 5).map((p, i) => (
          <div
            key={p.project_id}
            className="flex items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-muted/30 transition-colors"
          >
            <span className="text-xs font-mono text-muted-foreground w-5 text-right shrink-0">
              #{i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <Link
                to={`/projects/${p.project_id}`}
                className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                {p.project_name}
                <ExternalLink className="h-3 w-3" />
              </Link>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                <span>Score: <span className="font-mono font-medium text-foreground">{p.attention_score.toFixed(1)}</span></span>
                <span>Risk Δ: <DeltaBadge value={p.risk_change} invert /></span>
                <span>Margin Δ: <DeltaBadge value={p.margin_change} suffix="%" /></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
