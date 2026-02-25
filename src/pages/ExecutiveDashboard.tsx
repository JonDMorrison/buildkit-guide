import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RefreshCw, Copy, Check, ExternalLink, Loader2, BarChart3, Activity } from 'lucide-react';
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

import { ExecutiveBriefCard, type ChangeFeedData } from '@/components/executive/ExecutiveBriefCard';
import { PortfolioHealthCard, type PortfolioHealthData } from '@/components/executive/PortfolioHealthCard';
import { AttentionRequiredTable } from '@/components/executive/AttentionRequiredTable';
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
    if (!data) return;
    const tier = data.os_score?.tier ?? 'Unknown';
    const score = data.os_score?.score ?? '—';
    const causes = data.top_causes.slice(0, 3).map(c => getCause(c.cause).label).join(', ') || 'None';
    const text = `OS Health: ${tier} (${score}). Active: ${data.projects_active_count}. At risk: ${data.at_risk_count}. Avg projected margin: ${data.avg_projected_margin_at_completion_percent.toFixed(1)}%. Top causes: ${causes}.`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [data]);

  // Build portfolio health data from risk summary
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
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
              {data && (
                <Button variant="outline" size="sm" onClick={copySummary}>
                  {copied
                    ? <><Check className="h-4 w-4 mr-1.5 text-primary" />Copied!</>
                    : <><Copy className="h-4 w-4 mr-1.5" />Copy Summary</>
                  }
                </Button>
              )}
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
        {!data && !loading && !error && (
          <DashboardCard
            title="Executive Dashboard"
            icon={BarChart3}
            variant="metric"
            empty
            emptyMessage="Click Load Dashboard to fetch the latest risk data."
          />
        )}

        {/* ── 1. Executive Brief ──────────────────────────────── */}
        {activeOrganizationId && (
          <DashboardSection title="Executive Brief">
            <ExecutiveBriefCard orgId={activeOrganizationId} onFeedLoaded={setFeedData} />
          </DashboardSection>
        )}

        {/* ── 2. Attention Required ──────────────────────────── */}
        {(feedData || loading) && (
          <DashboardSection title="Where Leadership Should Look First" lazy skeletonHeight="h-56">
            <AttentionRequiredTable
              projects={feedData?.attention_ranked_projects ?? []}
              loading={loading && !feedData}
            />
          </DashboardSection>
        )}

        {/* ── 3. Portfolio Health + Economic Signals ─────────── */}
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

        {/* ── 4. Confidence & Evidence (below fold) ─────────── */}
        {(data || loading || activeOrganizationId) && (
          <DashboardSection title="Confidence & Evidence" lazy skeletonHeight="h-40" skeletonCount={2}>
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

        {/* ── 5. AI Change Feed (below fold, collapsed) ────────── */}
        <AIInsightsSection showChangeFeed />
      </DashboardLayout>
    </TooltipProvider>
  );
}
