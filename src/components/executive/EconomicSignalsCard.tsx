import { DashboardCard } from '@/components/dashboard/shared/DashboardCard';
import { DashboardGrid } from '@/components/dashboard/shared/DashboardGrid';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { ExternalLink, BarChart3 } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface TopProject {
  project_id: string;
  project_name: string;
  risk_score: number;
  economic_position: 'at_risk' | 'volatile' | 'stable';
  executive_summary: string;
}

function PositionBadge({ position }: { position: string }) {
  if (position === 'at_risk')  return <Badge className="bg-destructive/10 text-destructive border-destructive/30 border text-xs">At Risk</Badge>;
  if (position === 'volatile') return <Badge className="bg-secondary text-secondary-foreground border text-xs">Volatile</Badge>;
  return <Badge className="bg-primary/10 text-primary border-primary/30 border text-xs">Stable</Badge>;
}

function RiskBar({ score }: { score: number }) {
  const color = score > 60 ? 'bg-destructive' : score >= 30 ? 'bg-accent-foreground/60' : 'bg-primary';
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-6 text-right">{score}</span>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  /** Volatility index value */
  volatilityIndex: number | null;
  /** Top risk projects from the risk summary */
  topRiskProjects: TopProject[];
  loading?: boolean;
}

export function EconomicSignalsCard({ volatilityIndex, topRiskProjects, loading = false }: Props) {
  return (
    <DashboardCard
      title="Economic Signals"
      description="Top projects by risk score"
      icon={BarChart3}
      loading={loading}
      variant="chart"
      traceSource="rpc_get_executive_risk_summary → top_risk_projects"
      empty={!loading && topRiskProjects.length === 0}
      emptyMessage="No active projects found for this organization."
    >
      <DashboardGrid columns={3}>
        {topRiskProjects.map((p, i) => (
          <div
            key={p.project_id}
            className={`rounded-lg border p-4 space-y-3 ${
              p.economic_position === 'at_risk'
                ? 'border-destructive/40'
                : p.economic_position === 'volatile'
                ? 'border-accent'
                : 'border-primary/20'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs text-muted-foreground font-mono shrink-0">#{i + 1}</span>
                <span className="text-sm font-semibold leading-tight truncate">{p.project_name}</span>
              </div>
              <PositionBadge position={p.economic_position} />
            </div>

            <RiskBar score={p.risk_score} />

            <p className="text-xs text-muted-foreground leading-relaxed">
              {p.executive_summary}
            </p>

            <Link
              to={`/projects/${p.project_id}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> View Project
            </Link>
          </div>
        ))}
      </DashboardGrid>
    </DashboardCard>
  );
}
