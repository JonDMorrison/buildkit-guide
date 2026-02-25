import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRouteAccess } from '@/hooks/useRouteAccess';
import { NoAccess } from '@/components/NoAccess';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Play, Download, Copy, ChevronDown, CheckCircle2, XCircle, ArrowRight, AlertTriangle, ShieldAlert } from 'lucide-react';
import { runSmokeTest, formatReport, getSmokeRoutes, getSmokeRoutesForRole, classifyResult, type RouteResult, type Severity } from '@/lib/uiSmokeRunner';
import { runProbesForRoute } from '@/lib/uiSmokeProbes';
import { downloadText } from '@/lib/downloadText';
import { SeverityBadge } from '@/components/SeverityBadge';
import type { RoleName } from '@/lib/routeInventory';
import { toast } from 'sonner';

// ── Gate ────────────────────────────────────────────────────────────────────

export default function AdminUISmokeRunner() {
  const { isAdmin, loading } = useRouteAccess();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return <NoAccess title="Admin Only" message="UI Smoke Runner requires admin access." />;
  }

  return <SmokeRunnerContent />;
}

// ── Severity helpers ──────────────────────────────────────────────────────

type TestProfile = 'admin' | 'pm' | 'foreman' | 'internal_worker';

const PROFILE_LABELS: Record<TestProfile, string> = {
  admin: 'Admin',
  pm: 'PM',
  foreman: 'Foreman',
  internal_worker: 'Worker',
};

function severityToVariant(severity: Severity): 'critical' | 'high' | 'medium' | 'low' {
  switch (severity) {
    case 'BLOCKER': return 'critical';
    case 'MAJOR': return 'high';
    case 'MINOR': return 'medium';
    case 'INFO': return 'low';
  }
}

// ── Content ────────────────────────────────────────────────────────────────

