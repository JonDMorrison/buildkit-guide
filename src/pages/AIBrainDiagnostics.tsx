import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Play, Download, ChevronDown, CheckCircle2, XCircle, AlertTriangle, Copy, Brain, Shield, Eye, Zap, Lock, RefreshCw, User, FlaskConical, ExternalLink, Microscope, Search, Beaker, GitBranch } from 'lucide-react';
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

  // Quick Probe state
  type ProbeRow = {
    project_id: string;
    project_name: string;
    risk_score: unknown;
    economic_position: unknown;
    intervention_flags_type: string;
    intervention_flags_value: unknown[];
    raw: unknown;
    open: boolean;
    error?: string;
  };
  const [probeRunning, setProbeRunning] = useState(false);
  const [probeRows, setProbeRows] = useState<ProbeRow[]>([]);
  const [probeError, setProbeError] = useState<string | null>(null);

  // Determinism Re-scan state
  const [detRunning, setDetRunning] = useState(false);
  const [detResult, setDetResult] = useState<{ violation_count: number; suspect_functions: { function_name: string; issue: string }[] } | null>(null);
  const [detError, setDetError] = useState<string | null>(null);

  // Margin Inputs Trace state
  const [traceProject, setTraceProject] = useState<string>('');
  const [traceRunning, setTraceRunning] = useState(false);
  const [traceResult, setTraceResult] = useState<any>(null);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [traceCopied, setTraceCopied] = useState(false);

  // Seed Margin Test Project state
  type SeedResult = {
    success: boolean;
    already_existed: boolean;
    project_id: string;
    estimate_id?: string;
    time_entries_count?: number;
    total_labor_hours?: number;
    total_labor_cost?: number;
    planned_total_cost?: number;
    contract_value?: number;
    message: string;
  };
  const [seedRunning, setSeedRunning] = useState(false);
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

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

  // Quick Probe handler — deterministically picks 3 projects, calls RPC for each
  const handleQuickProbe = async () => {
    if (!activeOrganizationId || !dbAuthOk) return;
    setProbeRunning(true);
    setProbeError(null);
    setProbeRows([]);

    try {
      // 1. Fetch all active projects ordered by id ASC (deterministic)
      const { data: allProjects, error: projErr } = await supabase
        .from('projects')
        .select('id, name')
        .eq('organization_id', activeOrganizationId)
        .not('status', 'in', '("completed","archived","deleted","cancelled")')
        .eq('is_deleted', false)
        .order('id', { ascending: true });

      if (projErr) throw new Error(projErr.message);
      const active = allProjects ?? [];

      // 2. First with any time_entries (id ASC)
      const { data: teRows } = await supabase
        .from('time_entries')
        .select('project_id')
        .eq('organization_id', activeOrganizationId)
        .order('project_id', { ascending: true })
        .limit(50);

      const projectsWithEntries = new Set((teRows ?? []).map((r: any) => r.project_id));

      // Build deterministic trio
      const slot0 = active[0] ?? null;                       // 1st active by id ASC
      const slot1 = active.find(p => projectsWithEntries.has(p.id)) ?? null; // 1st with entries
      const slot2 = active[2] ?? active[1] ?? null;          // 3rd (index 2) by id ASC

      // Deduplicate while preserving label order
      const seen = new Set<string>();
      const trio: { project: { id: string; name: string }; label: string }[] = [];
      for (const [proj, label] of [
        [slot0, 'first_active'],
        [slot1, 'first_with_entries'],
        [slot2, 'third_by_id'],
      ] as [({ id: string; name: string } | null), string][]) {
        if (!proj || seen.has(proj.id)) continue;
        seen.add(proj.id);
        trio.push({ project: proj, label });
      }

      if (trio.length === 0) {
        setProbeError('No active projects found in this org.');
        return;
      }

      // 3. Call RPC for each in parallel
      const results = await Promise.all(
        trio.map(async ({ project, label }) => {
          try {
            const { data, error: rpcErr } = await (supabase as any).rpc(
              'rpc_debug_margin_control_payload',
              { p_project_id: project.id }
            );
            if (rpcErr) return { project_id: project.id, project_name: project.name, label, error: rpcErr.message, open: false } as any;
            const payload = data?.margin_control_payload ?? {};
            return {
              project_id: project.id,
              project_name: project.name,
              label,
              risk_score: payload.risk_score ?? payload.composite_risk_score ?? '—',
              economic_position: payload.economic_position ?? payload.margin_position ?? '—',
              intervention_flags_type: data?.intervention_flags_type ?? 'null',
              intervention_flags_value: Array.isArray(data?.intervention_flags_value) ? data.intervention_flags_value : [],
              raw: data,
              open: false,
            };
          } catch (e: any) {
            return { project_id: project.id, project_name: project.name, label, error: e.message, open: false };
          }
        })
      );

      setProbeRows(results);
    } catch (e: any) {
      setProbeError(e.message);
    } finally {
      setProbeRunning(false);
    }
  };

  const toggleProbeRow = (idx: number) =>
    setProbeRows(rows => rows.map((r, i) => i === idx ? { ...r, open: !r.open } : r));

  // Determinism re-scan handler
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

  // Margin Inputs Trace handler
  const handleRunTrace = async () => {
    if (!traceProject || !dbAuthOk) return;
    setTraceRunning(true);
    setTraceError(null);
    setTraceResult(null);
    try {
      const { data, error: rpcErr } = await (supabase as any).rpc(
        'rpc_debug_margin_control_inputs',
        { p_project_id: traceProject }
      );
      if (rpcErr) setTraceError(rpcErr.message);
      else setTraceResult(data);
    } catch (e: any) { setTraceError(e.message); }
    finally { setTraceRunning(false); }
  };

  const handleCopyTrace = () => {
    if (!traceResult) return;
    navigator.clipboard.writeText(JSON.stringify(traceResult, null, 2));
    setTraceCopied(true);
    setTimeout(() => setTraceCopied(false), 2000);
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

  // Seed Margin Test Project handler
  const handleSeed = async () => {
    if (!activeOrganizationId || !session) return;
    setSeedRunning(true);
    setSeedError(null);
    setSeedResult(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        'seed-margin-test-project',
        { body: { organizationId: activeOrganizationId } }
      );
      if (fnErr) { setSeedError(fnErr.message); return; }
      if (data?.error) { setSeedError(data.error); return; }
      setSeedResult(data as SeedResult);
    } catch (e: any) { setSeedError(e.message); }
    finally { setSeedRunning(false); }
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

        {/* ─── Margin Inputs Trace ──────────────────────────────────────── */}
        <div className="border-t pt-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Margin Inputs Trace</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Calls <code className="font-mono">rpc_debug_margin_control_inputs</code> — shows every raw number
                fed into the margin engine so you can trace why burn ratios or margins default to 0/1.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {traceResult && (
                <Button variant="outline" size="sm" onClick={handleCopyTrace}>
                  <Copy className="h-4 w-4 mr-1.5" />
                  {traceCopied ? 'Copied!' : 'Copy JSON'}
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleRunTrace}
                disabled={traceRunning || !dbAuthOk || !traceProject}
              >
                <Play className="h-4 w-4 mr-1.5" />
                {traceRunning ? 'Tracing…' : 'Trace Inputs'}
              </Button>
            </div>
          </div>

          {/* Project selector */}
          <div className="max-w-sm">
            <label className="text-sm font-medium mb-1 block">Project (required)</label>
            <Select value={traceProject} onValueChange={setTraceProject}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project to trace" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!dbAuthOk && !dbAuthLoading && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive">DB auth required — please refresh or log in first.</span>
              </CardContent>
            </Card>
          )}

          {traceError && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive font-mono">{traceError}</span>
              </CardContent>
            </Card>
          )}

          {traceResult && (() => {
            const inputs = traceResult.inputs ?? {};
            const sources = traceResult.sources ?? {};
            const inputRows: { key: string; label: string; value: unknown; highlight?: 'warn' | 'ok' }[] = [
              { key: 'projected_revenue',       label: 'Projected Revenue',            value: inputs.projected_revenue,       highlight: inputs.projected_revenue === 0 ? 'warn' : 'ok' },
              { key: 'contract_value_used',     label: 'Contract Value Used',          value: inputs.contract_value_used },
              { key: 'selected_estimate_id',    label: 'Selected Estimate ID',         value: inputs.selected_estimate_id ?? '—',  highlight: !inputs.selected_estimate_id ? 'warn' : undefined },
              { key: 'estimate_total_cost',     label: 'Estimate — Total Cost',        value: inputs.estimate_total_cost },
              { key: 'estimate_labor_cost',     label: 'Estimate — Labor Cost',        value: inputs.estimate_labor_cost },
              { key: 'estimate_material_cost',  label: 'Estimate — Material Cost',     value: inputs.estimate_material_cost },
              { key: 'estimate_sub_cost',       label: 'Estimate — Sub Cost',          value: inputs.estimate_sub_cost },
              { key: 'actual_labor_cost_to_date',    label: 'Actual Labor Cost to Date',    value: inputs.actual_labor_cost_to_date,    highlight: inputs.actual_labor_cost_to_date === 0 ? 'warn' : 'ok' },
              { key: 'actual_material_cost_to_date', label: 'Actual Material Cost to Date',  value: inputs.actual_material_cost_to_date },
              { key: 'actual_sub_cost_to_date',      label: 'Actual Sub Cost to Date',       value: inputs.actual_sub_cost_to_date },
              { key: 'actual_total_cost_to_date',    label: 'Actual Total Cost to Date',     value: inputs.actual_total_cost_to_date,    highlight: inputs.actual_total_cost_to_date === 0 ? 'warn' : 'ok' },
              { key: 'labor_cost_ratio_used',        label: 'Labor Cost Ratio Used',         value: inputs.labor_cost_ratio_used,        highlight: inputs.labor_cost_ratio_used === 0 ? 'warn' : 'ok' },
              { key: 'projected_margin_at_completion_ratio_used', label: 'Projected Margin @ Completion Ratio', value: inputs.projected_margin_at_completion_ratio_used, highlight: inputs.projected_margin_at_completion_ratio_used === 0 ? 'warn' : 'ok' },
              { key: 'snapshot_actual_labor_cost',   label: 'Snapshot — Actual Labor Cost',  value: inputs.snapshot_actual_labor_cost,   highlight: inputs.snapshot_actual_labor_cost === 0 ? 'warn' : undefined },
              { key: 'snapshot_actual_total_cost',   label: 'Snapshot — Actual Total Cost',  value: inputs.snapshot_actual_total_cost,   highlight: inputs.snapshot_actual_total_cost === 0 ? 'warn' : undefined },
              { key: 'snapshot_realized_margin_ratio',    label: 'Snapshot — Realized Margin Ratio',     value: inputs.snapshot_realized_margin_ratio },
              { key: 'snapshot_cost_to_revenue_ratio',    label: 'Snapshot — Cost-to-Revenue Ratio',     value: inputs.snapshot_cost_to_revenue_ratio },
            ];

            return (
              <div className="space-y-3">
                {/* IDs */}
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground font-mono">
                  <span>project: {traceResult.project_id?.slice(0, 8)}…</span>
                  <span>org: {traceResult.org_id?.slice(0, 8)}…</span>
                </div>

                {/* Inputs table */}
                <Card>
                  <CardContent className="p-0 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border bg-muted/30">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Inputs</p>
                    </div>
                    <div className="divide-y divide-border">
                      {inputRows.map(row => (
                        <div key={row.key} className={`grid grid-cols-[1fr_auto] gap-4 px-4 py-2 text-xs items-center ${
                          row.highlight === 'warn' ? 'bg-amber-500/5' : ''
                        }`}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            {row.highlight === 'warn' && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                            <span className="text-muted-foreground truncate">{row.label}</span>
                          </div>
                          <span className={`font-mono text-right shrink-0 ${
                            row.highlight === 'warn' ? 'text-amber-600 font-semibold' :
                            row.highlight === 'ok'   ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {typeof row.value === 'string' && row.value.length > 8 && row.value !== '—'
                              ? row.value.slice(0, 8) + '…'
                              : String(row.value ?? '—')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Sources table */}
                <Card className="border-border/50">
                  <CardContent className="p-0 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border bg-muted/30">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Sources</p>
                    </div>
                    <div className="divide-y divide-border">
                      {Object.entries(sources).map(([k, v]) => (
                        <div key={k} className="grid grid-cols-[160px_1fr] gap-3 px-4 py-2 text-xs items-start">
                          <span className="text-muted-foreground font-mono shrink-0">{k}</span>
                          <span className="text-foreground break-words">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}
        </div>

        {/* ─── Quick Probe (3 Projects) ────────────────────────────────── */}
        <div className="border-t pt-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Quick Probe (3 Projects)</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deterministically selects 3 projects (1st active · 1st with entries · 3rd by ID) and calls{' '}
                <code className="font-mono">rpc_debug_margin_control_payload</code> for each in parallel.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleQuickProbe}
              disabled={probeRunning || !dbAuthOk || !activeOrganizationId}
            >
              <Zap className={`h-4 w-4 mr-1.5 ${probeRunning ? 'animate-pulse' : ''}`} />
              {probeRunning ? 'Probing…' : 'Quick Probe (3 Projects)'}
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

          {probeError && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="p-3 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive font-mono">{probeError}</span>
              </CardContent>
            </Card>
          )}

          {probeRows.length > 0 && (
            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_1fr_1fr_80px_auto] gap-x-3 px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                <span>Project</span>
                <span>Risk Score</span>
                <span>Economic Position</span>
                <span>Flags Type</span>
                <span>Flags</span>
              </div>

              {probeRows.map((row, i) => (
                <div key={row.project_id} className="rounded-lg border border-border bg-card overflow-hidden">
                  {/* Main row */}
                  <div className="grid grid-cols-[1fr_1fr_1fr_80px_auto] gap-x-3 items-center px-3 py-2.5 text-xs">
                    {/* Project */}
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-muted-foreground truncate">
                        {row.project_id.slice(0, 8)}…
                      </div>
                      <div className="text-[11px] text-foreground truncate font-medium">{row.project_name}</div>
                      <div className="text-[10px] text-muted-foreground">{(row as any).label}</div>
                    </div>

                    {/* Risk score */}
                    <div className="font-mono text-xs">
                      {(row as any).error
                        ? <span className="text-destructive text-[10px]">ERR</span>
                        : String(row.risk_score ?? '—')}
                    </div>

                    {/* Economic position */}
                    <div className="font-mono text-xs truncate">
                      {(row as any).error
                        ? <span className="text-destructive text-[10px] font-mono">{(row as any).error}</span>
                        : String(row.economic_position ?? '—')}
                    </div>

                    {/* Flags type */}
                    <div>
                      <code className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
                        row.intervention_flags_type === 'array'
                          ? 'bg-primary/10 text-primary border-primary/30'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {row.intervention_flags_type ?? 'null'}
                      </code>
                    </div>

                    {/* Flags value + expander */}
                    <div className="flex items-center gap-2">
                      <div className="flex flex-wrap gap-1">
                        {row.intervention_flags_value?.length > 0
                          ? row.intervention_flags_value.map((f, fi) => (
                              <Badge key={fi} className="bg-destructive/10 text-destructive border-destructive/20 border text-[10px] font-mono px-1.5 py-0">
                                {String(f)}
                              </Badge>
                            ))
                          : <span className="text-[10px] text-muted-foreground italic">none</span>
                        }
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] shrink-0"
                        onClick={() => toggleProbeRow(i)}
                      >
                        <ChevronDown className={`h-3 w-3 mr-0.5 transition-transform ${row.open ? 'rotate-180' : ''}`} />
                        {row.open ? 'Hide' : 'View JSON'}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded JSON */}
                  {row.open && (
                    <div className="border-t border-border bg-muted/40 px-3 py-2">
                      <pre className="text-[11px] font-mono whitespace-pre-wrap max-h-64 overflow-auto leading-relaxed">
                        {JSON.stringify(row.raw, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Seed Margin Test Project ─────────────────────────────── */}
        <div className="border-t pt-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Beaker className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Seed Margin Test Project</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Creates one deterministic project in this org with burn ($8 500) exceeding estimate ($7 000)
                — guaranteed <code className="font-mono">risk_score &gt; 0</code> and at least one intervention flag.
                Idempotent: re-running returns the existing project id.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSeed}
              disabled={seedRunning || !dbAuthOk || !activeOrganizationId || !session}
            >
              <Beaker className={`h-4 w-4 mr-1.5 ${seedRunning ? 'animate-pulse' : ''}`} />
              {seedRunning ? 'Seeding…' : 'Seed Test Project'}
            </Button>
          </div>

          {(!session || !dbAuthOk) && !seedRunning && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive">
                  {!session ? 'Active session required — please log in first.' : 'DB auth required — please refresh or log in.'}
                </span>
              </CardContent>
            </Card>
          )}

          {seedError && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="p-3 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive font-mono">{seedError}</span>
              </CardContent>
            </Card>
          )}

          {seedResult && (
            <Card className={seedResult.already_existed ? 'border-amber-500/30' : 'border-primary/30'}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {seedResult.already_existed
                    ? <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 border text-xs">Already Existed</Badge>
                    : <Badge className="bg-primary/10 text-primary border-primary/30 border text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Created</Badge>}
                  <p className="text-xs text-muted-foreground">{seedResult.message}</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Project ID</p>
                    <code className="text-xs font-mono text-foreground block">{seedResult.project_id.slice(0, 8)}…</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(seedResult.project_id)}
                      className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                    >
                      <Copy className="h-3 w-3" /> Copy full ID
                    </button>
                  </div>
                  {!seedResult.already_existed && (
                    <>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Contract Value</p>
                        <span className="text-xs font-mono">${(seedResult.contract_value ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Planned Cost</p>
                        <span className="text-xs font-mono">${(seedResult.planned_total_cost ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Actual Labor Cost</p>
                        <span className="text-xs font-mono text-destructive font-bold">${(seedResult.total_labor_cost ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Labor Hours</p>
                        <span className="text-xs font-mono">{seedResult.total_labor_hours}h ({seedResult.time_entries_count} entries)</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Cost Overrun</p>
                        <span className="text-xs font-mono text-destructive font-bold">
                          +${((seedResult.total_labor_cost ?? 0) - (seedResult.planned_total_cost ?? 0)).toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  <Zap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    Run <span className="font-semibold">Quick Probe</span> above or paste the project ID into{' '}
                    <span className="font-semibold">Margin Payload Inspector</span> to verify flags fired.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>


        {/* ─── Margin Inputs Trace ────────────────────────────────────── */}
        <div className="border-t pt-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Margin Inputs Trace</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exposes the raw numeric inputs consumed by the margin engine for any project.
                Use this to explain why <code className="font-mono">labor_burn_ratio=0</code> or <code className="font-mono">projected_margin=1</code>.
                Read-only — no writes.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={traceProject} onValueChange={setTraceProject}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Select project…" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRunTrace}
                disabled={traceRunning || !traceProject || !dbAuthOk}
              >
                <GitBranch className={`h-4 w-4 mr-1.5 ${traceRunning ? 'animate-pulse' : ''}`} />
                {traceRunning ? 'Running…' : 'Run Inputs Trace'}
              </Button>
            </div>
          </div>

          {!dbAuthOk && !dbAuthLoading && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive">DB auth required — please refresh or log in first.</span>
              </CardContent>
            </Card>
          )}

          {traceError && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="p-3 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive font-mono">{traceError}</span>
              </CardContent>
            </Card>
          )}

          {traceResult && (() => {
            const inputs = traceResult.inputs ?? {};
            const sources = traceResult.sources ?? {};

            // Key rows to display — ordered for diagnosis
            const inputRows: { label: string; key: string; format: 'currency' | 'ratio' | 'id' | 'bool' }[] = [
              { label: 'Projected Revenue',             key: 'projected_revenue',                          format: 'currency' },
              { label: 'Contract Value Used',           key: 'contract_value_used',                        format: 'currency' },
              { label: 'Selected Estimate ID',          key: 'selected_estimate_id',                       format: 'id'       },
              { label: 'Estimate Total Cost',           key: 'estimate_total_cost',                        format: 'currency' },
              { label: 'Estimate Labor Cost',           key: 'estimate_labor_cost',                        format: 'currency' },
              { label: 'Estimate Material Cost',        key: 'estimate_material_cost',                     format: 'currency' },
              { label: 'Estimate Sub Cost',             key: 'estimate_sub_cost',                          format: 'currency' },
              { label: 'Actual Labor Cost to Date',     key: 'actual_labor_cost_to_date',                  format: 'currency' },
              { label: 'Actual Material Cost to Date',  key: 'actual_material_cost_to_date',               format: 'currency' },
              { label: 'Actual Sub Cost to Date',       key: 'actual_sub_cost_to_date',                    format: 'currency' },
              { label: 'Actual Total Cost to Date',     key: 'actual_total_cost_to_date',                  format: 'currency' },
              { label: 'Snapshot Actual Labor Cost',    key: 'snapshot_actual_labor_cost',                 format: 'currency' },
              { label: 'Snapshot Actual Total Cost',    key: 'snapshot_actual_total_cost',                 format: 'currency' },
              { label: 'Snapshot Realized Margin',      key: 'snapshot_realized_margin_ratio',             format: 'ratio'    },
              { label: 'Snapshot Cost/Revenue Ratio',   key: 'snapshot_cost_to_revenue_ratio',             format: 'ratio'    },
              { label: 'Labor Cost Ratio Used',         key: 'labor_cost_ratio_used',                      format: 'ratio'    },
              { label: 'Projected Margin Ratio Used',   key: 'projected_margin_at_completion_ratio_used',  format: 'ratio'    },
            ];

            const isZeroWarning = (key: string, val: any): boolean => {
              // Flag zeros on critical revenue/cost fields — not ratios (0 ratio is expected if no data)
              const criticalFields = [
                'projected_revenue', 'contract_value_used',
                'estimate_total_cost', 'actual_labor_cost_to_date',
              ];
              return criticalFields.includes(key) && (val === 0 || val === null || val === undefined);
            };

            const formatValue = (key: string, val: any, fmt: string): string => {
              if (val === null || val === undefined) return '—';
              if (fmt === 'id') return val ? (val as string).slice(0, 8) + '…' : '∅ none';
              if (fmt === 'ratio') return typeof val === 'number' ? val.toFixed(4) : String(val);
              if (fmt === 'currency') return typeof val === 'number' ? `$${val.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(val);
              return String(val);
            };

            return (
              <div className="space-y-4">
                {/* Header metadata */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>Project: <code className="font-mono text-foreground">{(traceResult.project_id as string)?.slice(0, 8)}…</code></span>
                  <span>Org: <code className="font-mono text-foreground">{(traceResult.org_id as string)?.slice(0, 8)}…</code></span>
                </div>

                {/* Inputs table */}
                <Card className="border">
                  <CardContent className="p-0">
                    <div className="px-4 py-2 border-b border-border bg-muted/40">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Engine Inputs</p>
                    </div>
                    <div className="divide-y divide-border">
                      {inputRows.map(({ label, key, format }) => {
                        const val = inputs[key];
                        const warn = isZeroWarning(key, val);
                        return (
                          <div key={key} className={`flex items-center justify-between px-4 py-2 ${warn ? 'bg-amber-500/5' : ''}`}>
                            <span className={`text-xs ${warn ? 'text-amber-700 font-medium' : 'text-muted-foreground'}`}>
                              {warn && '⚠ '}{label}
                            </span>
                            <span className={`text-xs font-mono ${
                              warn ? 'text-amber-700 font-bold' :
                              key === 'selected_estimate_id' && !val ? 'text-destructive' :
                              'text-foreground'
                            }`}>
                              {formatValue(key, val, format)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Sources table */}
                <Card className="border">
                  <CardContent className="p-0">
                    <div className="px-4 py-2 border-b border-border bg-muted/40">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Sources</p>
                    </div>
                    <div className="divide-y divide-border">
                      {Object.entries(sources).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between px-4 py-2">
                          <span className="text-xs text-muted-foreground">{k}</span>
                          <span className="text-xs font-mono text-foreground max-w-[60%] text-right">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Snapshot presence */}
                {inputs.engine_snapshot && (
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded border ${
                    inputs.engine_snapshot.snapshot_row_present
                      ? 'border-primary/30 bg-primary/5 text-primary'
                      : 'border-destructive/30 bg-destructive/5 text-destructive'
                  }`}>
                    {inputs.engine_snapshot.snapshot_row_present
                      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                    <span>
                      Snapshot row in <code className="font-mono">{inputs.engine_snapshot.snapshot_source}</code>:{' '}
                      <strong>{inputs.engine_snapshot.snapshot_row_present ? 'Present' : 'MISSING — all inputs will be 0'}</strong>
                    </span>
                  </div>
                )}

                {/* Copy JSON button + collapsible raw JSON */}
                <Collapsible>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={handleCopyTrace}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      {traceCopied ? 'Copied!' : 'Copy JSON'}
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <ChevronDown className="h-3.5 w-3.5 mr-1.5" /> Raw JSON
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <pre className="mt-2 p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-80 overflow-auto font-mono border border-border">
                      {JSON.stringify(traceResult, null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              </div>
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
              {/* Violation count badge */}
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

              {/* Suspect functions table */}
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

      </div>
    </Layout>
  );
}
