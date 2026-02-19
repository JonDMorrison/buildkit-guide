import { useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Shield, Award, Crown, Gem, ExternalLink, BarChart3, Zap, Target,
  HelpCircle, Activity,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCause } from '@/lib/causesDictionary';

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

// ── MCI calculation ────────────────────────────────────────────────────────
// Margin Control Index = 100 − (at_risk_count / active_count * 100)
// Clamped 0–100. Returns null when active_count is 0.
function computeMCI(atRisk: number, active: number): number | null {
  if (active === 0) return null;
  const raw = 100 - (atRisk / active) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function mciColor(mci: number) {
  if (mci >= 80) return 'text-primary';
  if (mci >= 50) return 'text-accent-foreground';
  return 'text-destructive';
}

function mciLabel(mci: number) {
  if (mci >= 80) return 'Controlled';
  if (mci >= 50) return 'Elevated Risk';
  return 'Critical';
}

function mciBarColor(mci: number) {
  if (mci >= 80) return 'bg-primary';
  if (mci >= 50) return 'bg-accent-foreground/60';
  return 'bg-destructive';
}

// ── Helpers ────────────────────────────────────────────────────────────────

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

function MarginArrow({ margin }: { margin: number }) {
  if (margin > 15) return <TrendingUp className="h-4 w-4 text-primary inline-block ml-1" />;
  if (margin > 0)  return <Minus className="h-4 w-4 text-muted-foreground inline-block ml-1" />;
  return <TrendingDown className="h-4 w-4 text-destructive inline-block ml-1" />;
}

// ── Cause row with tooltip ────────────────────────────────────────────────

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
      <Badge className="bg-destructive/10 text-destructive text-xs font-mono border-0 shrink-0 ml-2">
        {count}
      </Badge>
    </div>
  );
}

// ── Margin Control Index card ─────────────────────────────────────────────

function MarginControlIndexCard({ mci }: { mci: number | null }) {
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Activity className="h-4 w-4" />
          Margin Control Index
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help ml-1" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs p-3 space-y-1.5">
              <p className="font-semibold text-xs">Margin Control Index (MCI)</p>
              <p className="text-xs leading-relaxed">
                MCI = 100 − (At-Risk Projects ÷ Active Projects × 100)
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A score of 100 means no projects are at risk. A score of 0 means every active project is flagged at-risk. No trend is shown — a snapshot comparison table will be added in a future release.
              </p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {mci === null ? (
          <p className="text-sm text-muted-foreground">No active projects.</p>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <span className={`text-5xl font-bold tabular-nums ${mciColor(mci)}`}>
                {mci}
              </span>
              <span className="text-muted-foreground text-sm mb-1.5">/ 100</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${mciBarColor(mci)}`}
                style={{ width: `${mci}%` }}
              />
            </div>
            <Badge
              className={`text-xs font-medium border ${
                mci >= 80
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : mci >= 50
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'bg-destructive/10 text-destructive border-destructive/30'
              }`}
            >
              {mciLabel(mci)}
            </Badge>
          </>
        )}
      </CardContent>
    </Card>
  );
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

  const osScore = data?.os_score?.score ?? null;
  const tier    = data?.os_score?.tier;
  const margin  = data?.avg_projected_margin_at_completion_percent ?? 0;
  const mci     = data ? computeMCI(data.at_risk_count, data.projects_active_count) : null;

  return (
    <TooltipProvider>
      <Layout>
        <div className="max-w-5xl mx-auto p-6 space-y-6">

          {/* ── Header ──────────────────────────────────────────── */}
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

          {/* ── Error ───────────────────────────────────────────── */}
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
              {/* ── Headline: Margin Control Index ──────────────── */}
              <MarginControlIndexCard mci={mci} />

              {/* ── Block 1: OS Health + Project Counts ─────────── */}
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

                {/* Project Risk Counts */}
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

                    {/* Top causes with tooltips */}
                    {data.top_causes.length > 0 && (
                      <div className="space-y-2 border-t pt-3">
                        <p className="text-xs text-muted-foreground font-medium mb-2">Top risk causes</p>
                        {data.top_causes.slice(0, 4).map(c => (
                          <CauseRow key={c.cause} cause={c.cause} count={c.count} />
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
                            ? 'border-accent'
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
    </TooltipProvider>
  );
}