function SmokeRunnerContent() {
  const navigate = useNavigate();
  const [results, setResults] = useState<RouteResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [testProfile, setTestProfile] = useState<TestProfile>('admin');

  const routes = testProfile === 'admin' ? getSmokeRoutes() : getSmokeRoutesForRole(testProfile as RoleName);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setResults([]);
    setProgress({ completed: 0, total: routes.length });

    try {
      const roleParam = testProfile === 'admin' ? undefined : testProfile as RoleName;
      const allResults = await runSmokeTest({
        navigate: (path) => navigate(path),
        getPathname: () => window.location.pathname,
        timeoutMs: 3000,
        onProgress: (completed, total, current) => {
          setProgress({ completed, total });
          setResults(prev => [...prev, current]);
        },
        runProbes: runProbesForRoute,
        testRole: roleParam,
      });

      // Navigate back to the smoke runner page
      navigate('/admin/ui-smoke');
      setResults(allResults);
    } catch (e: any) {
      console.error('Smoke runner error:', e);
    } finally {
      setRunning(false);
    }
  }, [navigate, routes.length, testProfile]);

  const handleExport = useCallback(() => {
    const roleParam = testProfile === 'admin' ? undefined : testProfile as RoleName;
    const report = formatReport(results, roleParam);
    downloadText(report, `ui-smoke-report-${testProfile}-${new Date().toISOString().slice(0, 10)}.txt`);
  }, [results, testProfile]);

  const handleCopyReport = useCallback(() => {
    const roleParam = testProfile === 'admin' ? undefined : testProfile as RoleName;
    const report = formatReport(results, roleParam);
    navigator.clipboard.writeText(report).then(() => {
      toast.success('Report copied to clipboard');
    });
  }, [results, testProfile]);

  const toggleRow = (path: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const redirected = results.filter(r => r.status === 'redirect').length;
  const blockers = results.filter(r => r.severity === 'BLOCKER').length;
  const majors = results.filter(r => r.severity === 'MAJOR').length;
  const minors = results.filter(r => r.severity === 'MINOR').length;

  return (
    <Layout>
      <div className="container mx-auto py-8 space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">UI Smoke Runner</h1>
            <p className="text-sm text-muted-foreground">
              Navigates {routes.length} routes as <strong>{PROFILE_LABELS[testProfile]}</strong>, detects crashes & console errors.
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {/* Role profile selector */}
            <Select
              value={testProfile}
              onValueChange={(v) => setTestProfile(v as TestProfile)}
              disabled={running}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Test Profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="pm">PM</SelectItem>
                <SelectItem value="foreman">Foreman</SelectItem>
                <SelectItem value="internal_worker">Worker</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleRun} disabled={running}>
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run
                </>
              )}
            </Button>

            {results.length > 0 && (
              <>
                <Button variant="outline" onClick={handleCopyReport} size="sm">
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
                <Button variant="outline" onClick={handleExport} size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Progress */}
        {running && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Testing routes…</span>
                  <span>{progress.completed} / {progress.total}</span>
                </div>
                <Progress value={(progress.completed / Math.max(progress.total, 1)) * 100} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary with severity counts */}
        {results.length > 0 && !running && (
          <div className="flex gap-3 flex-wrap">
            <Badge variant="default" className="text-sm px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              {passed} passed
            </Badge>
            <Badge variant="destructive" className="text-sm px-3 py-1">
              <XCircle className="h-3.5 w-3.5 mr-1" />
              {failed} failed
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              <ArrowRight className="h-3.5 w-3.5 mr-1" />
              {redirected} redirected
            </Badge>
            {blockers > 0 && (
              <SeverityBadge severity="critical" label={`${blockers} Blocker${blockers > 1 ? 's' : ''}`} />
            )}
            {majors > 0 && (
              <SeverityBadge severity="high" label={`${majors} Major`} />
            )}
            {minors > 0 && (
              <SeverityBadge severity="medium" label={`${minors} Minor`} />
            )}
          </div>
        )}

        {/* Results table */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Results</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_80px_70px_80px_80px_1fr] gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                  <span>Route</span>
                  <span>Status</span>
                  <span>Severity</span>
                  <span>Duration</span>
                  <span>Errors</span>
                  <span>Notes</span>
                </div>
                {results.map(r => (
                  <Collapsible key={r.path} open={expandedRows.has(r.path)}>
                    <CollapsibleTrigger asChild>
                      <button
                        className="grid grid-cols-[1fr_80px_70px_80px_80px_1fr] gap-2 px-4 py-3 w-full text-left text-sm hover:bg-muted/20 transition-colors"
                        onClick={() => toggleRow(r.path)}
                      >
                        <span className="font-mono text-xs truncate">{r.path}</span>
                        <span>
                          {r.status === 'pass' && <Badge variant="default" className="text-xs">Pass</Badge>}
                          {r.status === 'fail' && <Badge variant="destructive" className="text-xs">Fail</Badge>}
                          {r.status === 'redirect' && <Badge variant="secondary" className="text-xs">Redir</Badge>}
                        </span>
                        <span>
                          <SeverityBadge severity={severityToVariant(r.severity)} label={r.severity} className="text-[10px]" />
                        </span>
                        <span className="text-muted-foreground">{r.durationMs}ms</span>
                        <span>
                          {r.consoleLogs.filter(l => l.level === 'error').length > 0 ? (
                            <span className="text-destructive font-medium">
                              {r.consoleLogs.filter(l => l.level === 'error').length}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {r.errorMessage && <span className="truncate">{r.errorMessage}</span>}
                          {r.finalPathname !== r.path && <span className="truncate">→ {r.finalPathname}</span>}
                          <ChevronDown className="h-3 w-3 ml-auto flex-shrink-0" />
                        </span>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 py-3 bg-muted/10 space-y-2 text-xs">
                        {r.consoleLogs.length > 0 ? (
                          <div className="space-y-1">
                            <p className="font-medium text-muted-foreground">Console logs ({r.consoleLogs.length}):</p>
                            {r.consoleLogs.map((log, i) => (
                              <div key={i} className="flex gap-2 font-mono">
                                <Badge variant={log.level === 'error' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5">
                                  {log.level}
                                </Badge>
                                <span className="break-all">{log.message.slice(0, 500)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground">No console logs captured.</p>
                        )}
                        {r.probeResults && r.probeResults.length > 0 && (
                          <div className="space-y-1 pt-2 border-t border-border/50">
                            <p className="font-medium text-muted-foreground">Button probes:</p>
                            {r.probeResults.map((p, i) => (
                              <div key={i} className="flex items-center gap-2">
                                {p.status === 'pass' && <CheckCircle2 className="h-3 w-3 text-primary" />}
                                {p.status === 'fail' && <XCircle className="h-3 w-3 text-destructive" />}
                                {p.status === 'skip' && <AlertTriangle className="h-3 w-3 text-muted-foreground" />}
                                <span>{p.name}: {p.status}</span>
                                {p.error && <span className="text-muted-foreground">({p.error})</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Route inventory */}
        {results.length === 0 && !running && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Route Inventory ({routes.length} routes for {PROFILE_LABELS[testProfile]})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-xs font-mono">
                {routes.map(r => (
                  <span key={r} className="text-muted-foreground">{r}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
