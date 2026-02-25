import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  RefreshCw, Copy, Check, ExternalLink, Loader2, BarChart3, Activity,
  AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Flame, ChevronDown,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCause } from '@/lib/causesDictionary';
import { useAuthRole } from '@/hooks/useAuthRole';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { NoAccess } from '@/components/NoAccess';
import { DashboardLayout } from '@/components/dashboard/shared/DashboardLayout';
import { DashboardHeader } from '@/components/dashboard/shared/DashboardHeader';
import { DashboardSection } from '@/components/dashboard/shared/DashboardSection';
import { DashboardGrid } from '@/components/dashboard/shared/DashboardGrid';
import { DashboardCard } from '@/components/dashboard/shared/DashboardCard';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';

import { ExecutiveBriefCard, type ChangeFeedData } from '@/components/executive/ExecutiveBriefCard';
import { PortfolioHealthCard, type PortfolioHealthData } from '@/components/executive/PortfolioHealthCard';
import { AttentionInbox } from '@/components/executive/AttentionInbox';
import { EconomicSignalsCard } from '@/components/executive/EconomicSignalsCard';
import { DataIntegrityCard, type DataIntegrityData } from '@/components/executive/DataIntegrityCard';
import { AIInsightsSection } from '@/components/ai-insights';
import { SnapshotStatusCard } from '@/components/executive/SnapshotStatusCard';

// ── Types ──────────────────────────────────────────────────────────────────

interface TopProject {
  project_id: string;
  project_name: string;
  risk_score: number;
  economic_position: 'at_risk' | 'volatile' | 'stable';
  executive_summary: string;
}

interface TopCause { cause: string; count: number; }
interface OsScore { score: number; tier: string; breakdown?: Record<string, number>; }

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
  data_integrity?: DataIntegrityData;
  volatility_index: number;
}

// ── Weekly Brief Hero ──────────────────────────────────────────────────────

