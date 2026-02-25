import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Play, ChevronDown, CheckCircle2, XCircle, AlertTriangle, Copy, Search, Zap, GitBranch, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

// ── Props ──────────────────────────────────────────────────────────────────

interface MarginToolsSectionProps {
  orgId: string | null;
  session: Session | null;
  projects: { id: string; name: string }[];
  dbAuthOk: boolean;
  dbAuthLoading: boolean;
}

// ── Main Section ───────────────────────────────────────────────────────────

export default function MarginToolsSection({ orgId, session, projects, dbAuthOk, dbAuthLoading }: MarginToolsSectionProps) {
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

  // Margin Inputs Trace state (canonical single instance)
  const [traceProject, setTraceProject] = useState<string>('');
  const [traceRunning, setTraceRunning] = useState(false);
  const [traceResult, setTraceResult] = useState<any>(null);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [traceCopied, setTraceCopied] = useState(false);

  // ── Handlers ─────────────────────────────────────────────────────────────

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

  const handleQuickProbe = async () => {
    if (!orgId || !dbAuthOk) return;
    setProbeRunning(true);
    setProbeError(null);
    setProbeRows([]);

    try {
      const { data: allProjects, error: projErr } = await supabase
        .from('projects')
        .select('id, name')
        .eq('organization_id', orgId)
        .not('status', 'in', '("completed","archived","deleted","cancelled")')
        .eq('is_deleted', false)
        .order('id', { ascending: true });

      if (projErr) throw new Error(projErr.message);
      const active = allProjects ?? [];

      const { data: teRows } = await supabase
        .from('time_entries')
        .select('project_id')
        .eq('organization_id', orgId)
        .order('project_id', { ascending: true })
        .limit(50);

      const projectsWithEntries = new Set((teRows ?? []).map((r: any) => r.project_id));

      const slot0 = active[0] ?? null;
      const slot1 = active.find(p => projectsWithEntries.has(p.id)) ?? null;
      const slot2 = active[2] ?? active[1] ?? null;

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

  const handleSeed = async () => {
    if (!orgId || !session) return;
    setSeedRunning(true);
    setSeedError(null);
    setSeedResult(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        'seed-margin-test-project',
        { body: { organizationId: orgId } }
      );
      if (fnErr) { setSeedError(fnErr.message); return; }
      if (data?.error) { setSeedError(data.error); return; }
      setSeedResult(data as SeedResult);
    } catch (e: any) { setSeedError(e.message); }
    finally { setSeedRunning(false); }
  };

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

  // ── Render ───────────────────────────────────────────────────────────────

  const dbAuthGuard = !dbAuthOk && !dbAuthLoading && (
    <Card className="border-destructive bg-destructive/5">
      <CardContent className="p-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-sm text-destructive">DB auth required — please refresh or log in first.</span>
      </CardContent>
    </Card>
  );

  return (
    <>
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

        {dbAuthGuard}

        {inspectorError && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-sm text-destructive font-mono">{inspectorError}</span>
            </CardContent>
          </Card>
        )}

        {inspectorResult && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground font-mono">
              <span>project: {inspectorResult.project_id?.slice(0, 8)}…</span>
              <span>org: {inspectorResult.org_id?.slice(0, 8)}…</span>
            </div>

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
            disabled={probeRunning || !dbAuthOk || !orgId}
          >
            <Zap className={`h-4 w-4 mr-1.5 ${probeRunning ? 'animate-pulse' : ''}`} />
            {probeRunning ? 'Probing…' : 'Quick Probe (3 Projects)'}
          </Button>
        </div>

        {dbAuthGuard}

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
            <div className="grid grid-cols-[1fr_1fr_1fr_80px_auto] gap-x-3 px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
              <span>Project</span>
              <span>Risk Score</span>
              <span>Economic Position</span>
              <span>Flags Type</span>
              <span>Flags</span>
            </div>

            {probeRows.map((row, i) => (
              <div key={row.project_id} className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_1fr_80px_auto] gap-x-3 items-center px-3 py-2.5 text-xs">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-muted-foreground truncate">
                      {row.project_id.slice(0, 8)}…
                    </div>
                    <div className="text-[11px] text-foreground truncate font-medium">{row.project_name}</div>
                    <div className="text-[10px] text-muted-foreground">{(row as any).label}</div>
                  </div>

                  <div className="font-mono text-xs">
                    {(row as any).error
                      ? <span className="text-destructive text-[10px]">ERR</span>
                      : String(row.risk_score ?? '—')}
                  </div>

                  <div className="font-mono text-xs truncate">
                    {(row as any).error
                      ? <span className="text-destructive text-[10px] font-mono">{(row as any).error}</span>
                      : String(row.economic_position ?? '—')}
                  </div>

                  <div>
                    <code className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                      row.intervention_flags_type === 'array'
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : row.intervention_flags_type === 'null'
                        ? 'bg-muted text-muted-foreground border-border'
                        : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                    }`}>
                      {row.intervention_flags_type}
                    </code>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {row.intervention_flags_value.length > 0
                      ? row.intervention_flags_value.map((f, fi) => (
                          <Badge key={fi} className="bg-destructive/10 text-destructive border-destructive/20 border text-[10px] font-mono px-1.5 py-0">
                            {String(f)}
                          </Badge>
                        ))
                      : <span className="text-[10px] text-muted-foreground italic">none</span>}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-auto shrink-0"
                      onClick={() => toggleProbeRow(i)}
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${row.open ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                </div>

                {row.open && row.raw && (
                  <div className="border-t border-border px-3 py-2">
                    <pre className="text-[10px] bg-muted/50 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono">
                      {JSON.stringify(row.raw, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Seed Margin Test Project ────────────────────────────── */}
      <div className="border-t pt-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Seed Margin Test Project</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Creates a synthetic project with estimate + time entries designed to trigger margin flags.
              Idempotent — if the project already exists, it returns the existing one.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSeed}
            disabled={seedRunning || !orgId || !session}
          >
            <Play className={`h-4 w-4 mr-1.5 ${seedRunning ? 'animate-pulse' : ''}`} />
            {seedRunning ? 'Seeding…' : 'Seed Test Project'}
          </Button>
        </div>

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

      {/* ─── Margin Inputs Trace (canonical single instance) ─────────── */}
      <div className="border-t pt-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
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

        {dbAuthGuard}

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
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span>Project: <code className="font-mono text-foreground">{(traceResult.project_id as string)?.slice(0, 8)}…</code></span>
                <span>Org: <code className="font-mono text-foreground">{(traceResult.org_id as string)?.slice(0, 8)}…</code></span>
              </div>

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

              {inputs.engine_snapshot && (
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded border ${
                  inputs.engine_snapshot.snapshot_row_present
                    ? 'border-primary/30 bg-primary/5 text-primary'
                    : 'border-destructive/30 bg-destructive/5 text-destructive'
                }`}>
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Snapshot row {inputs.engine_snapshot.snapshot_row_present ? 'present' : 'MISSING'}{' '}
                    {inputs.engine_snapshot.snapshot_date && `(${inputs.engine_snapshot.snapshot_date})`}
                  </span>
                </div>
              )}

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
    </>
  );
}
