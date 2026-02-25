import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { NoAccess } from '@/components/NoAccess';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Download, ChevronDown, AlertTriangle, CheckCircle2, HelpCircle, Server, Monitor, Wrench, ShieldAlert, Copy, Ban, Loader2 } from 'lucide-react';
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
  const SourceIcon = check.source === 'server' ? Server : Monitor;
  return (
    <Card className={`${severityClass[check.severity]} border`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 shrink-0" />
            <span className="font-medium text-sm truncate">{check.name}</span>
            <Badge variant="outline" className="text-xs shrink-0">{check.severity}</Badge>
            <Badge variant="outline" className="text-xs shrink-0">{check.area}</Badge>
            <SourceIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
          </div>
          <Badge className={`${cfg.class} text-xs shrink-0`}>{cfg.label}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div><span className="font-medium">Expected:</span> {check.expected}</div>
          <div><span className="font-medium">Actual:</span> {check.actual}</div>
        </div>

        {/* Remediation */}
        {check.remediation && (
          <div className="flex items-start gap-1.5 mt-1 p-2 rounded bg-muted text-xs">
            <Wrench className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
            <span className="whitespace-pre-wrap">{check.remediation}</span>
          </div>
        )}

        {/* Offender samples */}
        {check.offenders && check.offenders.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80">
              <ChevronDown className="h-3 w-3" /> {check.offenders.length} Offender Sample(s)
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(check.offenders[0]).map(k => (
                        <TableHead key={k} className="text-xs py-1 px-2">{k}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {check.offenders.map((row, i) => (
                      <TableRow key={i}>
                        {Object.values(row).map((v, j) => (
                          <TableCell key={j} className="text-xs py-1 px-2 font-mono">{String(v ?? '—')}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

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

/** Admin-only: exposes P0/P1 audit checks for RLS, currency, variance, etc. */
export default function InsightsAudit() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { activeOrganizationId } = useOrganization();

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <NoAccess message="Admin access required." />
      </Layout>
    );
  }

  return <InsightsAuditContent orgId={activeOrganizationId} />;
}

function InsightsAuditContent({ orgId }: { orgId: string | null }) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PromptsAuditResult | null>(null);

  useEffect(() => {
    if (!orgId) return;
    supabase.from('projects').select('id, name').eq('organization_id', orgId)
      .order('name').then(({ data }) => setProjects(data || []));
  }, [orgId]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const r = await runPromptsAudit(selectedProject);
      setResult(r);
      // No localStorage caching — always show fresh results
    } finally {
      setRunning(false);
    }
  };

  const handleCopyBundle = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
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

  const p0Failures = result ? result.checks.filter(c => c.severity === 'P0' && c.status === 'FAIL') : [];
  const releaseBlocked = p0Failures.length > 0;

  const grouped = result ? {
    P0: result.checks.filter(c => c.severity === 'P0'),
    P1: result.checks.filter(c => c.severity === 'P1'),
    P2: result.checks.filter(c => c.severity === 'P2'),
  } : null;

  const serverChecks = result ? result.checks.filter(c => c.source === 'server') : [];
  const clientChecks = result ? result.checks.filter(c => c.source !== 'server') : [];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Expanded Audit Suite</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            P0/P1 checks for RLS, currency, variance, labor inclusion, and workflow correctness.
          </p>
          {result && (
            <p className="text-xs text-muted-foreground mt-1">
              Run ID: <span className="font-mono">{result.ran_at}</span> | Env: {result.environment} | 
              <Server className="inline h-3 w-3 mx-1" />{serverChecks.length} server • 
              <Monitor className="inline h-3 w-3 mx-1" />{clientChecks.length} client
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
              <>
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" /> JSON
                </Button>
                <Button variant="outline" onClick={handleCopyBundle}>
                  <Copy className="h-4 w-4 mr-2" /> Copy Debug Bundle
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {result && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-5 gap-3">
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
              <Card className="border-destructive/50"><CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-destructive">{result.summary.blockers.length}</div>
                <div className="text-xs text-muted-foreground">P0 Blockers</div>
              </CardContent></Card>
            </div>

            {/* Release gate banner */}
            {releaseBlocked && (
              <Card className="border-2 border-destructive bg-destructive/10">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Ban className="h-6 w-6 text-destructive shrink-0" />
                    <div>
                      <h2 className="text-lg font-bold text-destructive">Release Blocked: Fix P0 issues before shipping.</h2>
                      <p className="text-sm text-destructive/80">{p0Failures.length} critical check{p0Failures.length > 1 ? 's' : ''} failed. Resolve all items below to unblock.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {p0Failures.map(c => (
                      <div key={c.id} className="border border-destructive/30 rounded-md p-3 bg-background space-y-1.5">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
                          <span className="font-semibold text-sm">{c.name}</span>
                          <Badge variant="outline" className="text-xs">{c.area}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground"><strong>Actual:</strong> {c.actual}</p>
                        {c.remediation && (
                          <div className="flex items-start gap-1.5 p-2 rounded bg-muted text-xs">
                            <Wrench className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                            <span className="whitespace-pre-wrap">{c.remediation}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Non-blocking blockers banner (P0 NEEDS_MANUAL) */}
            {!releaseBlocked && result.summary.blockers.length > 0 && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {result.summary.blockers.length} P0 item(s) need manual verification
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="text-sm space-y-1">
                    {result.summary.blockers.map(b => (
                      <li key={b.id}>
                        <Badge className={statusConfig[b.status].class + ' text-xs mr-2'}>{b.status}</Badge>
                        <strong>{b.name}:</strong> {b.actual}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Tabs: By Severity or By Source */}
            <Tabs defaultValue="severity">
              <TabsList>
                <TabsTrigger value="severity">By Severity</TabsTrigger>
                <TabsTrigger value="source">By Source</TabsTrigger>
              </TabsList>

              <TabsContent value="severity" className="space-y-6 mt-4">
                {grouped && (['P0', 'P1', 'P2'] as const).map(sev => {
                  const items = grouped[sev];
                  if (items.length === 0) return null;
                  const passCount = items.filter(c => c.status === 'PASS').length;
                  return (
                    <div key={sev} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-muted-foreground">
                          {sev} Checks ({items.length})
                        </h2>
                        <Badge variant={passCount === items.length ? 'default' : 'destructive'} className="text-xs">
                          {passCount}/{items.length} pass
                        </Badge>
                      </div>
                      {items.map(c => <CheckCard key={c.id} check={c} />)}
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="source" className="space-y-6 mt-4">
                {serverChecks.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                      <Server className="h-3.5 w-3.5" /> Server-Side Checks ({serverChecks.length})
                    </h2>
                    {serverChecks.map(c => <CheckCard key={c.id} check={c} />)}
                  </div>
                )}
                {clientChecks.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                      <Monitor className="h-3.5 w-3.5" /> Client-Side Checks ({clientChecks.length})
                    </h2>
                    {clientChecks.map(c => <CheckCard key={c.id} check={c} />)}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </Layout>
  );
}
