import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Play, Download, ChevronDown, CheckCircle2, XCircle, AlertTriangle, Copy, Brain, Shield, Eye, Zap, Lock, RefreshCw, User, FlaskConical, ExternalLink, Microscope, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';

// --- Sub-components ---

function StatusBadge({ ok }: { ok: boolean }) {
  return ok
    ? <Badge className="bg-primary/10 text-primary text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />PASS</Badge>
    : <Badge className="bg-destructive/10 text-destructive text-xs"><XCircle className="h-3 w-3 mr-1" />FAIL</Badge>;
}

type SectionStatus = 'pass' | 'fail' | 'pending';

interface SectionResult {
  label: string;
  icon: typeof CheckCircle2;
  status: SectionStatus;
  details: Record<string, any>;
}

function SectionCard({ section }: { section: SectionResult }) {
  const Icon = section.icon;
  const borderClass = section.status === 'pass'
    ? 'border-primary/30'
    : section.status === 'fail'
    ? 'border-destructive/30'
    : 'border-muted';

  return (
    <Card className={`${borderClass} border`}>
      <Collapsible>
        <CollapsibleTrigger className="w-full">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{section.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge ok={section.status === 'pass'} />
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">
            <pre className="p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-60 overflow-auto font-mono">
              {JSON.stringify(section.details, null, 2)}
            </pre>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// --- Auth Probe Card ---

interface AuthProbeData {
  sessionExists: boolean;
  uid: string | null;
  expiresAt: string | null;
  userExists: boolean;
  userId: string | null;
}

function AuthProbeCard({ data }: { data: AuthProbeData | null }) {
  if (!data) return null;
  const rows = [
    { label: 'sessionExists', value: String(data.sessionExists) },
    { label: 'uid', value: data.uid ? data.uid.slice(0, 8) + '…' : 'null' },
    { label: 'expires_at', value: data.expiresAt || 'null' },
    { label: 'userExists', value: String(data.userExists) },
    { label: 'user.id', value: data.userId ? data.userId.slice(0, 8) + '…' : 'null' },
  ];
  const ok = data.sessionExists && data.userExists;

  return (
    <Card className={ok ? 'border-primary/30 border' : 'border-destructive/30 border'}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Auth Probe — Client Session</span>
          </div>
          <StatusBadge ok={ok} />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {rows.map(r => (
            <div key={r.label} className="flex justify-between">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-mono">{r.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// --- DB Auth Card ---

interface DbAuthData { uid: string | null; role: string | null }

function DbAuthCard({ data, loading, error, onRefresh }: {
  data: DbAuthData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const ok = !!data?.uid;
  return (
    <Card className={ok ? 'border-primary/30 border' : 'border-destructive/30 border'}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">DB Auth — rpc_whoami()</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge ok={ok} />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {data && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">uid</span>
              <span className="font-mono">{data.uid ?? 'null'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">role</span>
              <span className="font-mono">{data.role ?? 'null'}</span>
            </div>
          </div>
        )}
        {!ok && !loading && (
          <p className="text-xs text-destructive font-medium">DB auth missing — please refresh or log in.</p>
        )}
      </CardContent>
    </Card>
  );
}

// --- Scenario Runner (existing suite) ---

interface ScenarioItem {
  scenario: string;
  project_id: string | null;
  success: boolean;
  ok: boolean;
  payload: any;
  error: { sqlstate: string; message: string } | null;
}

interface ScenarioResult {
  ok: boolean;
  org_id: string;
  scenarios: ScenarioItem[];
}

const SCENARIO_LABELS: Record<string, string> = {
  active_control:              'Active Project (Control)',
  completed_or_closed:         'Completed / Closed',
  estimate_no_time_entries:    'Estimate — No Time Entries',
  has_approved_change_orders:  'Has Approved Change Orders',
  no_estimate:                 'No Estimate',
  zero_projected_revenue:      'Time Entries — Zero Projected Revenue',
};

function ScenarioCard({ s }: { s: ScenarioItem }) {
  const label = SCENARIO_LABELS[s.scenario] ?? s.scenario;
  const overallOk = s.success && s.ok;
  const borderClass = overallOk ? 'border-primary/30' : 'border-destructive/30';

  return (
    <Card className={`${borderClass} border`}>
      <Collapsible>
        <CollapsibleTrigger className="w-full">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <FlaskConical className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-sm truncate">{label}</span>
              {s.project_id && (
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {s.project_id.slice(0, 8)}…
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <StatusBadge ok={overallOk} />
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            <div className="flex items-center gap-3 text-xs">
              {s.project_id && (
                <a
                  href={`/projects/${s.project_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" /> Open Project
                </a>
              )}
              <span className={s.success ? 'text-primary' : 'text-destructive'}>
                RPC: {s.success ? 'succeeded' : 'failed'}
              </span>
              {s.success && (
                <span className={s.ok ? 'text-primary' : 'text-destructive'}>
                  Control engine: {s.ok ? 'ok' : 'issues found'}
                </span>
              )}
            </div>
            {s.error && (
              <div className="text-xs text-destructive bg-destructive/5 rounded p-2 font-mono">
                [{s.error.sqlstate}] {s.error.message}
              </div>
            )}
            {(s.payload || s.error) && (
              <pre className="p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-60 overflow-auto font-mono">
                {JSON.stringify(s.payload ?? s.error, null, 2)}
              </pre>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// --- Margin Edge-Case Suite ---

interface EdgeCaseRow {
  scenario: string;
  found: boolean;
  reason?: string;           // only when found === false
  project_id?: string;
  success?: boolean;
  payload?: any;
  error?: { sqlstate: string; message: string };
}

interface EdgeCaseResult {
  ok: boolean;
  org_id: string;
  user_id: string;
  results: EdgeCaseRow[];
}

const EDGE_CASE_LABELS: Record<string, string> = {
  no_estimate_selected:              'A — No Estimate Selected',
  estimate_selected_no_time_entries: 'B — Estimate Selected, No Time Entries',
  zero_projected_revenue:            'C — Zero Projected Revenue',
  has_change_orders:                 'D — Has Approved Change Orders',
};

function EdgeCaseRow({ row }: { row: EdgeCaseRow }) {
  const label = EDGE_CASE_LABELS[row.scenario] ?? row.scenario;

  // Not found → neutral/muted
  if (!row.found) {
    return (
      <Card className="border-muted border">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Microscope className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm text-muted-foreground truncate">{label}</span>
          </div>
          <Badge className="bg-muted text-muted-foreground border border-border text-xs shrink-0">
            Not found
          </Badge>
        </CardContent>
      </Card>
    );
  }

  const ok = row.success === true;

  return (
    <Card className={`border ${ok ? 'border-primary/30' : 'border-destructive/30'}`}>
      <Collapsible>
        <CollapsibleTrigger className="w-full text-left">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Microscope className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <span className="font-medium text-sm truncate block">{label}</span>
                {row.project_id && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {row.project_id.slice(0, 8)}…
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <Badge className="bg-primary/10 text-primary border-primary/20 border text-[10px] px-1.5 py-0">
                Found
              </Badge>
              <StatusBadge ok={ok} />
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            {/* Meta row */}
            <div className="flex items-center gap-3 text-xs flex-wrap">
              {row.project_id && (
                <Link
                  to={`/projects/${row.project_id}`}
                  className="flex items-center gap-1 text-primary hover:underline"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" /> Open Project
                </Link>
              )}
              <span className={row.success ? 'text-primary' : 'text-destructive'}>
                RPC: {row.success ? 'succeeded' : 'failed'}
              </span>
              {row.success && row.payload && (
                <span className="text-muted-foreground">
                  Position:{' '}
                  <span className="font-medium text-foreground">
                    {row.payload.economic_position ?? '—'}
                  </span>
                </span>
              )}
              {row.success && row.payload?.risk_score != null && (
                <span className="text-muted-foreground">
                  Risk score:{' '}
                  <span className="font-mono font-semibold text-foreground">
                    {row.payload.risk_score}
                  </span>
                </span>
              )}
              {row.success && row.payload?.projected_margin_at_completion_percent != null && (
                <span className="text-muted-foreground">
                  Margin:{' '}
                  <span className="font-mono font-semibold text-foreground">
                    {Number(row.payload.projected_margin_at_completion_percent).toFixed(1)}%
                  </span>
                </span>
              )}
            </div>

            {/* Error */}
            {row.error && (
              <div className="text-xs text-destructive bg-destructive/5 border border-destructive/15 rounded p-2 font-mono">
                [{row.error.sqlstate}] {row.error.message}
              </div>
            )}

            {/* Payload preview (collapsed) */}
            {row.payload && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1">
                  <ChevronDown className="h-3 w-3" /> Payload preview
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="mt-1 p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-64 overflow-auto font-mono">
                    {JSON.stringify(row.payload, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// --- Main Page ---

export default function AIBrainDiagnostics() {
  const { session } = useAuth();
  const { activeOrganizationId } = useOrganization();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);

  // Auth probe state
  const [authProbe, setAuthProbe] = useState<AuthProbeData | null>(null);

  // DB auth state
  const [dbAuth, setDbAuth] = useState<DbAuthData | null>(null);
  const [dbAuthLoading, setDbAuthLoading] = useState(false);
  const [dbAuthError, setDbAuthError] = useState<string | null>(null);

  // Scenario runner state
  const [scenarioRunning, setScenarioRunning] = useState(false);
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  // Margin edge-case suite state
  const [edgeRunning, setEdgeRunning] = useState(false);
  const [edgeResult, setEdgeResult] = useState<EdgeCaseResult | null>(null);
  const [edgeError, setEdgeError] = useState<string | null>(null);
  const [edgeCopied, setEdgeCopied] = useState(false);

  // Margin Payload Inspector state
  const [inspectorProject, setInspectorProject] = useState<string>('');
  const [inspectorRunning, setInspectorRunning] = useState(false);
  const [inspectorResult, setInspectorResult] = useState<any>(null);
  const [inspectorError, setInspectorError] = useState<string | null>(null);
  const [inspectorCopied, setInspectorCopied] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Fetch projects
  useEffect(() => {
    if (!activeOrganizationId) return;
    supabase.from('projects').select('id, name').eq('organization_id', activeOrganizationId)
      .order('name').then(({ data }) => setProjects(data || []));
  }, [activeOrganizationId]);

  // Auth probe on mount
  useEffect(() => {
    (async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      setAuthProbe({
        sessionExists: !!s,
        uid: s?.user?.id ?? null,
        expiresAt: s?.expires_at ? new Date(s.expires_at * 1000).toISOString() : null,
        userExists: !!user,
        userId: user?.id ?? null,
      });
    })();
  }, []);

  // Restore last result from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('ai_brain_diagnostics_last_result');
    const storedAt = localStorage.getItem('ai_brain_diagnostics_last_ran_at');
    if (stored) {
      try { setResult(JSON.parse(stored)); } catch {}
    }
    if (storedAt) setRanAt(storedAt);
  }, []);

  // DB auth probe
  const fetchDbAuth = async () => {
    setDbAuthLoading(true);
    setDbAuthError(null);
    try {
      const { data, error: e } = await (supabase as any).rpc('rpc_whoami');
      if (e) { setDbAuthError(e.message); setDbAuth(null); }
      else { setDbAuth(data as DbAuthData); }
    } catch (err: any) { setDbAuthError(err.message); }
    finally { setDbAuthLoading(false); }
  };

  useEffect(() => { fetchDbAuth(); }, []);

  const dbAuthOk = !!dbAuth?.uid;

  // --- Run handler (unchanged logic) ---
  const handleRun = async () => {
    setRunning(true);
    setError(null);
    if (!session) {
      setError('No active session — please log in first.');
      setRunning(false);
      return;
    }
    try {
      const params: Record<string, string> = {};
      if (selectedProject && selectedProject !== '__auto__') params.p_project_id = selectedProject;
      if (activeOrganizationId) params.p_org_id = activeOrganizationId;

      const { data, error: rpcError } = await (supabase as any).rpc('rpc_run_ai_brain_test_runner', params);

      if (rpcError) { setError(rpcError.message); setResult(null); }
      else {
        const ts = new Date().toISOString();
        setResult(data);
        setRanAt(ts);
        try {
          localStorage.setItem('ai_brain_diagnostics_last_result', JSON.stringify(data));
          localStorage.setItem('ai_brain_diagnostics_last_ran_at', ts);
        } catch {}
      }
    } catch (e: any) { setError(e.message); }
    finally { setRunning(false); }
  };

  // Scenario runner handler
  const handleRunScenarios = async () => {
    if (!activeOrganizationId || !dbAuthOk) return;
    setScenarioRunning(true);
    setScenarioError(null);
    setScenarioResult(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        'rpc_run_ai_brain_scenario_suite',
        { p_org_id: activeOrganizationId }
      );
      if (rpcError) setScenarioError(rpcError.message);
      else setScenarioResult(data as ScenarioResult);
    } catch (e: any) { setScenarioError(e.message); }
    finally { setScenarioRunning(false); }
  };

  const handleCopyScenario = () => {
    if (scenarioResult) navigator.clipboard.writeText(JSON.stringify(scenarioResult, null, 2));
  };

  // Margin edge-case suite handler
  const handleRunEdgeCases = async () => {
    if (!activeOrganizationId || !session) return;
    setEdgeRunning(true);
    setEdgeError(null);
    setEdgeResult(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        'rpc_run_margin_control_edge_cases',
        { p_org_id: activeOrganizationId }
      );
      if (rpcError) setEdgeError(rpcError.message);
      else if (data?.ok === false) setEdgeError(data.reason ?? 'RPC returned ok: false');
      else setEdgeResult(data as EdgeCaseResult);
    } catch (e: any) { setEdgeError(e.message); }
    finally { setEdgeRunning(false); }
  };

  const handleCopyEdge = () => {
    if (!edgeResult) return;
    navigator.clipboard.writeText(JSON.stringify(edgeResult, null, 2));
    setEdgeCopied(true);
    setTimeout(() => setEdgeCopied(false), 2000);
  };

  // Margin Payload Inspector handler
  const handleInspect = async () => {
    if (!inspectorProject || !dbAuthOk) return;
    setInspectorRunning(true);
    setInspectorError(null);
    setInspectorResult(null);
    setInspectorOpen(false);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        'rpc_debug_margin_control_payload',
        { p_project_id: inspectorProject }
      );
      if (rpcError) setInspectorError(rpcError.message);
      else setInspectorResult(data);
    } catch (e: any) { setInspectorError(e.message); }
    finally { setInspectorRunning(false); }
  };

  const handleCopyInspector = () => {
    if (!inspectorResult) return;
    navigator.clipboard.writeText(JSON.stringify(inspectorResult, null, 2));
    setInspectorCopied(true);
    setTimeout(() => setInspectorCopied(false), 2000);
  };

  const handleCopy = () => { if (result) navigator.clipboard.writeText(JSON.stringify(result, null, 2)); };
  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ai-brain-diagnostics-${(ranAt || new Date().toISOString()).slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  // Parse result into sections
  const sections: SectionResult[] = result ? [
    {
      label: 'Existence — Views & Functions', icon: Eye,
      status: result.existence
        ? Object.values(result.existence.views || {}).every(Boolean) && Object.values(result.existence.functions || {}).every(Boolean) ? 'pass' : 'fail'
        : 'pending',
      details: result.existence || {},
    },
    {
      label: 'Security — SECURITY DEFINER & Pinned search_path', icon: Shield,
      status: result.security
        ? Object.values(result.security).every((v: any) => v?.security_definer && v?.search_path_pinned) ? 'pass' : 'fail'
        : 'pending',
      details: result.security || {},
    },
    {
      label: 'Privileges — Public/Anon Denied', icon: Lock,
      status: result.privileges
        ? Object.values(result.privileges).every((v: any) => !v?.public_can_execute && !v?.anon_can_execute) ? 'pass' : 'fail'
        : 'pending',
      details: result.privileges || {},
    },
    {
      label: 'Smoke Tests — RPCs Execute Successfully', icon: Zap,
      status: result.smoke
        ? Object.values(result.smoke).every((v: any) => v?.success) ? 'pass' : 'fail'
        : 'pending',
      details: result.smoke || {},
    },
    {
      label: 'Determinism — Identical Consecutive Calls', icon: CheckCircle2,
      status: result.determinism
        ? Object.values(result.determinism).every(Boolean) ? 'pass' : 'fail'
        : 'pending',
      details: result.determinism || {},
    },
  ] : [];

  const passCount = sections.filter(s => s.status === 'pass').length;
  const failCount = sections.filter(s => s.status === 'fail').length;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">AI Brain Diagnostics</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            One-click verification of existence, security, privileges, smoke tests, and determinism for the AI Brain layer.
          </p>
          {ranAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Last run: <span className="font-mono">{ranAt}</span>
            </p>
          )}
        </div>

        {/* Failure Banner */}
        {result && !result.ok && !result.skipped && (
          <Card className="border-destructive bg-destructive/10 border-2">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-destructive text-sm">Release Blocked — Failing Sections</p>
                <ul className="mt-1 space-y-0.5">
                  {sections.filter(s => s.status === 'fail').map(s => (
                    <li key={s.label} className="text-xs text-destructive flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> {s.label}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Auth Probe + DB Auth */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AuthProbeCard data={authProbe} />
          <DbAuthCard data={dbAuth} loading={dbAuthLoading} error={dbAuthError} onRefresh={fetchDbAuth} />
        </div>

        {/* Controls */}
        <Card>
          <CardContent className="p-4 flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Project (optional)</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger><SelectValue placeholder="Auto-detect (smallest accessible)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Auto-detect</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleRun} disabled={running || !dbAuthOk}>
              <Play className="h-4 w-4 mr-2" />
              {running ? 'Running...' : 'Run AI Brain Tests'}
            </Button>
            {result && (
              <>
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" /> JSON
                </Button>
                <Button variant="outline" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-2" /> Copy
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* DB auth warning */}
        {!dbAuthOk && !dbAuthLoading && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <span className="text-sm text-destructive">DB auth missing — please refresh or log in before running tests.</span>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <span className="text-sm text-destructive">{error}</span>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Card className={result.ok ? 'border-primary/30' : 'border-destructive/30'}>
                <CardContent className="p-4 text-center">
                  <div className={`text-2xl font-bold ${result.ok ? 'text-primary' : 'text-destructive'}`}>
                    {result.ok ? 'ALL PASS' : 'ISSUES FOUND'}
                  </div>
                  <div className="text-xs text-muted-foreground">Overall Status</div>
                </CardContent>
              </Card>
              <Card className="border-primary/30">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{passCount}</div>
                  <div className="text-xs text-muted-foreground">Sections Pass</div>
                </CardContent>
              </Card>
              <Card className={failCount > 0 ? 'border-destructive/30' : ''}>
                <CardContent className="p-4 text-center">
                  <div className={`text-2xl font-bold ${failCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{failCount}</div>
                  <div className="text-xs text-muted-foreground">Sections Fail</div>
                </CardContent>
              </Card>
            </div>

            {(result.project_id || result.org_id) && (
              <div className="flex gap-4 text-xs text-muted-foreground">
                {result.project_id && <span>Project: <span className="font-mono">{result.project_id}</span></span>}
                {result.org_id && <span>Org: <span className="font-mono">{result.org_id}</span></span>}
              </div>
            )}

            {result.skipped && (
              <Card className="border-accent bg-accent/10">
                <CardContent className="p-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-accent-foreground" />
                  <span className="text-sm">Tests skipped: {result.reason}</span>
                </CardContent>
              </Card>
            )}

            {!result.skipped && (
              <div className="space-y-3">
                {sections.map(s => (
                  <SectionCard key={s.label} section={s} />
                ))}
              </div>
            )}

            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ChevronDown className="h-3 w-3" /> Raw JSON Response
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-80 overflow-auto font-mono">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {/* ─── Scenario Runner ─────────────────────────────────── */}
        <div className="border-t pt-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Scenario Suite Runner</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Runs <code className="font-mono">rpc_generate_project_margin_control</code> against up to 6 edge-case projects in this org.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {scenarioResult && (
                <Button variant="outline" size="sm" onClick={handleCopyScenario}>
                  <Copy className="h-4 w-4 mr-1.5" /> Copy JSON
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleRunScenarios}
                disabled={scenarioRunning || !dbAuthOk || !activeOrganizationId}
              >
                <Play className="h-4 w-4 mr-1.5" />
                {scenarioRunning ? 'Running…' : 'Run Scenario Suite'}
              </Button>
            </div>
          </div>

          {scenarioError && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive">{scenarioError}</span>
              </CardContent>
            </Card>
          )}

          {scenarioResult && (
            <>
              {/* Summary bar */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className={scenarioResult.ok ? 'text-primary font-semibold' : 'text-destructive font-semibold'}>
                  {scenarioResult.ok ? '✓ All scenarios ok' : '✗ One or more scenarios failed'}
                </span>
                <span>{scenarioResult.scenarios.length} scenario{scenarioResult.scenarios.length !== 1 ? 's' : ''} run</span>
                <span className="text-primary">{scenarioResult.scenarios.filter(s => s.ok && s.success).length} pass</span>
                {scenarioResult.scenarios.filter(s => !s.ok || !s.success).length > 0 && (
                  <span className="text-destructive">{scenarioResult.scenarios.filter(s => !s.ok || !s.success).length} fail</span>
                )}
              </div>

              {/* Scenario cards */}
              <div className="space-y-2">
                {scenarioResult.scenarios.map(s => (
                  <ScenarioCard key={s.scenario} s={s} />
                ))}
              </div>

              {scenarioResult.scenarios.length === 0 && (
                <Card className="border-muted">
                  <CardContent className="p-4 text-center text-sm text-muted-foreground">
                    No matching projects found for any scenario in this org.
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* ─── Margin Edge-Case Suite ───────────────────────────── */}
        <div className="border-t pt-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Microscope className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Margin Edge-Case Suite</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Calls <code className="font-mono">rpc_run_margin_control_edge_cases</code> — runs the margin
                control engine against four deterministic edge-case project archetypes.
                Requires an active session.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {edgeResult && (
                <Button variant="outline" size="sm" onClick={handleCopyEdge}>
                  <Copy className="h-4 w-4 mr-1.5" />
                  {edgeCopied ? 'Copied!' : 'Copy JSON'}
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleRunEdgeCases}
                disabled={edgeRunning || !dbAuthOk || !activeOrganizationId || !session}
              >
                <Play className="h-4 w-4 mr-1.5" />
                {edgeRunning ? 'Running…' : 'Run Edge-Case Suite'}
              </Button>
            </div>
          </div>

          {/* Session guard notice */}
          {!session && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive">Active session required — please log in first.</span>
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {edgeError && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive">{edgeError}</span>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {edgeResult && (
            <>
              {/* Summary bar */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span className="font-mono text-[11px]">
                  org: {edgeResult.org_id.slice(0, 8)}…
                </span>
                <span className="font-mono text-[11px]">
                  uid: {edgeResult.user_id.slice(0, 8)}…
                </span>
                {(() => {
                  const found   = edgeResult.results.filter(r => r.found).length;
                  const success = edgeResult.results.filter(r => r.found && r.success).length;
                  const fail    = edgeResult.results.filter(r => r.found && !r.success).length;
                  const notFound= edgeResult.results.filter(r => !r.found).length;
                  return (
                    <>
                      <span>{edgeResult.results.length} scenarios</span>
                      <span className="text-primary">{found} found</span>
                      {success > 0 && <span className="text-primary font-semibold">{success} pass</span>}
                      {fail    > 0 && <span className="text-destructive font-semibold">{fail} fail</span>}
                      {notFound > 0 && <span className="text-muted-foreground">{notFound} no match</span>}
                    </>
                  );
                })()}
              </div>

              {/* Per-scenario rows */}
              <div className="space-y-2">
                {edgeResult.results.map(row => (
                  <EdgeCaseRow key={row.scenario} row={row} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* ─── Margin Payload Inspector ─────────────────────────────── */}
        <div className="border-t pt-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Margin Payload Inspector</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Calls <code className="font-mono">rpc_debug_margin_control_payload</code> for any project —
                shows exact live output including <code className="font-mono">intervention_flags</code> key shape.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {inspectorResult && (
                <Button variant="outline" size="sm" onClick={handleCopyInspector}>
                  <Copy className="h-4 w-4 mr-1.5" />
                  {inspectorCopied ? 'Copied!' : 'Copy JSON'}
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleInspect}
                disabled={inspectorRunning || !dbAuthOk || !inspectorProject}
              >
                <Play className="h-4 w-4 mr-1.5" />
                {inspectorRunning ? 'Inspecting…' : 'Inspect Margin Payload'}
              </Button>
            </div>
          </div>

          {/* Project selector */}
          <div className="max-w-sm">
            <label className="text-sm font-medium mb-1 block">Project (required)</label>
            <Select value={inspectorProject} onValueChange={setInspectorProject}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project to inspect" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* DB auth guard */}
          {!dbAuthOk && !dbAuthLoading && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive">DB auth required — please refresh or log in first.</span>
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {inspectorError && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive font-mono">{inspectorError}</span>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {inspectorResult && (
            <div className="space-y-3">
              {/* Meta row */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground font-mono">
                <span>project: {inspectorResult.project_id?.slice(0, 8)}…</span>
                <span>org: {inspectorResult.org_id?.slice(0, 8)}…</span>
              </div>

              {/* keys_present */}
              <Card className="border-primary/20">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    keys_present ({Array.isArray(inspectorResult.keys_present) ? inspectorResult.keys_present.length : 0})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(inspectorResult.keys_present ?? []).map((k: string) => (
                      <code
                        key={k}
                        className={`text-[11px] px-2 py-0.5 rounded font-mono border ${
                          k === 'intervention_flags'
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {k}
                      </code>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* intervention_flags */}
              <Card className={
                inspectorResult.intervention_flags_type === 'array' ? 'border-primary/30' : 'border-amber-500/30'
              }>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      intervention_flags
                    </p>
                    <code className={`text-[11px] px-2 py-0.5 rounded font-mono border ${
                      inspectorResult.intervention_flags_type === 'array'
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                    }`}>
                      type: {inspectorResult.intervention_flags_type ?? 'null'}
                    </code>
                  </div>
                  {Array.isArray(inspectorResult.intervention_flags_value) && inspectorResult.intervention_flags_value.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {inspectorResult.intervention_flags_value.map((flag: string, i: number) => (
                        <Badge key={i} className="bg-destructive/10 text-destructive border-destructive/20 border text-[11px] font-mono">
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      {inspectorResult.intervention_flags_type === 'array'
                        ? 'Empty array — no flags active'
                        : 'Not an array — check key shape above'}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Full payload collapsible */}
              <Collapsible open={inspectorOpen} onOpenChange={setInspectorOpen}>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full">
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${inspectorOpen ? 'rotate-180' : ''}`} />
                  <span>{inspectorOpen ? 'Hide' : 'Show'} full margin_control_payload</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="mt-2 p-3 bg-muted rounded text-[11px] whitespace-pre-wrap max-h-96 overflow-auto font-mono leading-relaxed">
                    {JSON.stringify(inspectorResult.margin_control_payload, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
