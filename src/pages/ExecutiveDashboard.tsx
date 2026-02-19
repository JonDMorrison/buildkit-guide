import { useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import {
  RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Shield, Award, Crown, Gem, ExternalLink, BarChart3, Zap, Target
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ── Types ──────────────────────────────────────────────────────────────────

interface TopProject {
  project_id: string;
  project_name: string;
  risk_score: number;
  economic_position: 'at_risk' | 'volatile' | 'stable';
  executive_summary: string;
}

interface TopCause {
  cause: string;
  count: number;
}

interface OsScore {
  score: number;
  tier: string;
  breakdown?: Record<string, number>;
}

interface RiskSummary {
  org_id: string;
  projects_active_count: number;
  at_risk_count: number;
  volatile_count: number;
  stable_count: number;
  avg_projected_margin_at_completion_percent: number;
  top_risk_projects: TopProject[];
  top_causes: TopCause[];
  os_score: OsScore;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const CAUSE_LABELS: Record<string, string> = {
  margin_declining:          'Margin Declining',
  labor_burn_high:           'Labor Burn Exceeding Benchmark',
  below_low_band:            'Below Historical Low Band',
  low_historical_data:       'Low Historical Data',
  labor_burn_exceeding_benchmark: 'Labor Burn Exceeding Benchmark',
};

function humanCause(cause: string) {
  return CAUSE_LABELS[cause] ?? cause.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
  return (
    <Badge className={`border text-xs font-semibold ${map[t] ?? map.bronze}`}>
      {tier ?? 'Bronze'}
    </Badge>
  );
}

function PositionBadge({ position }: { position: string }) {
  if (position === 'at_risk')  return <Badge className="bg-destructive/10 text-destructive border-destructive/30 border text-xs">At Risk</Badge>;
  if (position === 'volatile') return <Badge className="bg-accent text-accent-foreground border-accent border text-xs">Volatile</Badge>;
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

function MarginArrow({ margin }: { margin: number }) {
  if (margin > 15) return <TrendingUp className="h-4 w-4 text-primary inline-block ml-1" />;
  if (margin > 0)  return <Minus className="h-4 w-4 text-muted-foreground inline-block ml-1" />;
  return <TrendingDown className="h-4 w-4 text-destructive inline-block ml-1" />;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ExecutiveDashboard() {
  const { activeOrganizationId } = useOrganization();
  const [data, setData] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!activeOrganizationId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: rpcError } = await (supabase as any).rpc(
        'rpc_get_executive_risk_summary',
        { p_org_id: activeOrganizationId }
      );
      if (rpcError) throw new Error(rpcError.message);
      setData(result as RiskSummary);
      setRanAt(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId]);

  const osScore   = data?.os_score?.score ?? null;
  const tier      = data?.os_score?.tier;
  const margin    = data?.avg_projected_margin_at_completion_percent ?? 0;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Executive Risk Summary</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Real-time operating health and margin risk across all active projects.
            </p>
            {ranAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Last refreshed <span className="font-mono">{ranAt}</span>
              </p>
            )}
          </div>
          <Button onClick={refresh} disabled={loading || !activeOrganizationId} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading…' : data ? 'Refresh' : 'Load Dashboard'}
          </Button>
        </div>

        {/* ── Error ────────────────────────────────────────────── */}
        {error && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-sm text-destructive">{error}</span>
            </CardContent>
          </Card>
        )}

        {/* ── Empty state ──────────────────────────────────────── */}
        {!data && !loading && !error && (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center text-muted-foreground">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Click <strong>Load Dashboard</strong> to fetch the latest risk data.</p>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            {/* ── Block 1: Operating System Health ─────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* OS Score */}
              <Card className="md:col-span-1 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Zap className="h-4 w-4" /> Operating System Score
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex items-end gap-3">
                    <span className="text-5xl font-bold tabular-nums text-primary">
                      {osScore !== null ? osScore : '—'}
                    </span>
                    <span className="text-muted-foreground text-sm mb-1.5">/ 100</span>
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
                </CardContent>
              </Card>

              {/* Block 2: Project Risk Counts */}
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-4 w-4" /> Projects at Risk
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
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
                    <span className="text-sm font-semibold ml-auto tabular-nums">
                      {margin.toFixed(1)}%
                      <MarginArrow margin={margin} />
                    </span>
                  </div>

                  {/* Top causes */}
                  {data.top_causes.length > 0 && (
                    <div className="space-y-1 border-t pt-3">
                      <p className="text-xs text-muted-foreground font-medium mb-2">Top risk causes</p>
                      {data.top_causes.slice(0, 4).map(c => (
                        <div key={c.cause} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{humanCause(c.cause)}</span>
                          <Badge className="bg-destructive/10 text-destructive text-xs font-mono border-0">
                            {c.count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Block 3: Top Risk Projects ───────────────────── */}
            {data.top_risk_projects.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Top Projects by Risk Score
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {data.top_risk_projects.map((p, i) => (
                    <Card
                      key={p.project_id}
                      className={
                        p.economic_position === 'at_risk'
                          ? 'border-destructive/40'
                          : p.economic_position === 'volatile'
                          ? 'border-yellow-500/40'
                          : 'border-primary/20'
                      }
                    >
                      <CardContent className="p-4 space-y-3">
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {data.top_risk_projects.length === 0 && (
              <Card className="border-primary/20">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  No active projects found for this organization.
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
