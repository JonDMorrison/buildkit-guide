import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useRouteAccess } from '@/hooks/useRouteAccess';
import { useOrganization } from '@/hooks/useOrganization';
import { useSnapshotCoverageReport } from '@/hooks/rpc/useSnapshotCoverageReport';
import { useDataQualityAudit } from '@/hooks/rpc/useDataQualityAudit';
import { useExecutiveChangeFeed, CHANGE_FEED_QUERY_KEY } from '@/hooks/rpc/useExecutiveChangeFeed';
import { NoAccess } from '@/components/NoAccess';
import { Layout } from '@/components/Layout';
import { ConfidenceRibbon } from '@/components/ConfidenceRibbon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Download, Copy, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ShieldCheck, Activity, RefreshCw, ShieldAlert } from 'lucide-react';
import { DashboardMissionControl } from '@/components/dashboard/DashboardMissionControl';
import { startConsoleCapture } from '@/lib/consoleCapture';
import { buildHealthCheckReport, type HealthCheckResult, type CheckStatus } from '@/lib/healthCheckReport';
import { downloadText } from '@/lib/downloadText';
import { getActionsForHealthCheck, type ActionContext } from '@/lib/actionRouter';
import { ActionRow } from '@/components/ActionRow';
import { toast } from 'sonner';

// ── Gate ────────────────────────────────────────────────────────────────────

export default function HealthCheck() {
  const { isAdmin, isPM, loading } = useRouteAccess();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin && !isPM) {
    return (
      <Layout>
        <NoAccess title="Access Restricted" message="Production Health Check requires Admin or PM access." />
      </Layout>
    );
  }

  return <HealthCheckContent />;
}

// ── Core routes to probe ──────────────────────────────────────────────────

const HEALTH_PROBE_ROUTES = ['/dashboard', '/executive', '/insights', '/projects', '/tasks'] as const;

// ── Helpers ───────────────────────────────────────────────────────────────

function statusIcon(s: CheckStatus) {
  switch (s) {
    case 'pass': return <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />;
    case 'warn': return <AlertTriangle className="h-5 w-5 text-accent-foreground shrink-0" />;
    case 'fail': return <XCircle className="h-5 w-5 text-destructive shrink-0" />;
  }
}

function statusBadge(s: CheckStatus) {
  switch (s) {
    case 'pass': return <Badge variant="default">Pass</Badge>;
    case 'warn': return <Badge variant="secondary">Warning</Badge>;
    case 'fail': return <Badge variant="destructive">Fail</Badge>;
  }
}

// ── Route probe (lightweight, no probes/clicks) ───────────────────────────

interface RouteProbeResult {
  path: string;
  errorCount: number;
  warnCount: number;
  crashed: boolean;
}

function waitMs(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise(r => requestAnimationFrame(() => r()));
}

async function runLightweightRouteProbes(
  navigate: (path: string) => void,
  getPathname: () => string,
): Promise<RouteProbeResult[]> {
  const results: RouteProbeResult[] = [];

  for (const path of HEALTH_PROBE_ROUTES) {
    const capture = startConsoleCapture();
    let crashed = false;

    try {
      navigate(path);
      await waitForAnimationFrame();
      await waitMs(800);
    } catch {
      crashed = true;
    }

    const logs = capture.stop();
    results.push({
      path,
      errorCount: logs.filter(l => l.level === 'error').length,
      warnCount: logs.filter(l => l.level === 'warn').length,
      crashed,
    });
  }

  return results;
}

// ── Content ────────────────────────────────────────────────────────────────

function HealthCheckContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeOrganization, activeOrganizationId } = useOrganization();
  const { isAdmin, isPM, canViewDiagnostics, canViewExecutive } = useRouteAccess();

  // Reuse existing shared hooks
  const { data: coverageData, dataUpdatedAt: coverageUpdatedAt, isLoading: coverageLoading, error: coverageError } = useSnapshotCoverageReport();
  const { data: qualityData, isLoading: qualityLoading, error: qualityError } = useDataQualityAudit();
  const { data: feedData, isLoading: feedLoading, error: feedError } = useExecutiveChangeFeed();

  const [routeProbeResults, setRouteProbeResults] = useState<RouteProbeResult[] | null>(null);
  const [probing, setProbing] = useState(false);
  const [probedAt, setProbedAt] = useState<Date | null>(null);
  const [rechecking, setRechecking] = useState<Set<string>>(new Set());

  const handleRecheck = useCallback(async (checkName: string) => {
    setRechecking(prev => new Set(prev).add(checkName));
    try {
      switch (checkName) {
        case 'snapshot_freshness':
        case 'snapshot_coverage':
          await queryClient.invalidateQueries({ queryKey: ['rpc-snapshot-coverage', activeOrganizationId] });
          break;
        case 'data_quality':
          await queryClient.invalidateQueries({ queryKey: ['rpc-data-quality-audit', activeOrganizationId] });
          break;
        case 'exec_intelligence':
          await queryClient.invalidateQueries({ queryKey: [CHANGE_FEED_QUERY_KEY, activeOrganizationId] });
          break;
        case 'ui_reliability': {
          const results = await runLightweightRouteProbes(
            (path) => navigate(path),
            () => window.location.pathname,
          );
          navigate('/health');
          setRouteProbeResults(results);
          setProbedAt(new Date());
          break;
        }
      }
    } catch (e) {
      console.error('Re-check error:', e);
    } finally {
      setRechecking(prev => {
        const next = new Set(prev);
        next.delete(checkName);
        return next;
      });
    }
  }, [queryClient, activeOrganizationId, navigate]);

  const dataLoading = coverageLoading || qualityLoading || feedLoading;
  const orgName = activeOrganization?.name ?? 'Organization';

  // Derived values
  const coveragePercent: number | null = coverageData?.coverage_percent ?? null;

  const issuesCount: number | null = useMemo(() => {
    if (!qualityData || !Array.isArray(qualityData)) return null;
    return qualityData.filter((r: any) => {
      const issues = r.issues ?? r.issue_count ?? 0;
      return Array.isArray(issues) ? issues.length > 0 : Number(issues) > 0;
    }).length;
  }, [qualityData]);

  const latestSnapshotDate = feedData?.latest_snapshot_date ?? null;
  const asOf = coverageUpdatedAt ? new Date(coverageUpdatedAt) : new Date();

  // ── Build checks ──────────────────────────────────────────────────

  const checks = useMemo((): HealthCheckResult[] => {
    const results: HealthCheckResult[] = [];

    // 1. Access & Role Gate
    results.push({
      name: 'access',
      status: 'pass' as CheckStatus,
      label: 'Access & Role Gate',
      detail: `${isAdmin ? 'Admin' : 'PM'} access confirmed for ${orgName}.`,
    });

    // 2. Snapshot Freshness
    if (coverageError) {
      results.push({ name: 'snapshot_freshness', status: 'fail', label: 'Snapshot Freshness', detail: 'Coverage data unavailable.' });
    } else if (!coverageData) {
      results.push({ name: 'snapshot_freshness', status: 'warn', label: 'Snapshot Freshness', detail: 'Loading snapshot data...' });
    } else {
      // Check freshness based on latest snapshot across projects
      const latestProject = coverageData.projects
        ?.filter(p => p.latest_snapshot)
        .sort((a, b) => (b.latest_snapshot ?? '').localeCompare(a.latest_snapshot ?? ''))[0];

      if (!latestProject?.latest_snapshot) {
        results.push({ name: 'snapshot_freshness', status: 'fail', label: 'Snapshot Freshness', detail: 'No snapshots found.' });
      } else {
        const hoursSince = (Date.now() - new Date(latestProject.latest_snapshot).getTime()) / (1000 * 60 * 60);
        if (hoursSince <= 36) {
          results.push({ name: 'snapshot_freshness', status: 'pass', label: 'Snapshot Freshness', detail: `Latest snapshot: ${latestProject.latest_snapshot}. Within 36h.` });
        } else {
          results.push({ name: 'snapshot_freshness', status: 'warn', label: 'Snapshot Freshness', detail: `Latest snapshot: ${latestProject.latest_snapshot}. ${Math.round(hoursSince)}h ago — stale.` });
        }
      }
    }

    // 3. Snapshot Coverage
    if (coverageError) {
      results.push({ name: 'snapshot_coverage', status: 'fail', label: 'Snapshot Coverage', detail: 'Coverage data unavailable.' });
    } else if (coveragePercent === null) {
      results.push({ name: 'snapshot_coverage', status: 'warn', label: 'Snapshot Coverage', detail: 'Loading...' });
    } else if (coveragePercent >= 90) {
      results.push({ name: 'snapshot_coverage', status: 'pass', label: 'Snapshot Coverage', detail: `${coveragePercent}% of projects have snapshots.` });
    } else if (coveragePercent >= 70) {
      results.push({ name: 'snapshot_coverage', status: 'warn', label: 'Snapshot Coverage', detail: `${coveragePercent}% coverage — some projects missing snapshots.` });
    } else {
      results.push({ name: 'snapshot_coverage', status: 'fail', label: 'Snapshot Coverage', detail: `${coveragePercent}% coverage — significant gaps in snapshot data.` });
    }

    // 4. Data Quality
    if (qualityError) {
      results.push({ name: 'data_quality', status: 'fail', label: 'Data Quality', detail: 'Quality audit unavailable.' });
    } else if (issuesCount === null) {
      results.push({ name: 'data_quality', status: 'warn', label: 'Data Quality', detail: 'Loading...' });
    } else if (issuesCount <= 1) {
      results.push({ name: 'data_quality', status: 'pass', label: 'Data Quality', detail: `${issuesCount} project${issuesCount !== 1 ? 's' : ''} with issues. Data is clean.` });
    } else if (issuesCount <= 5) {
      results.push({ name: 'data_quality', status: 'warn', label: 'Data Quality', detail: `${issuesCount} projects with data quality issues.` });
    } else {
      results.push({ name: 'data_quality', status: 'fail', label: 'Data Quality', detail: `${issuesCount} projects with issues — conclusions may be unreliable.` });
    }

    // 5. Executive Intelligence
    if (feedError) {
      results.push({ name: 'exec_intelligence', status: 'warn', label: 'Executive Intelligence', detail: 'Change feed unavailable.' });
    } else if (!feedData) {
      results.push({ name: 'exec_intelligence', status: 'warn', label: 'Executive Intelligence', detail: 'Loading...' });
    } else {
      const hasChanges = (feedData.attention_ranked_projects?.length ?? 0) > 0 ||
        feedData.new_risks > 0 || feedData.resolved_risks > 0;
      if (hasChanges) {
        results.push({ name: 'exec_intelligence', status: 'pass', label: 'Executive Intelligence', detail: `Change feed active. ${feedData.attention_ranked_projects?.length ?? 0} projects ranked for attention.` });
      } else {
        results.push({ name: 'exec_intelligence', status: 'warn', label: 'Executive Intelligence', detail: 'Change feed returned no changes.' });
      }
    }

    // 6. UI Reliability
    if (!routeProbeResults) {
      results.push({ name: 'ui_reliability', status: 'warn', label: 'UI Reliability', detail: 'Not tested yet. Click "Run Health Check" to probe core routes.' });
    } else {
      const crashes = routeProbeResults.filter(r => r.crashed || r.errorCount > 0);
      const warns = routeProbeResults.filter(r => r.warnCount > 0 && r.errorCount === 0 && !r.crashed);
      if (crashes.length > 0) {
        results.push({ name: 'ui_reliability', status: 'fail', label: 'UI Reliability', detail: `${crashes.length} route${crashes.length > 1 ? 's' : ''} with errors: ${crashes.map(r => r.path).join(', ')}` });
      } else if (warns.length > 0) {
        results.push({ name: 'ui_reliability', status: 'warn', label: 'UI Reliability', detail: `${warns.length} route${warns.length > 1 ? 's' : ''} with warnings.` });
      } else {
        results.push({ name: 'ui_reliability', status: 'pass', label: 'UI Reliability', detail: `All ${HEALTH_PROBE_ROUTES.length} core routes loaded cleanly.` });
      }
    }

    return results;
  }, [isAdmin, orgName, coverageData, coverageError, coveragePercent, qualityError, issuesCount, feedData, feedError, routeProbeResults]);

  // ── Actions ───────────────────────────────────────────────────────

  const handleRunProbes = useCallback(async () => {
    setProbing(true);
    try {
      const results = await runLightweightRouteProbes(
        (path) => navigate(path),
        () => window.location.pathname,
      );
      // Navigate back
      navigate('/health');
      setRouteProbeResults(results);
      setProbedAt(new Date());
    } catch (e) {
      console.error('Route probe error:', e);
    } finally {
      setProbing(false);
    }
  }, [navigate]);

  const actionCtx = useMemo((): ActionContext => ({
    orgId: activeOrganizationId ?? undefined,
    canViewDiagnostics,
    canViewExecutive,
  }), [activeOrganizationId, canViewDiagnostics, canViewExecutive]);

  const reportInput = useMemo(() => ({
    orgName,
    asOf,
    checks,
    coveragePercent,
    issuesCount,
    topAttentionProjects: feedData?.attention_ranked_projects?.slice(0, 3) ?? [],
  }), [orgName, asOf, checks, coveragePercent, issuesCount, feedData]);

  const handleExport = useCallback(() => {
    const report = buildHealthCheckReport(reportInput);
    downloadText(report, `health-check-${new Date().toISOString().slice(0, 10)}.txt`);
  }, [reportInput]);

  const handleCopy = useCallback(() => {
    const report = buildHealthCheckReport(reportInput);
    navigator.clipboard.writeText(report).then(() => toast.success('Report copied'));
  }, [reportInput]);

  // ── Render ────────────────────────────────────────────────────────

  const passCount = checks.filter(c => c.status === 'pass').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const failCount = checks.filter(c => c.status === 'fail').length;

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Production Health Check</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              System confidence report for <strong>{orgName}</strong>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleRunProbes} disabled={probing || dataLoading} variant="default" size="sm">
              {probing ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Probing…</>
              ) : (
                <><ShieldCheck className="h-4 w-4 mr-2" />Run Health Check</>
              )}
            </Button>
            {checks.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-1" />Copy
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const debugInfo = {
                    date: new Date().toISOString(),
                    orgId: activeOrganizationId,
                    orgName: activeOrganization?.name,
                    results: checks.length,
                    summary: {
                      pass: checks.filter(r => r.status === 'pass').length,
                      warn: checks.filter(r => r.status === 'warn').length,
                      fail: checks.filter(r => r.status === 'fail').length,
                    },
                    coverage: coveragePercent,
                    issues: issuesCount,
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                  };
                  navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
                  toast.success('Debug info copied to clipboard');
                }}>
                  <ShieldAlert className="h-4 w-4 mr-1" />Copy Debug Info
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-1" />Export
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Data confidence + quality — reuses cached queries, no extra fetches */}
        <DashboardMissionControl />

        {/* Confidence Ribbon */}
        <ConfidenceRibbon
          coveragePercent={coveragePercent}
          issuesCount={issuesCount}
          asOf={latestSnapshotDate ?? asOf}
        />

        {/* Summary badges */}
        {!dataLoading && (
          <div className="flex gap-3 flex-wrap">
            <Badge variant="default" className="text-sm px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{passCount} Pass
            </Badge>
            {warnCount > 0 && (
              <Badge variant="secondary" className="text-sm px-3 py-1">
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />{warnCount} Warning
              </Badge>
            )}
            {failCount > 0 && (
              <Badge variant="destructive" className="text-sm px-3 py-1">
                <XCircle className="h-3.5 w-3.5 mr-1" />{failCount} Fail
              </Badge>
            )}
          </div>
        )}

        {/* Scorecard grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {checks.map(check => (
            <Card key={check.name} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcon(check.status)}
                    <CardTitle className="text-sm font-semibold">{check.label}</CardTitle>
                  </div>
                  {statusBadge(check.status)}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{check.detail}</p>

                {/* Expandable details for specific checks */}
                {check.name === 'snapshot_coverage' && coverageData && coverageData.projects.length > 0 && (
                  <Collapsible className="mt-3">
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronDown className="h-3 w-3" />
                      View {coverageData.projects.length} projects
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-1">
                      {coverageData.projects.slice(0, 10).map(p => (
                        <div key={p.project_id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                          <span className="truncate">{p.project_name}</span>
                          <span className="font-mono text-muted-foreground shrink-0 ml-2">
                            {p.snapshot_count} snap{p.snapshot_count !== 1 ? 's' : ''}
                            {p.has_gap && <span className="text-destructive ml-1">(gap)</span>}
                          </span>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {check.name === 'exec_intelligence' && feedData?.attention_ranked_projects && feedData.attention_ranked_projects.length > 0 && (
                  <Collapsible className="mt-3">
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronDown className="h-3 w-3" />
                      Top attention projects
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-1">
                      {feedData.attention_ranked_projects.slice(0, 5).map(p => (
                        <div key={p.project_id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                          <span className="truncate">{p.project_name}</span>
                          <span className="font-mono text-muted-foreground shrink-0 ml-2">
                            score: {p.attention_score.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {check.name === 'ui_reliability' && routeProbeResults && (
                  <Collapsible className="mt-3">
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronDown className="h-3 w-3" />
                      Route details
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-1">
                      {routeProbeResults.map(r => (
                        <div key={r.path} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                          <span className="font-mono">{r.path}</span>
                          <span className="shrink-0 ml-2">
                            {r.crashed ? (
                              <span className="text-destructive">Crashed</span>
                            ) : r.errorCount > 0 ? (
                              <span className="text-destructive">{r.errorCount} error{r.errorCount > 1 ? 's' : ''}</span>
                            ) : r.warnCount > 0 ? (
                              <span className="text-accent-foreground">{r.warnCount} warn</span>
                            ) : (
                              <span className="text-primary">Clean</span>
                            )}
                          </span>
                        </div>
                      ))}
                      {probedAt && (
                        <p className="text-[10px] text-muted-foreground mt-2">
                          Probed at {probedAt.toISOString().slice(0, 19)}Z
                        </p>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Re-check + Action CTA for non-pass checks */}
                {check.status !== 'pass' && check.name !== 'access' && (
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      disabled={rechecking.has(check.name)}
                      onClick={() => handleRecheck(check.name)}
                    >
                      {rechecking.has(check.name) ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      Re-check
                    </Button>
                  </div>
                )}
                {check.status !== 'pass' && (() => {
                  const bundle = getActionsForHealthCheck(check.name, actionCtx);
                  return bundle ? <ActionRow bundle={bundle} /> : null;
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
