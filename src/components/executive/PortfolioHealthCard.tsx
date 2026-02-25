import { DashboardCard } from '@/components/dashboard/shared/DashboardCard';
import { DashboardGrid } from '@/components/dashboard/shared/DashboardGrid';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Target, Zap, TrendingUp, Activity, HelpCircle,
  Shield, Award, Crown, Gem,
} from 'lucide-react';
import { getCause } from '@/lib/causesDictionary';

// ── Types (from rpc_get_executive_risk_summary) ────────────────────────────

interface TopCause { cause: string; count: number; }
interface OsScore { score: number; tier: string; breakdown?: Record<string, number>; }

export interface PortfolioHealthData {
  projects_active_count: number;
  at_risk_count: number;
  volatile_count: number;
  stable_count: number;
  avg_projected_margin_at_completion_percent: number;
  top_causes: TopCause[];
  os_score: OsScore;
  volatility_index: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function computeMCI(atRisk: number, active: number): number | null {
  if (active === 0) return null;
  return Math.max(0, Math.min(100, Math.round(100 - (atRisk / active) * 100)));
}

function scoreColor(v: number, thresholds: [number, number] = [80, 50]) {
  if (v >= thresholds[0]) return 'text-primary';
  if (v >= thresholds[1]) return 'text-accent-foreground';
  return 'text-destructive';
}

function barColor(v: number, thresholds: [number, number] = [80, 50]) {
  if (v >= thresholds[0]) return 'bg-primary';
  if (v >= thresholds[1]) return 'bg-accent-foreground/60';
  return 'bg-destructive';
}

function viScoreColor(v: number) {
  if (v > 60) return 'text-destructive';
  if (v >= 30) return 'text-accent-foreground';
  return 'text-primary';
}

function viBarColor(v: number) {
  if (v > 60) return 'bg-destructive';
  if (v >= 30) return 'bg-accent-foreground/60';
  return 'bg-primary';
}

function viLabel(v: number) {
  if (v > 60) return 'High Volatility';
  if (v >= 30) return 'Moderate';
  return 'Low Volatility';
}

function mciLabel(mci: number) {
  if (mci >= 80) return 'Controlled';
  if (mci >= 50) return 'Elevated Risk';
  return 'Critical';
}

function TierIcon({ tier }: { tier?: string }) {
  const t = (tier ?? '').toLowerCase();
  if (t === 'platinum') return <Gem className="h-5 w-5 text-primary" />;
  if (t === 'gold')     return <Crown className="h-5 w-5 text-accent-foreground" />;
  if (t === 'silver')   return <Award className="h-5 w-5 text-muted-foreground" />;
  return <Shield className="h-5 w-5 text-destructive/70" />;
}

function TierBadge({ tier }: { tier?: string }) {
  const t = (tier ?? 'Bronze').toLowerCase();
  const map: Record<string, string> = {
    platinum: 'bg-primary/10 text-primary border-primary/30',
    gold:     'bg-accent text-accent-foreground border-accent',
    silver:   'bg-muted text-muted-foreground border-border',
    bronze:   'bg-destructive/10 text-destructive/80 border-destructive/20',
  };
  return <Badge className={`border text-xs font-semibold ${map[t] ?? map.bronze}`}>{tier ?? 'Bronze'}</Badge>;
}

function CauseRow({ cause, count }: { cause: string; count: number }) {
  const def = getCause(cause);
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-muted-foreground truncate">{def.label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3 w-3 text-muted-foreground/50 shrink-0 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs space-y-1.5 p-3">
            <p className="font-semibold text-xs">{def.label}</p>
            <p className="text-xs leading-relaxed">{def.whyItMatters}</p>
            <p className="text-xs text-muted-foreground border-t pt-1.5 leading-relaxed">
              <span className="font-medium">Margin impact:</span> {def.marginImpact}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
      <Badge className="bg-destructive/10 text-destructive text-xs font-mono border-0 shrink-0 ml-2">{count}</Badge>
    </div>
  );
}

// ── Score Bar helper ───────────────────────────────────────────────────────

