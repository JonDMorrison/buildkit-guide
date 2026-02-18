import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Play, Download, ChevronDown, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { runPromptsAudit, type PromptsAuditResult, type AuditCheck, type AuditStatus } from '@/lib/promptsAudit';
import { useOrganization } from '@/hooks/useOrganization';

const STORAGE_KEY = 'prompts_audit_last_result';

const statusConfig: Record<AuditStatus, { label: string; class: string; icon: typeof CheckCircle2 }> = {
  PASS: { label: 'PASS', class: 'bg-primary/10 text-primary', icon: CheckCircle2 },
  FAIL: { label: 'FAIL', class: 'bg-destructive/10 text-destructive', icon: AlertTriangle },
  NEEDS_MANUAL: { label: 'NEEDS MANUAL', class: 'bg-accent text-accent-foreground', icon: HelpCircle },
};

const severityClass: Record<string, string> = {
  P0: 'border-destructive/50 bg-destructive/5',
  P1: 'border-amber-500/50 bg-amber-500/5',
  P2: 'border-muted-foreground/20',
};

function CheckCard({ check }: { check: AuditCheck }) {
  const cfg = statusConfig[check.status];
  const Icon = cfg.icon;
  return (
    <Card className={`${severityClass[check.severity]} border`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 shrink-0" />
            <span className="font-medium text-sm truncate">{check.name}</span>
            <Badge variant="outline" className="text-xs shrink-0">{check.severity}</Badge>
            <Badge variant="outline" className="text-xs shrink-0">{check.area}</Badge>
          </div>
          <Badge className={`${cfg.class} text-xs shrink-0`}>{cfg.label}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div><span className="font-medium">Expected:</span> {check.expected}</div>
          <div><span className="font-medium">Actual:</span> {check.actual}</div>
        </div>
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-3 w-3" /> Evidence
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-1 p-2 bg-muted rounded text-xs whitespace-pre-wrap max-h-40 overflow-auto">{check.evidence}</pre>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export default function InsightsAudit() {
  const { activeOrganizationId } = useOrganization();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PromptsAuditResult | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (!activeOrganizationId) return;
    supabase.from('projects').select('id, name').eq('organization_id', activeOrganizationId)
      .order('name').then(({ data }) => setProjects(data || []));
  }, [activeOrganizationId]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const r = await runPromptsAudit(selectedProject);
      setResult(r);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
    } finally {
      setRunning(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${result.ran_at.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const grouped = result ? {
    P0: result.checks.filter(c => c.severity === 'P0'),
    P1: result.checks.filter(c => c.severity === 'P1'),
    P2: result.checks.filter(c => c.severity === 'P2'),
  } : null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Prompts 1-10 Implementation Audit</h1>
          {result && (
            <p className="text-sm text-muted-foreground mt-1">
              Last run: {new Date(result.ran_at).toLocaleString()} | Env: {result.environment}
            </p>
          )}
        </div>

        <Card>
          <CardContent className="p-4 flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Project</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger><SelectValue placeholder="Select a project..." /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleRun} disabled={running}>
              <Play className="h-4 w-4 mr-2" />
              {running ? 'Running...' : 'Run Audit'}
            </Button>
            {result && (
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" /> JSON
              </Button>
            )}
          </CardContent>
        </Card>

        {result && (
          <>
            <div className="grid grid-cols-4 gap-3">
              <Card><CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{result.summary.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </CardContent></Card>
              <Card className="border-primary/30"><CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{result.summary.pass}</div>
                <div className="text-xs text-muted-foreground">Pass</div>
              </CardContent></Card>
              <Card className="border-destructive/30"><CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-destructive">{result.summary.fail}</div>
                <div className="text-xs text-muted-foreground">Fail</div>
              </CardContent></Card>
              <Card className="border-accent/50"><CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-accent-foreground">{result.summary.needs_manual}</div>
                <div className="text-xs text-muted-foreground">Manual</div>
              </CardContent></Card>
            </div>

            {result.summary.blockers.length > 0 && (
              <Card className="border-destructive bg-destructive/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {result.summary.blockers.length} P0 Blocker(s)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="text-sm space-y-1">
                    {result.summary.blockers.map(b => (
                      <li key={b.id}>
                        <Badge className={statusConfig[b.status].class + ' text-xs mr-2'}>{b.status}</Badge>
                        {b.name}: {b.actual}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {grouped && (['P0', 'P1', 'P2'] as const).map(sev => {
              const items = grouped[sev];
              if (items.length === 0) return null;
              return (
                <div key={sev} className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">{sev} Checks ({items.length})</h2>
                  {items.map(c => <CheckCard key={c.id} check={c} />)}
                </div>
              );
            })}
          </>
        )}
      </div>
    </Layout>
  );
}
