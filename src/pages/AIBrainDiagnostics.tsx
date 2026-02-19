import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Play, Download, ChevronDown, CheckCircle2, XCircle, AlertTriangle, Copy, Brain, Shield, Eye, Zap, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';

type SectionStatus = 'pass' | 'fail' | 'pending';

interface SectionResult {
  label: string;
  icon: typeof CheckCircle2;
  status: SectionStatus;
  details: Record<string, any>;
}

function StatusBadge({ ok }: { ok: boolean }) {
  return ok
    ? <Badge className="bg-primary/10 text-primary text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />PASS</Badge>
    : <Badge className="bg-destructive/10 text-destructive text-xs"><XCircle className="h-3 w-3 mr-1" />FAIL</Badge>;
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

export default function AIBrainDiagnostics() {
  const { activeOrganizationId } = useOrganization();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);

  useEffect(() => {
    if (!activeOrganizationId) return;
    supabase.from('projects').select('id, name').eq('organization_id', activeOrganizationId)
      .order('name').then(({ data }) => setProjects(data || []));
  }, [activeOrganizationId]);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (selectedProject) params.p_project_id = selectedProject;

      const { data, error: rpcError } = await (supabase as any).rpc('rpc_run_ai_brain_test_runner', params);

      if (rpcError) {
        setError(rpcError.message);
        setResult(null);
      } else {
        setResult(data);
        setRanAt(new Date().toISOString());
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-brain-diagnostics-${(ranAt || new Date().toISOString()).slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Parse result into sections
  const sections: SectionResult[] = result ? [
    {
      label: 'Existence — Views & Functions',
      icon: Eye,
      status: result.existence
        ? Object.values(result.existence.views || {}).every(Boolean) && Object.values(result.existence.functions || {}).every(Boolean)
          ? 'pass' : 'fail'
        : 'pending',
      details: result.existence || {},
    },
    {
      label: 'Security — SECURITY DEFINER & Pinned search_path',
      icon: Shield,
      status: result.security
        ? Object.values(result.security).every((v: any) => v?.security_definer && v?.search_path_pinned)
          ? 'pass' : 'fail'
        : 'pending',
      details: result.security || {},
    },
    {
      label: 'Privileges — Public/Anon Denied',
      icon: Lock,
      status: result.privileges
        ? Object.values(result.privileges).every((v: any) => !v?.public_can_execute && !v?.anon_can_execute)
          ? 'pass' : 'fail'
        : 'pending',
      details: result.privileges || {},
    },
    {
      label: 'Smoke Tests — RPCs Execute Successfully',
      icon: Zap,
      status: result.smoke
        ? Object.values(result.smoke).every((v: any) => v?.success)
          ? 'pass' : 'fail'
        : 'pending',
      details: result.smoke || {},
    },
    {
      label: 'Determinism — Identical Consecutive Calls',
      icon: CheckCircle2,
      status: result.determinism
        ? Object.values(result.determinism).every(Boolean)
          ? 'pass' : 'fail'
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
            <Button onClick={handleRun} disabled={running}>
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
            {/* Summary */}
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

            {/* Context */}
            {(result.project_id || result.org_id) && (
              <div className="flex gap-4 text-xs text-muted-foreground">
                {result.project_id && <span>Project: <span className="font-mono">{result.project_id}</span></span>}
                {result.org_id && <span>Org: <span className="font-mono">{result.org_id}</span></span>}
              </div>
            )}

            {/* Skipped */}
            {result.skipped && (
              <Card className="border-accent bg-accent/10">
                <CardContent className="p-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-accent-foreground" />
                  <span className="text-sm">Tests skipped: {result.reason}</span>
                </CardContent>
              </Card>
            )}

            {/* Section cards */}
            {!result.skipped && (
              <div className="space-y-3">
                {sections.map(s => (
                  <SectionCard key={s.label} section={s} />
                ))}
              </div>
            )}

            {/* Raw JSON */}
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