function ScoreBar({ value, colorFn, labelText }: { value: number; colorFn: (v: number) => string; labelText: string }) {
  return (
    <>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${colorFn(value)}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <Badge
        className={`text-xs font-medium border ${
          value >= 80 ? 'bg-primary/10 text-primary border-primary/30'
          : value >= 50 ? 'bg-accent text-accent-foreground border-accent'
          : 'bg-destructive/10 text-destructive border-destructive/30'
        }`}
      >
        {labelText}
      </Badge>
    </>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  data: PortfolioHealthData | null;
  loading?: boolean;
}

export function PortfolioHealthCard({ data, loading = false }: Props) {
  if (loading || !data) {
    return (
      <DashboardGrid columns={3}>
        <DashboardCard title="Volatility Index" icon={TrendingUp} loading variant="metric" traceSource="rpc_get_executive_risk_summary" />
        <DashboardCard title="Margin Control" icon={Activity} loading variant="metric" traceSource="rpc_get_executive_risk_summary" />
        <DashboardCard title="OS Health" icon={Zap} loading variant="metric" traceSource="rpc_get_executive_risk_summary" />
      </DashboardGrid>
    );
  }

  const vi = data.volatility_index ?? 0;
  const mci = computeMCI(data.at_risk_count, data.projects_active_count);
  const osScore = data.os_score?.score ?? null;
  const tier = data.os_score?.tier;
  const margin = data.avg_projected_margin_at_completion_percent ?? 0;

  return (
    <div className="space-y-4">
      {/* Row 1: Big three KPI cards */}
      <DashboardGrid columns={3}>
        {/* Volatility Index */}
        <DashboardCard title="Portfolio Volatility Index" icon={TrendingUp} traceSource="rpc_get_executive_risk_summary" variant="metric">
          <div className="flex items-end gap-2">
            <span className={`text-4xl font-bold tabular-nums ${viScoreColor(vi)}`}>{vi.toFixed(1)}</span>
            <span className="text-muted-foreground text-sm mb-1">/ 100</span>
          </div>
          <ScoreBar value={vi} colorFn={viBarColor} labelText={viLabel(vi)} />
        </DashboardCard>

        {/* Margin Control Index */}
        <DashboardCard title="Margin Control Index" icon={Activity} traceSource="rpc_get_executive_risk_summary" variant="metric">
          {mci === null ? (
            <p className="text-sm text-muted-foreground">No active projects.</p>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <span className={`text-4xl font-bold tabular-nums ${scoreColor(mci)}`}>{mci}</span>
                <span className="text-muted-foreground text-sm mb-1">/ 100</span>
              </div>
              <ScoreBar value={mci} colorFn={barColor} labelText={mciLabel(mci)} />
            </>
          )}
        </DashboardCard>

        {/* OS Health */}
        <DashboardCard title="Operating System Score" icon={Zap} traceSource="rpc_get_executive_risk_summary" variant="metric">
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold tabular-nums text-primary">{osScore !== null ? osScore : '—'}</span>
            <span className="text-muted-foreground text-sm mb-1">/ 100</span>
          </div>
          <div className="flex items-center gap-2">
            <TierIcon tier={tier} />
            <TierBadge tier={tier} />
          </div>
          {data.os_score?.breakdown && (
            <div className="space-y-1 pt-1">
              {Object.entries(data.os_score.breakdown).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs text-muted-foreground">
                  <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="font-mono font-medium">{v}</span>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>
      </DashboardGrid>

      {/* Row 2: Project risk counts + top causes */}
      <DashboardCard title="Projects at Risk" icon={Target} traceSource="rpc_get_executive_risk_summary" variant="table">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active',   value: data.projects_active_count, color: 'text-foreground' },
            { label: 'At Risk',  value: data.at_risk_count,         color: 'text-destructive' },
            { label: 'Volatile', value: data.volatile_count,        color: 'text-accent-foreground' },
            { label: 'Stable',   value: data.stable_count,          color: 'text-primary' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center rounded-lg bg-muted/40 p-3">
              <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">Avg projected margin at completion</span>
          <span className="text-sm font-semibold ml-auto tabular-nums">{margin.toFixed(1)}%</span>
        </div>

        {data.top_causes.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs text-muted-foreground font-medium mb-2">Top risk causes</p>
            {data.top_causes.slice(0, 4).map(c => (
              <CauseRow key={c.cause} cause={c.cause} count={c.count} />
            ))}
          </div>
        )}
      </DashboardCard>
    </div>
  );
}
