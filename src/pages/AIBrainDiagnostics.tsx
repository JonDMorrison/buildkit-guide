import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Play, Download, ChevronDown, CheckCircle2, XCircle, AlertTriangle, Copy, Brain, Shield, Eye, Zap, Lock, RefreshCw, User } from 'lucide-react';
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
      else { setResult(data); setRanAt(new Date().toISOString()); }
    } catch (e: any) { setError(e.message); }
    finally { setRunning(false); }
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
      </div>
    </Layout>
  );
}