function WeeklyBriefHero({
  feedData,
  data,
  onCopy,
  copied,
}: {
  feedData: ChangeFeedData | null;
  data: RiskSummary | null;
  onCopy: () => void;
  copied: boolean;
}) {
  if (!feedData && !data) return null;

  const headlines = feedData
    ? [
        { label: 'New Risks', value: feedData.new_risks, icon: AlertTriangle, color: 'text-destructive' },
        { label: 'Resolved', value: feedData.resolved_risks, icon: CheckCircle2, color: 'text-primary' },
        { label: 'Improving', value: feedData.improving, icon: TrendingUp, color: 'text-primary' },
        { label: 'Worsening', value: feedData.worsening, icon: TrendingDown, color: 'text-destructive' },
        { label: 'Burn ↑', value: feedData.burn_increases, icon: Flame, color: 'text-accent-foreground' },
      ]
    : [];

  const snapshotRange = feedData
    ? `${feedData.previous_snapshot_date} → ${feedData.latest_snapshot_date}`
    : null;

  // Confidence indicators from existing data
  const activeCount = data?.projects_active_count ?? 0;
  const atRiskCount = data?.at_risk_count ?? 0;
  const avgMargin = data?.avg_projected_margin_at_completion_percent ?? 0;
  const tier = data?.os_score?.tier;

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-6 space-y-5">
      {/* Top row: title + actions */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground leading-tight">Weekly Executive Brief</h2>
          {snapshotRange && (
            <p className="text-xs text-muted-foreground font-mono mt-1">{snapshotRange}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onCopy} className="shrink-0">
          {copied
            ? <><Check className="h-3.5 w-3.5 mr-1.5 text-primary" />Copied</>
            : <><Copy className="h-3.5 w-3.5 mr-1.5" />Copy Summary</>
          }
        </Button>
      </div>

      {/* Headline change metrics */}
      {headlines.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {headlines.map(h => (
            <div key={h.label} className="text-center rounded-lg bg-card border border-border/50 p-3">
              <h.icon className={`h-4 w-4 mx-auto mb-1.5 ${h.color}`} />
              <div className={`text-2xl font-bold tabular-nums leading-none ${h.color}`}>{h.value}</div>
              <div className="text-[10px] text-muted-foreground mt-1.5">{h.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Confidence line */}
      {data && (
        <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground border-t border-border/40 pt-3">
          <span>{activeCount} active project{activeCount !== 1 ? 's' : ''}</span>
          <span className="text-destructive font-medium">{atRiskCount} at risk</span>
          <span>Avg margin: <span className="font-mono font-medium text-foreground">{avgMargin.toFixed(1)}%</span></span>
          {tier && <span>OS Tier: <span className="font-medium text-foreground">{tier}</span></span>}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ExecutiveDashboard() {
  const { activeOrganizationId } = useOrganization();
  const { currentProjectId } = useCurrentProject();
  const { isAdmin, isPM, loading: roleLoading } = useAuthRole(currentProjectId || undefined);

  const [data, setData] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [feedData, setFeedData] = useState<ChangeFeedData | null>(null);
  const [changeLogOpen, setChangeLogOpen] = useState(false);

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

  const copySummary = useCallback(() => {
    if (!data && !feedData) return;
    const parts: string[] = [];
    if (data) {
      const tier = data.os_score?.tier ?? 'Unknown';
      const score = data.os_score?.score ?? '—';
      const causes = data.top_causes.slice(0, 3).map(c => getCause(c.cause).label).join(', ') || 'None';
      parts.push(`OS Health: ${tier} (${score}). Active: ${data.projects_active_count}. At risk: ${data.at_risk_count}. Avg projected margin: ${data.avg_projected_margin_at_completion_percent.toFixed(1)}%. Top causes: ${causes}.`);
    }
    if (feedData) {
      parts.push(`Changes: ${feedData.new_risks} new risks, ${feedData.resolved_risks} resolved, ${feedData.improving} improving, ${feedData.worsening} worsening, ${feedData.burn_increases} burn increases.`);
    }
    navigator.clipboard.writeText(parts.join(' ')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [data, feedData]);

  const portfolioData: PortfolioHealthData | null = data ? {
    projects_active_count: data.projects_active_count,
    at_risk_count: data.at_risk_count,
    volatile_count: data.volatile_count,
    stable_count: data.stable_count,
    avg_projected_margin_at_completion_percent: data.avg_projected_margin_at_completion_percent,
    top_causes: data.top_causes,
    os_score: data.os_score,
    volatility_index: data.volatility_index,
  } : null;

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin && !isPM()) {
    return (
      <DashboardLayout>
        <NoAccess message="Admin or PM access required." />
      </DashboardLayout>
    );
  }

  return (
    <TooltipProvider>
      <DashboardLayout>
        {/* ── Header ──────────────────────────────────────────── */}
        <DashboardHeader
          title="Executive Control Center"
          subtitle="Real-time operating health and margin risk across all active projects."
          badge={ranAt ? <span className="text-xs text-muted-foreground font-mono">Last refreshed {ranAt}</span> : undefined}
          actions={
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to="/data-health">
                  <Activity className="h-4 w-4 mr-1.5" />
                  Data Health
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/executive-report">
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  Full Report
                </Link>
              </Button>
              <Button onClick={refresh} disabled={loading || !activeOrganizationId} size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading…' : data ? 'Refresh' : 'Load Dashboard'}
              </Button>
            </>
          }
        />

        {/* ── Error state ─────────────────────────────────────── */}
        {error && (
          <DashboardCard title="Error" variant="alert" error={error} />
        )}

        {/* ── Empty state ─────────────────────────────────────── */}
        {!data && !loading && !error && !feedData && (
          <DashboardCard
            title="Executive Dashboard"
            icon={BarChart3}
            variant="metric"
            empty
            emptyMessage="Click Load Dashboard to fetch the latest risk data."
          />
        )}

        {/* ── 1. Weekly Brief Hero ────────────────────────────── */}
        <WeeklyBriefHero feedData={feedData} data={data} onCopy={copySummary} copied={copied} />

        {/* Hidden: ExecutiveBriefCard still drives data loading via onFeedLoaded */}
        {activeOrganizationId && (
          <div className="hidden">
            <ExecutiveBriefCard orgId={activeOrganizationId} onFeedLoaded={setFeedData} />
          </div>
        )}

        {/* ── 2. Attention Inbox (primary body) ───────────────── */}
        {(feedData || loading) && (
          <DashboardSection title="Where Leadership Should Look First">
            <AttentionInbox
              attentionProjects={feedData?.attention_ranked_projects ?? []}
              topChanges={feedData?.top_changes ?? []}
              loading={loading && !feedData}
            />
          </DashboardSection>
        )}

        {/* ── 3. Full Change Log (collapsed) ──────────────────── */}
        {feedData && feedData.top_changes.length > 0 && (
          <Collapsible open={changeLogOpen} onOpenChange={setChangeLogOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground mb-2">
                <span className="text-xs font-medium">Full Change Log ({feedData.top_changes.length} changes)</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${changeLogOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <DashboardCard title="Change Log" variant="table" traceSource="rpc_executive_change_feed → top_changes">
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted text-muted-foreground">
                        <th className="text-left px-3 py-2 font-medium">Project</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                        <th className="text-right px-3 py-2 font-medium">Risk Δ</th>
                        <th className="text-right px-3 py-2 font-medium">Margin Δ</th>
                        <th className="text-right px-3 py-2 font-medium">Burn Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feedData.top_changes.map(c => (
                        <tr key={c.project_id} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2">
                            <Link to={`/projects/${c.project_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                              {c.project_name} <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-foreground">{c.classification.replace(/_/g, ' ')}</td>
                          <td className="px-3 py-2 text-right font-mono">{c.risk_change > 0 ? '+' : ''}{c.risk_change.toFixed(1)}</td>
                          <td className="px-3 py-2 text-right font-mono">{c.margin_change > 0 ? '+' : ''}{c.margin_change.toFixed(1)}%</td>
                          <td className="px-3 py-2 text-right font-mono">{c.burn_change > 0 ? '+' : ''}{c.burn_change.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DashboardCard>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ── 4. Portfolio Health + Economic Signals ─────────── */}
        {(data || loading) && (
          <DashboardSection title="Portfolio Health" lazy skeletonHeight="h-48">
            <PortfolioHealthCard data={portfolioData} loading={loading} />
          </DashboardSection>
        )}

        {data && (
          <DashboardSection title="Economic Signals" lazy skeletonHeight="h-48" skeletonCount={2}>
            <EconomicSignalsCard
              volatilityIndex={data.volatility_index}
              topRiskProjects={data.top_risk_projects}
            />
          </DashboardSection>
        )}

        {/* ── 5. Confidence Footer (compact row) ──────────────── */}
        {(data || loading || activeOrganizationId) && (
          <DashboardSection title="Confidence & Evidence">
            <DashboardGrid columns={activeOrganizationId ? 2 : 1}>
              <DataIntegrityCard
                integrity={data?.data_integrity ?? null}
                loading={loading}
              />
              {activeOrganizationId && (
                <SnapshotStatusCard orgId={activeOrganizationId} />
              )}
            </DashboardGrid>
          </DashboardSection>
        )}

        {/* ── 6. AI Insights ──────────────────────────────────── */}
        <AIInsightsSection showChangeFeed />
      </DashboardLayout>
    </TooltipProvider>
  );
}
