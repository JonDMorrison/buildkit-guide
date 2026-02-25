import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Play, ChevronDown, CheckCircle2, XCircle, AlertTriangle, Copy, Brain, Shield, Eye, Zap, Lock, RefreshCw, Microscope, Search, GitBranch, FileCheck, Activity, Camera, BarChart3, Filter, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from './DiagnosticsSection';

// ── Props ──────────────────────────────────────────────────────────────────

interface OSOperationsSectionProps {
  orgId: string | null;
  projects: { id: string; name: string }[];
  dbAuthOk: boolean;
  dbAuthLoading: boolean;
}

// ── Main Section ───────────────────────────────────────────────────────────

export default function OSOperationsSection({ orgId, projects, dbAuthOk, dbAuthLoading }: OSOperationsSectionProps) {
  // OS Operations state
  const [opsReleaseReport, setOpsReleaseReport] = useState<{ loading: boolean; data: any; error: string | null }>({ loading: false, data: null, error: null });
  const [opsSnapshot, setOpsSnapshot] = useState<{ loading: boolean; data: any; error: string | null }>({ loading: false, data: null, error: null });
  const [opsVolatility, setOpsVolatility] = useState<{ loading: boolean; data: any; error: string | null }>({ loading: false, data: null, error: null });
  const [showOnlyHighVolatility, setShowOnlyHighVolatility] = useState(false);
  const [opsCaptureAndRefresh, setOpsCaptureAndRefresh] = useState(false);
  const [opsReleaseRawOpen, setOpsReleaseRawOpen] = useState(false);
  const [opsExecReport, setOpsExecReport] = useState<{ loading: boolean; data: any; error: string | null }>({ loading: false, data: null, error: null });
  const [opsDataQuality, setOpsDataQuality] = useState<{ data: any; error: string | null }>({ data: null, error: null });
  const [opsChangeFeed, setOpsChangeFeed] = useState<{ loading: boolean; data: any; error: string | null }>({ loading: false, data: null, error: null });

  // Determinism Re-scan state
  const [detRunning, setDetRunning] = useState(false);
  const [detResult, setDetResult] = useState<{ violation_count: number; suspect_functions: { function_name: string; issue: string }[] } | null>(null);
  const [detError, setDetError] = useState<string | null>(null);

  // Release Report state (standalone)
  const [releaseProject, setReleaseProject] = useState<string>('');
  const [releaseRunning, setReleaseRunning] = useState(false);
  const [releaseResult, setReleaseResult] = useState<any>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseCopied, setReleaseCopied] = useState(false);

  // Fetch data quality audit on mount
  useEffect(() => {
    if (!orgId) return;
    (supabase.rpc as any)('rpc_data_quality_audit', { p_org_id: orgId })
      .then(({ data, error }: any) => {
        setOpsDataQuality({ data: error ? null : data, error: error?.message || null });
      });
  }, [orgId]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleOpsReleaseReport = async () => {
    if (!orgId || !dbAuthOk) return;
    setOpsReleaseReport({ loading: true, data: null, error: null });
    try {
      const { data, error: rpcErr } = await (supabase as any).rpc('rpc_get_os_brain_release_report', { p_org_id: orgId });
      if (rpcErr) setOpsReleaseReport({ loading: false, data: null, error: rpcErr.message });
      else setOpsReleaseReport({ loading: false, data, error: null });
    } catch (e: any) { setOpsReleaseReport({ loading: false, data: null, error: e.message }); }
  };

  const handleOpsCaptureSnapshots = async (force = true) => {
    if (!orgId || !dbAuthOk) return;
    setOpsSnapshot({ loading: true, data: null, error: null });
    try {
      const { data, error: rpcErr } = await (supabase as any).rpc('rpc_capture_org_economic_snapshots', { p_org_id: orgId, p_force: force });
      if (rpcErr) setOpsSnapshot({ loading: false, data: null, error: rpcErr.message });
      else setOpsSnapshot({ loading: false, data, error: null });
    } catch (e: any) { setOpsSnapshot({ loading: false, data: null, error: e.message }); }
  };

  const handleOpsVolatility = async () => {
    if (!orgId || !dbAuthOk) return;
    setOpsVolatility({ loading: true, data: null, error: null });
    try {
      const { data, error: rpcErr } = await (supabase as any).rpc('rpc_get_project_volatility_index', { p_org_id: orgId, p_days: 30 });
      if (rpcErr) setOpsVolatility({ loading: false, data: null, error: rpcErr.message });
      else setOpsVolatility({ loading: false, data, error: null });
    } catch (e: any) { setOpsVolatility({ loading: false, data: null, error: e.message }); }
  };

  const handleOpsChangeFeed = async () => {
    if (!orgId || !dbAuthOk) return;
    setOpsChangeFeed({ loading: true, data: null, error: null });
    try {
      const { data, error: rpcErr } = await (supabase as any).rpc('rpc_executive_change_feed', { p_org_id: orgId });
      if (rpcErr) setOpsChangeFeed({ loading: false, data: null, error: rpcErr.message });
      else setOpsChangeFeed({ loading: false, data, error: null });
    } catch (e: any) { setOpsChangeFeed({ loading: false, data: null, error: e.message }); }
  };

  const handleOpsCaptureAndRefresh = async () => {
    if (!orgId || !dbAuthOk) return;
    setOpsCaptureAndRefresh(true);
    setOpsSnapshot({ loading: true, data: null, error: null });
    try {
      const { data: snapData, error: snapErr } = await (supabase as any).rpc('rpc_capture_org_economic_snapshots', { p_org_id: orgId, p_force: true });
      if (snapErr) {
        setOpsSnapshot({ loading: false, data: null, error: snapErr.message });
        setOpsCaptureAndRefresh(false);
        return;
      }
      setOpsSnapshot({ loading: false, data: snapData, error: null });
    } catch (e: any) {
      setOpsSnapshot({ loading: false, data: null, error: e.message });
      setOpsCaptureAndRefresh(false);
      return;
    }
    setOpsVolatility({ loading: true, data: null, error: null });
    try {
      const { data: volData, error: volErr } = await (supabase as any).rpc('rpc_get_project_volatility_index', { p_org_id: orgId, p_days: 30 });
      if (volErr) setOpsVolatility({ loading: false, data: null, error: volErr.message });
      else setOpsVolatility({ loading: false, data: volData, error: null });
    } catch (e: any) { setOpsVolatility({ loading: false, data: null, error: e.message }); }
    finally { setOpsCaptureAndRefresh(false); }
  };

  const handleOpsExecReport = async () => {
    if (!orgId || !dbAuthOk) return;
    setOpsExecReport({ loading: true, data: null, error: null });
    try {
      const { data, error: rpcErr } = await (supabase as any).rpc('rpc_generate_executive_report', { p_org_id: orgId });
      if (rpcErr) setOpsExecReport({ loading: false, data: null, error: rpcErr.message });
      else setOpsExecReport({ loading: false, data, error: null });
    } catch (e: any) { setOpsExecReport({ loading: false, data: null, error: e.message }); }
  };

  const handleDetRescan = async () => {
    setDetRunning(true);
    setDetError(null);
    setDetResult(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc('rpc_get_os_system_inventory');
      if (rpcError) { setDetError(rpcError.message); return; }
      const scan = data?.aggregation_determinism_scan;
      if (!scan) { setDetError('aggregation_determinism_scan missing from response'); return; }
      setDetResult({
        violation_count: scan.violation_count ?? 0,
        suspect_functions: scan.suspect_functions ?? [],
      });
    } catch (e: any) { setDetError(e.message); }
    finally { setDetRunning(false); }
  };

  const handleReleaseReport = async () => {
    if (!orgId || !dbAuthOk) return;
    setReleaseRunning(true);
    setReleaseError(null);
    setReleaseResult(null);
    try {
      const params: Record<string, string> = { p_org_id: orgId };
      if (releaseProject && releaseProject !== '__auto__') params.p_project_id = releaseProject;
      const { data, error: rpcErr } = await (supabase as any).rpc('rpc_get_os_brain_release_report', params);
      if (rpcErr) setReleaseError(rpcErr.message);
      else setReleaseResult(data);
    } catch (e: any) { setReleaseError(e.message); }
    finally { setReleaseRunning(false); }
  };

  const handleCopyRelease = () => {
    if (!releaseResult) return;
    navigator.clipboard.writeText(JSON.stringify(releaseResult, null, 2));
    setReleaseCopied(true);
    setTimeout(() => setReleaseCopied(false), 2000);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ─── OS Operations ───────────────────────────────────── */}
      <div className="border-t pt-6 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">OS Operations</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manual operations: capture snapshots, run release reports, and view volatility metrics.
          </p>
        </div>

        {/* Data Quality Warning */}
        {(() => {
          const count = opsDataQuality.data?.totals?.missing_revenue_count;
          if (!count || count <= 0) return null;
          const projectIds: string[] = opsDataQuality.data?.missing_revenue || [];
          return (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium text-destructive">
                    Economic analysis incomplete: revenue data missing for {count} project{count > 1 ? 's' : ''}.
                  </p>
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button size="sm" variant="outline" className="text-xs">
                        <Search className="h-3 w-3 mr-1.5" />
                        Inspect Projects
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="bg-muted/50 rounded p-3 space-y-1 max-h-48 overflow-auto">
                        {projectIds.map((pid: string) => {
                          const proj = projects.find(p => p.id === pid);
                          return (
                            <div key={pid} className="text-xs font-mono flex items-center gap-2">
                              <span className="text-muted-foreground">•</span>
                              <span>{proj ? proj.name : pid}</span>
                            </div>
                          );
                        })}
                        {projectIds.length === 0 && (
                          <span className="text-xs text-muted-foreground">No project IDs returned.</span>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" onClick={handleOpsReleaseReport} disabled={opsReleaseReport.loading || !dbAuthOk || !orgId}>
            <FileCheck className="h-4 w-4 mr-1.5" />
            {opsReleaseReport.loading ? 'Running…' : 'Run Release Report'}
          </Button>
          <Button size="sm" onClick={() => handleOpsCaptureSnapshots(true)} disabled={opsSnapshot.loading || !dbAuthOk || !orgId}>
            <Camera className="h-4 w-4 mr-1.5" />
            {opsSnapshot.loading ? 'Capturing…' : 'Capture Org Snapshots'}
          </Button>
          <Button size="sm" onClick={handleOpsVolatility} disabled={opsVolatility.loading || !dbAuthOk || !orgId}>
            <BarChart3 className="h-4 w-4 mr-1.5" />
            {opsVolatility.loading ? 'Loading…' : 'View Volatility (30d)'}
          </Button>
          <Button size="sm" onClick={handleOpsExecReport} disabled={opsExecReport.loading || !dbAuthOk || !orgId}>
            <Brain className="h-4 w-4 mr-1.5" />
            {opsExecReport.loading ? 'Generating…' : 'Executive Report'}
          </Button>
          <Button size="sm" onClick={handleOpsChangeFeed} disabled={opsChangeFeed.loading || !dbAuthOk || !orgId}>
            <TrendingUp className="h-4 w-4 mr-1.5" />
            {opsChangeFeed.loading ? 'Running…' : 'Run Executive Brief'}
          </Button>
        </div>

        {/* Executive Change Feed Panel */}
        {opsChangeFeed.error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded text-destructive text-xs">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{opsChangeFeed.error}</span>
          </div>
        )}
        {opsChangeFeed.data && (() => {
          const d = opsChangeFeed.data;
          if (d?.status === 'not_enough_history') {
            return (
              <Card className="border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Executive Brief</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Collect one more snapshot to activate change detection.</p>
                </CardContent>
              </Card>
            );
          }
          const changes = d?.changes || {};
          const topChanges = d?.top_changes || [];
          return (
            <Card className="border">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Executive Brief</span>
                  </div>
                  <StatusBadge ok={d?.success === true} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">New Risks</span><div className="font-medium text-destructive">{changes.new_risks_count ?? 0}</div></div>
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Resolved Risks</span><div className="font-medium text-primary">{changes.resolved_risks_count ?? 0}</div></div>
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Improving</span><div className="font-medium text-primary">{changes.improving_count ?? 0}</div></div>
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Worsening</span><div className="font-medium text-destructive">{changes.worsening_count ?? 0}</div></div>
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Burn ↑</span><div className="font-medium">{changes.burn_increase_count ?? 0}</div></div>
                </div>

                {topChanges.length > 0 && (
                  <div className="text-xs space-y-1">
                    <span className="font-medium text-muted-foreground">Top 5 Project Changes</span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b text-muted-foreground">
                          <th className="text-left py-1 pr-2">Project</th>
                          <th className="text-right py-1 pr-2">Risk Δ</th>
                          <th className="text-right py-1 pr-2">Margin Δ</th>
                          <th className="text-right py-1 pr-2">Burn Δ</th>
                          <th className="text-right py-1">Current Risk</th>
                        </tr></thead>
                        <tbody>
                          {topChanges.map((r: any, i: number) => {
                            const proj = projects.find(p => p.id === r.project_id);
                            return (
                              <tr key={i} className="border-b border-muted">
                                <td className="py-1 pr-2">
                                  <TooltipProvider><Tooltip><TooltipTrigger>{proj ? proj.name : String(r.project_id).slice(0, 8) + '…'}</TooltipTrigger><TooltipContent><p className="font-mono text-xs">{r.project_id}</p></TooltipContent></Tooltip></TooltipProvider>
                                </td>
                                <td className={`text-right py-1 pr-2 font-medium ${r.risk_change > 0 ? 'text-destructive' : r.risk_change < 0 ? 'text-primary' : ''}`}>{r.risk_change > 0 ? '+' : ''}{r.risk_change}</td>
                                <td className={`text-right py-1 pr-2 ${r.margin_change > 0 ? 'text-primary' : r.margin_change < 0 ? 'text-destructive' : ''}`}>{r.margin_change > 0 ? '+' : ''}{r.margin_change}</td>
                                <td className={`text-right py-1 pr-2 ${r.burn_change > 0.05 ? 'text-destructive' : ''}`}>{r.burn_change > 0 ? '+' : ''}{r.burn_change}</td>
                                <td className="text-right py-1">{r.latest_risk_score}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">Compared to previous snapshot · {d.previous_snapshot_date} → {d.latest_snapshot_date}</p>
              </CardContent>
            </Card>
          );
        })()}

        {/* Executive Report Panel */}
        {opsExecReport.error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded text-destructive text-xs">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{opsExecReport.error}</span>
          </div>
        )}
        {opsExecReport.data && (() => {
          const d = opsExecReport.data;
          const summary = d?.summary || {};
          const topRisks = d?.top_risks || [];
          const unstable = d?.most_unstable_projects || [];
          const improving = d?.improving_projects || [];
          const exposure = d?.financial_exposure || {};
          const notes = d?.notes || [];
          return (
            <Card className="border">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Executive Report</span>
                  </div>
                  <StatusBadge ok={d?.success === true} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Projects</span><div className="font-medium">{summary.project_count ?? '—'}</div></div>
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">High Risk</span><div className="font-medium text-destructive">{summary.high_risk_projects ?? '—'}</div></div>
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Unstable</span><div className="font-medium">{summary.unstable_projects ?? '—'}</div></div>
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Improving</span><div className="font-medium text-primary">{summary.improving_projects ?? '—'}</div></div>
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Revenue at Risk</span><div className="font-medium text-destructive">{summary.revenue_at_risk_percent ?? 0}%</div></div>
                </div>

                <div className="text-xs space-y-1">
                  <span className="font-medium text-muted-foreground">Financial Exposure</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Total Revenue</span><div className="font-medium">${Number(exposure.total_projected_revenue || 0).toLocaleString()}</div></div>
                    <div className="bg-muted rounded p-2"><span className="text-muted-foreground">At Risk Revenue</span><div className="font-medium text-destructive">${Number(exposure.high_risk_projected_revenue || 0).toLocaleString()}</div></div>
                    <div className="bg-muted rounded p-2"><span className="text-muted-foreground">% at Risk</span><div className="font-medium">{exposure.revenue_at_risk_percent ?? 0}%</div></div>
                  </div>
                </div>

                {topRisks.length > 0 && (
                  <div className="text-xs space-y-1">
                    <span className="font-medium text-muted-foreground">Top Risk Projects</span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b text-muted-foreground">
                          <th className="text-left py-1 pr-2">Project</th>
                          <th className="text-right py-1 pr-2">Risk</th>
                          <th className="text-left py-1 pr-2">Position</th>
                          <th className="text-right py-1 pr-2">Proj Margin</th>
                          <th className="text-right py-1">Revenue</th>
                        </tr></thead>
                        <tbody>
                          {topRisks.map((r: any, i: number) => (
                            <tr key={i} className="border-b border-muted">
                              <td className="py-1 pr-2 font-mono">
                                <TooltipProvider><Tooltip><TooltipTrigger>{String(r.project_id).slice(0, 8)}…</TooltipTrigger><TooltipContent><p className="font-mono text-xs">{r.project_id}</p></TooltipContent></Tooltip></TooltipProvider>
                              </td>
                              <td className="text-right py-1 pr-2 text-destructive font-medium">{r.risk_score}</td>
                              <td className="py-1 pr-2">{r.economic_position}</td>
                              <td className="text-right py-1 pr-2">{r.projected_margin}%</td>
                              <td className="text-right py-1">${Number(r.projected_revenue || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Sorted by: risk_score DESC, project_id ASC (server)</p>
                  </div>
                )}

                {unstable.length > 0 && (
                  <div className="text-xs space-y-1">
                    <span className="font-medium text-muted-foreground">Most Unstable Projects</span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b text-muted-foreground">
                          <th className="text-left py-1 pr-2">Project</th>
                          <th className="text-right py-1 pr-2">Vol Score</th>
                          <th className="text-left py-1 pr-2">Label</th>
                          <th className="text-right py-1">Risk</th>
                        </tr></thead>
                        <tbody>
                          {unstable.map((u: any, i: number) => (
                            <tr key={i} className="border-b border-muted">
                              <td className="py-1 pr-2 font-mono">
                                <TooltipProvider><Tooltip><TooltipTrigger>{String(u.project_id).slice(0, 8)}…</TooltipTrigger><TooltipContent><p className="font-mono text-xs">{u.project_id}</p></TooltipContent></Tooltip></TooltipProvider>
                              </td>
                              <td className="text-right py-1 pr-2 font-medium">{u.volatility_score}</td>
                              <td className={`py-1 pr-2 ${u.volatility_label === 'critical' ? 'text-destructive' : ''}`}>{u.volatility_label}</td>
                              <td className="text-right py-1">{u.latest_risk_score}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Sorted by: volatility_score DESC, project_id ASC (server)</p>
                  </div>
                )}

                {improving.length > 0 && (
                  <div className="text-xs space-y-1">
                    <span className="font-medium text-muted-foreground">Improving Projects</span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b text-muted-foreground">
                          <th className="text-left py-1 pr-2">Project</th>
                          <th className="text-right py-1 pr-2">Oldest Risk</th>
                          <th className="text-right py-1 pr-2">Latest Risk</th>
                          <th className="text-right py-1">Δ Improvement</th>
                        </tr></thead>
                        <tbody>
                          {improving.map((p: any, i: number) => (
                            <tr key={i} className="border-b border-muted">
                              <td className="py-1 pr-2 font-mono">
                                <TooltipProvider><Tooltip><TooltipTrigger>{String(p.project_id).slice(0, 8)}…</TooltipTrigger><TooltipContent><p className="font-mono text-xs">{p.project_id}</p></TooltipContent></Tooltip></TooltipProvider>
                              </td>
                              <td className="text-right py-1 pr-2">{p.risk_oldest}</td>
                              <td className="text-right py-1 pr-2 text-primary">{p.risk_latest}</td>
                              <td className="text-right py-1 font-medium text-primary">+{p.improvement_delta}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Sorted by: improvement_delta DESC, project_id ASC (server)</p>
                  </div>
                )}

                {notes.length > 0 && (
                  <div className="text-xs space-y-1">
                    <span className="font-medium text-muted-foreground">Notes</span>
                    <ul className="list-disc list-inside space-y-0.5">
                      {notes.map((n: string, i: number) => <li key={i}>{n}</li>)}
                    </ul>
                  </div>
                )}

                <Collapsible>
                  <CollapsibleTrigger className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
                    <ChevronDown className="h-3 w-3" /> Raw JSON
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="p-3 mt-2 bg-muted rounded text-[10px] whitespace-pre-wrap max-h-60 overflow-auto font-mono">
                      {JSON.stringify(d, null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          );
        })()}

        {/* Release Report Panel */}
        {opsReleaseReport.error && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-sm text-destructive">{opsReleaseReport.error}</span>
            </CardContent>
          </Card>
        )}
        {opsReleaseReport.data && (() => {
          const rr = opsReleaseReport.data;
          const ok = rr?.success === true;
          const whyFailed = Array.isArray(rr?.why_failed) ? rr.why_failed : [];
          const skippedSections = Array.isArray(rr?.skipped_sections) ? rr.skipped_sections : [];
          const hasCredibilityFail = whyFailed.some((f: string) => f?.includes?.('economic_inputs_not_credible'));
          const hasDdlFail = whyFailed.some((f: string) => f?.includes?.('nonvolatile_ddl_detected'));
          return (
            <Card className={`border ${ok ? 'border-primary/30' : 'border-destructive/30'}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusBadge ok={ok} />
                  <span className="text-xs text-muted-foreground">Mode: <span className="font-mono font-medium text-foreground">{rr?.evaluation_mode ?? '—'}</span></span>
                  <span className="text-xs text-muted-foreground">Version: <span className="font-mono font-medium text-foreground">{rr?.version ?? '—'}</span></span>
                  {rr?.sample_project_id && (
                    <span className="text-xs text-muted-foreground">Sample: <span className="font-mono">{String(rr.sample_project_id).slice(0, 8)}…</span></span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-medium mb-1">Why Failed</p>
                    {whyFailed.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5 text-destructive">
                        {whyFailed.map((f: string, i: number) => <li key={i}>{f}</li>)}
                      </ul>
                    ) : <p className="text-muted-foreground italic">none</p>}
                  </div>
                  <div>
                    <p className="font-medium mb-1">Skipped Sections</p>
                    {skippedSections.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                        {skippedSections.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                    ) : <p className="text-muted-foreground italic">none</p>}
                  </div>
                </div>
                {!ok && (hasCredibilityFail || hasDdlFail) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {hasCredibilityFail && (
                      <Button size="sm" variant="outline" onClick={() => handleOpsCaptureSnapshots(true)} disabled={opsSnapshot.loading}>
                        <Camera className="h-3.5 w-3.5 mr-1.5" />
                        {opsSnapshot.loading ? 'Capturing…' : 'Capture Snapshots Now'}
                      </Button>
                    )}
                    {hasDdlFail && (
                      <Button size="sm" variant="outline" onClick={() => setOpsReleaseRawOpen(true)}>
                        <Eye className="h-3.5 w-3.5 mr-1.5" /> View Offenders in Raw JSON
                      </Button>
                    )}
                  </div>
                )}
                <Collapsible open={opsReleaseRawOpen} onOpenChange={setOpsReleaseRawOpen}>
                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ChevronDown className="h-3 w-3" /> Raw JSON
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="mt-1 p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-72 overflow-auto font-mono">
                      {JSON.stringify(rr, null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          );
        })()}

        {/* Snapshot Capture Panel */}
        {opsSnapshot.error && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-sm text-destructive">{opsSnapshot.error}</span>
            </CardContent>
          </Card>
        )}
        {opsSnapshot.data && (() => {
          const snap = opsSnapshot.data;
          const ok = snap?.success === true;
          const results = Array.isArray(snap?.results) ? snap.results.slice(0, 10) : [];
          return (
            <Card className={`border ${ok ? 'border-primary/30' : 'border-destructive/30'}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusBadge ok={ok} />
                  {snap?.skipped && <Badge variant="outline" className="text-[10px] border-yellow-500/50 text-yellow-600">SKIPPED</Badge>}
                  {snap?.already_captured_today && <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-600">Already captured today</Badge>}
                  <span className="text-xs text-muted-foreground">Date: <span className="font-mono font-medium text-foreground">{snap?.snapshot_date ?? '—'}</span></span>
                  <span className="text-xs text-muted-foreground">Mode: <span className="font-mono font-medium text-foreground">{snap?.selection_mode ?? '—'}</span></span>
                  <span className="text-xs text-muted-foreground">Projects: <span className="font-mono font-medium text-foreground">{snap?.project_count ?? '—'}</span></span>
                  <span className="text-xs text-muted-foreground">Inserted: <span className="font-mono font-medium text-foreground">{snap?.inserted_count ?? '—'}</span></span>
                  <span className="text-xs text-muted-foreground">Updated: <span className="font-mono font-medium text-foreground">{snap?.updated_count ?? '—'}</span></span>
                </div>
                {results.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-1 pr-2">project_id</th>
                          <th className="text-left py-1 pr-2">inserted</th>
                          <th className="text-left py-1 pr-2">updated</th>
                          <th className="text-left py-1 pr-2">flags_hash</th>
                          <th className="text-left py-1 pr-2">success</th>
                          <th className="text-left py-1">message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r: any, i: number) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-1 pr-2 font-mono">
                              <TooltipProvider><Tooltip><TooltipTrigger asChild><span className="cursor-help">{String(r?.project_id ?? '').slice(0, 8)}…</span></TooltipTrigger><TooltipContent><p className="font-mono text-xs">{r?.project_id}</p></TooltipContent></Tooltip></TooltipProvider>
                            </td>
                            <td className="py-1 pr-2">{r?.inserted != null ? String(r.inserted) : '—'}</td>
                            <td className="py-1 pr-2">{r?.updated != null ? String(r.updated) : '—'}</td>
                            <td className="py-1 pr-2 font-mono">
                              <TooltipProvider><Tooltip><TooltipTrigger asChild><span className="cursor-help">{String(r?.flags_hash ?? '').slice(0, 8)}</span></TooltipTrigger><TooltipContent><p className="font-mono text-xs">{r?.flags_hash}</p></TooltipContent></Tooltip></TooltipProvider>
                            </td>
                            <td className="py-1 pr-2">{r?.success != null ? String(r.success) : '—'}</td>
                            <td className="py-1 text-muted-foreground">{r?.message_text ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Sorted by: project_id ASC (server)
                      {results.length > 0 && <> · First: <span className="font-mono">{String(results[0]?.project_id ?? '').slice(0, 8)}</span> · Last: <span className="font-mono">{String(results[results.length - 1]?.project_id ?? '').slice(0, 8)}</span></>}
                    </p>
                  </div>
                )}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ChevronDown className="h-3 w-3" /> Raw JSON
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="mt-1 p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-72 overflow-auto font-mono">
                      {JSON.stringify(snap, null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          );
        })()}

        {/* Volatility Panel */}
        {opsVolatility.error && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-sm text-destructive">{opsVolatility.error}</span>
            </CardContent>
          </Card>
        )}
        {opsVolatility.data && (() => {
          const vol = opsVolatility.data;
          const ok = vol?.success === true;
          const allProjects: any[] = vol?.projects ?? [];
          const displayed = showOnlyHighVolatility
            ? allProjects.filter((p: any) => p?.volatility_label === 'volatile' || p?.volatility_label === 'critical')
            : allProjects;
          const insufficientCount = allProjects.filter((p: any) => (p?.snapshot_count ?? 0) < 2).length;
          const insufficientPct = allProjects.length > 0 ? insufficientCount / allProjects.length : 0;
          const newestDate = allProjects.reduce((max: string, p: any) => {
            const d = p?.latest_snapshot_date ?? '';
            return d > max ? d : max;
          }, '');
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().slice(0, 10);
          const isSparse = allProjects.length > 0 && insufficientPct > 0.30;
          const isStale = newestDate !== '' && newestDate < yesterdayStr;
          const isEmpty = allProjects.length === 0 && ok;
          const showCoverageWarning = isEmpty || isSparse || isStale;

          return (
            <Card className={`border ${ok ? 'border-primary/30' : 'border-destructive/30'}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusBadge ok={ok} />
                    <span className="text-xs text-muted-foreground">Window: <span className="font-mono font-medium text-foreground">{vol?.window_days ?? '—'}d</span></span>
                    <span className="text-xs text-muted-foreground">As of: <span className="font-mono font-medium text-foreground">{vol?.as_of ?? '—'}</span></span>
                    <span className="text-xs text-muted-foreground">Projects: <span className="font-mono font-medium text-foreground">{vol?.project_count ?? '—'}</span></span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpsCaptureAndRefresh}
                    disabled={opsCaptureAndRefresh || opsSnapshot.loading || opsVolatility.loading || !dbAuthOk || !orgId}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${opsCaptureAndRefresh ? 'animate-spin' : ''}`} />
                    {opsCaptureAndRefresh ? 'Capturing + Refreshing…' : 'Capture + Refresh'}
                  </Button>
                </div>
                {showCoverageWarning && (
                  <Card className="border-yellow-500/30 bg-yellow-500/5">
                    <CardContent className="p-3 space-y-1">
                      {isEmpty && (
                        <p className="text-xs text-yellow-700 dark:text-yellow-400 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> No projects returned. Capture snapshots to populate volatility data.
                        </p>
                      )}
                      {isSparse && (
                        <p className="text-xs text-yellow-700 dark:text-yellow-400 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Volatility is based on sparse snapshots ({insufficientCount}/{allProjects.length} projects have &lt;2 snapshots). Capture snapshots to improve accuracy.
                        </p>
                      )}
                      {isStale && (
                        <p className="text-xs text-yellow-700 dark:text-yellow-400 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Latest snapshots are stale (newest is {newestDate}). Capture snapshots now.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
                <div className="flex items-center gap-2 text-xs">
                  <Filter className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Show only volatile/critical</span>
                  <Switch checked={showOnlyHighVolatility} onCheckedChange={setShowOnlyHighVolatility} />
                </div>
                {displayed.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-1 pr-2">project_id</th>
                          <th className="text-left py-1 pr-2">score</th>
                          <th className="text-left py-1 pr-2">label</th>
                          <th className="text-left py-1 pr-2">latest_date</th>
                          <th className="text-left py-1 pr-2">risk</th>
                          <th className="text-left py-1 pr-2">proj_margin</th>
                          <th className="text-left py-1 pr-2">real_margin</th>
                          <th className="text-left py-1">flags_Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayed.map((p: any, i: number) => {
                          const labelColor = p?.volatility_label === 'critical' ? 'text-destructive font-semibold'
                            : p?.volatility_label === 'volatile' ? 'text-orange-500 font-semibold'
                            : p?.volatility_label === 'watch' ? 'text-yellow-600'
                            : 'text-muted-foreground';
                          return (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-1 pr-2 font-mono">
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><span className="cursor-help">{String(p?.project_id ?? '').slice(0, 8)}…</span></TooltipTrigger><TooltipContent><p className="font-mono text-xs">{p?.project_id}</p></TooltipContent></Tooltip></TooltipProvider>
                              </td>
                              <td className="py-1 pr-2 font-mono">{p?.volatility_score ?? '—'}</td>
                              <td className={`py-1 pr-2 ${labelColor}`}>{p?.volatility_label ?? '—'}</td>
                              <td className="py-1 pr-2 font-mono">{p?.latest_snapshot_date ?? '—'}</td>
                              <td className="py-1 pr-2 font-mono">{p?.latest_risk_score ?? '—'}</td>
                              <td className="py-1 pr-2 font-mono">{p?.latest_projected_margin ?? '—'}</td>
                              <td className="py-1 pr-2 font-mono">{p?.latest_realized_margin ?? '—'}</td>
                              <td className="py-1 font-mono">{p?.flags_changes_count ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Sorted by: volatility_score DESC, latest_snapshot_date DESC, project_id ASC (server)
                      {displayed.length > 0 && <> · First: <span className="font-mono">{String(displayed[0]?.project_id ?? '').slice(0, 8)}</span> · Last: <span className="font-mono">{String(displayed[displayed.length - 1]?.project_id ?? '').slice(0, 8)}</span></>}
                    </p>
                  </div>
                )}
                {displayed.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    {showOnlyHighVolatility ? 'No volatile/critical projects found.' : 'No projects in volatility index.'}
                  </p>
                )}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ChevronDown className="h-3 w-3" /> Raw JSON
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="mt-1 p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-72 overflow-auto font-mono">
                      {JSON.stringify(vol, null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* ─── Determinism Patch Runner ─────────────────────────────── */}
      <div className="border-t pt-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Determinism Patch Runner</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Re-runs <code className="font-mono">rpc_get_os_system_inventory</code> and renders only the{' '}
              <code className="font-mono">aggregation_determinism_scan</code> — use this to confirm{' '}
              the <code className="font-mono">rpc_time_diagnostics_summary</code> patch removed the genuine hit.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDetRescan}
            disabled={detRunning || !dbAuthOk}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${detRunning ? 'animate-spin' : ''}`} />
            {detRunning ? 'Scanning…' : 'Re-run OS Inventory'}
          </Button>
        </div>

        {!dbAuthOk && !dbAuthLoading && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-sm text-destructive">DB auth required — please refresh or log in first.</span>
            </CardContent>
          </Card>
        )}

        {detError && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-3 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-sm text-destructive font-mono">{detError}</span>
            </CardContent>
          </Card>
        )}

        {detResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${
                detResult.violation_count === 0
                  ? 'bg-green-500/10 text-green-700 border-green-500/30'
                  : 'bg-destructive/10 text-destructive border-destructive/30'
              }`}>
                {detResult.violation_count === 0
                  ? <CheckCircle2 className="h-4 w-4" />
                  : <AlertTriangle className="h-4 w-4" />}
                {detResult.violation_count} violation{detResult.violation_count !== 1 ? 's' : ''} detected
              </div>
              {detResult.violation_count === 0 && (
                <span className="text-xs text-muted-foreground">Determinism hygiene confirmed ✓</span>
              )}
            </div>

            {detResult.suspect_functions.length > 0 ? (
              <Card className="border-warning/30">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Suspect Functions ({detResult.suspect_functions.length})
                  </p>
                  <div className="space-y-1.5">
                    {detResult.suspect_functions.map((fn, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 py-1 border-b border-border last:border-0">
                        <code className="text-xs font-mono text-foreground">{fn.function_name}</code>
                        <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-muted text-muted-foreground border border-border shrink-0">
                          {fn.issue}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <p className="text-xs text-muted-foreground italic">No suspect functions — all aggregations are deterministic.</p>
            )}
          </div>
        )}
      </div>

      {/* ─── OS Brain Release Report ─────────────────────────── */}
      <div className="border-t pt-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">OS Brain Release Report</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Post-build verification for risk decomposition, revenue exposure metrics, and hard guardrail enforcement.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {releaseResult && (
              <Button variant="outline" size="sm" onClick={handleCopyRelease}>
                <Copy className="h-4 w-4 mr-1.5" />
                {releaseCopied ? 'Copied!' : 'Copy JSON'}
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleReleaseReport}
              disabled={releaseRunning || !dbAuthOk || !orgId}
            >
              <Play className="h-4 w-4 mr-1.5" />
              {releaseRunning ? 'Running…' : 'Run Release Report'}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <label className="text-sm font-medium mb-1 block">Project (optional — auto-selects first active)</label>
            <Select value={releaseProject} onValueChange={setReleaseProject}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Auto-detect first active project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__auto__">Auto-detect</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {releaseError && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-sm text-destructive font-mono">{releaseError}</span>
            </CardContent>
          </Card>
        )}

        {releaseResult && (() => {
          const rr = releaseResult;
          const checks = rr.checks ?? {};
          const failing: string[] = rr.failing_sections ?? [];
          const whyFailed: string[] = rr.why_failed ?? [];
          const skippedSections: string[] = rr.skipped_sections ?? [];
          const credCheck = checks.economic_inputs_credibility;

          const SECTION_META: { key: string; label: string; icon: typeof CheckCircle2 }[] = [
            { key: 'existence_and_security',         label: 'Check 1 — Existence + Security Posture',       icon: Shield },
            { key: 'wiring_and_shape_project',       label: 'Check 2 — Wiring & Shape (Project)',           icon: GitBranch },
            { key: 'wiring_and_shape_exec',          label: 'Check 3 — Wiring & Shape (Exec Summary)',      icon: Eye },
            { key: 'guardrail_enforcement_presence', label: 'Check 4 — Guardrail Enforcement (Static Scan)',icon: Lock },
            { key: 'determinism_hygiene',            label: 'Check 5 — Determinism Hygiene',                icon: Microscope },
            { key: 'smoke_tests_authenticated',      label: 'Check 6 — Authenticated Smoke Tests',          icon: Zap },
          ];

          const isSectionFailing = (key: string) => failing.includes(key);

          return (
            <div className="space-y-3">
              <Card className={rr.success ? 'border-primary/30' : 'border-destructive/30'}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    {rr.success
                      ? <Badge className="bg-primary/10 text-primary text-sm px-3 py-1"><CheckCircle2 className="h-4 w-4 mr-1.5" />SUCCESS</Badge>
                      : <Badge className="bg-destructive/10 text-destructive text-sm px-3 py-1"><XCircle className="h-4 w-4 mr-1.5" />FAILED</Badge>
                    }
                    <span className="text-xs text-muted-foreground font-mono">v{rr.version}</span>
                    <Badge variant="outline" className="text-xs font-mono">{rr.evaluation_mode ?? 'unknown'}</Badge>
                    {rr.project_id && <span className="text-xs text-muted-foreground font-mono">project: {String(rr.project_id).slice(0, 8)}…</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-medium text-muted-foreground">why_failed</span>
                      {whyFailed.length === 0
                        ? <p className="text-primary mt-0.5">— none —</p>
                        : <ul className="mt-0.5 space-y-0.5">{whyFailed.map(w => (
                            <li key={w} className="flex items-center gap-1 text-destructive"><XCircle className="h-3 w-3 shrink-0" /><span className="font-mono">{w}</span></li>
                          ))}</ul>
                      }
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">skipped_sections</span>
                      {skippedSections.length === 0
                        ? <p className="text-primary mt-0.5">— none —</p>
                        : <ul className="mt-0.5 space-y-0.5">{skippedSections.map(s => (
                            <li key={s} className="font-mono text-muted-foreground">{s}</li>
                          ))}</ul>
                      }
                    </div>
                  </div>
                </CardContent>
              </Card>

              {credCheck && (
                <Card className={credCheck.success ? 'border-primary/30 border' : 'border-destructive/30 border'}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">economic_inputs_credibility</span>
                      </div>
                      <StatusBadge ok={credCheck.success} />
                    </div>
                    {credCheck.message_text && (
                      <p className="text-xs text-muted-foreground font-mono">{credCheck.message_text}</p>
                    )}
                    {credCheck.evidence && (
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <ChevronDown className="h-3 w-3" /> Evidence JSON
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <pre className="mt-1 p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-60 overflow-auto font-mono">
                            {JSON.stringify(credCheck.evidence, null, 2)}
                          </pre>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </CardContent>
                </Card>
              )}

              {rr.self_tests && (
                <Card className={rr.self_tests.all_pass ? 'border-primary/30 border' : 'border-destructive/30 border'}>
                  <Collapsible>
                    <CollapsibleTrigger className="w-full">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Microscope className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">Self Tests</span>
                        </div>
                        <StatusBadge ok={rr.self_tests.all_pass} />
                      </CardContent>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4">
                        <pre className="p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-48 overflow-auto font-mono">
                          {JSON.stringify(rr.self_tests, null, 2)}
                        </pre>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              )}

              {!rr.success && failing.length > 0 && (
                <Card className="border-destructive bg-destructive/5">
                  <CardContent className="p-3">
                    <p className="text-xs font-semibold text-destructive mb-1">Failing sections:</p>
                    <ul className="space-y-0.5">
                      {failing.map((s: string) => (
                        <li key={s} className="flex items-center gap-1 text-xs text-destructive">
                          <XCircle className="h-3 w-3 shrink-0" /> <span className="font-mono">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {SECTION_META.map(({ key, label, icon: Icon }) => {
                const data = checks[key];
                const failing_section = isSectionFailing(key);
                const borderClass = failing_section ? 'border-destructive/30' : 'border-primary/30';
                return (
                  <Card key={key} className={`${borderClass} border`}>
                    <Collapsible>
                      <CollapsibleTrigger className="w-full">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {failing_section
                              ? <Badge className="bg-destructive/10 text-destructive text-xs"><XCircle className="h-3 w-3 mr-1" />FAIL</Badge>
                              : <Badge className="bg-primary/10 text-primary text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />PASS</Badge>
                            }
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4">
                          <pre className="p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-72 overflow-auto font-mono">
                            {JSON.stringify(data, null, 2)}
                          </pre>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })}

              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ChevronDown className="h-3 w-3" /> Raw Report JSON
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="mt-2 p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-96 overflow-auto font-mono">
                    {JSON.stringify(rr, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })()}
      </div>
    </>
  );
}
