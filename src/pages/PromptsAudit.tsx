import { useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { useAuthRole } from '@/hooks/useAuthRole';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { NoAccess } from '@/components/NoAccess';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ShieldCheck, RefreshCw, Download, ChevronDown, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { runPromptsAudit, type PromptsAuditResult, type AuditCheck } from '@/lib/promptsAudit';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const severityColor: Record<string, string> = {
  P0: 'bg-destructive text-destructive-foreground',
  P1: 'bg-amber-600 text-white',
  P2: 'bg-muted text-muted-foreground',
};

const PassIcon = ({ pass }: { pass: boolean }) =>
  pass ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />;

export default function PromptsAudit() {
  const { currentProjectId } = useCurrentProject();
  const { isAdmin, isPM, loading: authLoading } = useAuthRole(currentProjectId ?? undefined);

  const { data: project } = useQuery({
    queryKey: ['project-name', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return null;
      const { data } = await supabase.from('projects').select('id,name').eq('id', currentProjectId).maybeSingle();
      return data;
    },
    enabled: !!currentProjectId,
  });

  const [results, setResults] = useState<PromptsAuditResult | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = useCallback(async () => {
    setRunning(true);
    try {
      const r = await runPromptsAudit(currentProjectId ?? '');
      setResults(r);
      toast.success('Audit complete');
    } catch (e: any) {
      toast.error('Audit failed: ' + e.message);
    } finally {
      setRunning(false);
    }
  }, [currentProjectId]);

  const exportJSON = useCallback(() => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompts-audit-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin && !isPM()) {
    return <Layout><NoAccess /></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-6 w-6" />
              Prompts 1–10 Audit Report
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              End-to-end verification of implemented features, security boundaries, and conversion logic.
              {project && <span className="text-primary ml-1">Project: {project.name}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {results && (
              <Button variant="outline" size="sm" onClick={exportJSON}>
                <Download className="h-4 w-4 mr-1" /> Download JSON
              </Button>
            )}
            <Button onClick={handleRun} disabled={running} size="sm">
              <RefreshCw className={`h-4 w-4 mr-1 ${running ? 'animate-spin' : ''}`} />
              {running ? 'Running…' : 'Run Audit'}
            </Button>
          </div>
        </div>

        {/* Metadata */}
        {results && (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground font-mono">
            <span>Timestamp: {new Date(results.ran_at).toLocaleString()}</span>
            <span>Environment: {results.environment}</span>
          </div>
        )}

        {/* Summary */}
        {results && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="Total Checks" value={results.summary.total} />
            <SummaryCard label="Pass" value={results.summary.pass} className="text-emerald-500" />
            <SummaryCard label="Fail" value={results.summary.fail} className="text-destructive" />
            <SummaryCard label="P0 Blockers" value={results.summary.blockers.length} className={results.summary.blockers.length > 0 ? 'text-destructive' : 'text-emerald-500'} />
          </div>
        )}

        {/* Blocker callout */}
        {results && results.summary.blockers.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                P0 Blockers ({results.summary.blockers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="text-sm space-y-1">
                {results.summary.blockers.map(b => (
                  <li key={b.id} className="flex items-center gap-2">
                    <XCircle className="h-3 w-3 text-destructive shrink-0" />
                    <span className="font-medium">{b.name}</span>
                    <span className="text-muted-foreground">— {b.actual}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Check table */}
        {results && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Checks</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left bg-muted/30">
                      <th className="py-2.5 px-4 font-medium text-muted-foreground w-8"></th>
                      <th className="py-2.5 px-4 font-medium text-muted-foreground">Check Name</th>
                      <th className="py-2.5 px-4 font-medium text-muted-foreground hidden md:table-cell">Area</th>
                      <th className="py-2.5 px-4 font-medium text-muted-foreground hidden lg:table-cell">Expected</th>
                      <th className="py-2.5 px-4 font-medium text-muted-foreground">Actual</th>
                      <th className="py-2.5 px-4 font-medium text-muted-foreground w-20 text-center">Result</th>
                      <th className="py-2.5 px-4 font-medium text-muted-foreground w-12 text-center">Sev</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.checks.map(check => (
                      <CheckRow key={check.id} check={check} />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!results && !running && (
          <Card>
            <CardContent className="py-16 text-center">
              <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Click "Run Audit" to execute all checks.</p>
              {!currentProjectId && (
                <p className="text-sm text-muted-foreground mt-2">Select a project first for workflow and conversion checks.</p>
              )}
            </CardContent>
          </Card>
        )}

        {running && (
          <Card>
            <CardContent className="py-16 text-center">
              <RefreshCw className="h-8 w-8 mx-auto text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">Running 13 checks…</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card>
      <CardContent className="py-4 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${className ?? 'text-foreground'}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function CheckRow({ check }: { check: AuditCheck }) {
  return (
    <Collapsible asChild>
      <>
        <CollapsibleTrigger asChild>
          <tr className={`border-b border-border cursor-pointer hover:bg-muted/20 transition-colors ${!check.pass ? 'bg-destructive/5' : ''}`}>
            <td className="py-2.5 px-4"><PassIcon pass={check.pass} /></td>
            <td className="py-2.5 px-4 font-medium">{check.name}</td>
            <td className="py-2.5 px-4 hidden md:table-cell text-muted-foreground">{check.area}</td>
            <td className="py-2.5 px-4 hidden lg:table-cell text-muted-foreground text-xs max-w-[200px] truncate">{check.expected}</td>
            <td className="py-2.5 px-4 text-xs max-w-[250px] truncate">{check.actual}</td>
            <td className="py-2.5 px-4 text-center">
              <Badge variant={check.pass ? 'default' : 'destructive'} className={`text-[10px] ${check.pass ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}>
                {check.pass ? 'PASS' : 'FAIL'}
              </Badge>
            </td>
            <td className="py-2.5 px-4 text-center">
              <Badge className={`text-[10px] ${severityColor[check.severity]}`}>{check.severity}</Badge>
            </td>
          </tr>
        </CollapsibleTrigger>
        <CollapsibleContent asChild>
          <tr className="border-b border-border">
            <td colSpan={7} className="py-3 px-4 bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground mb-1">Evidence:</p>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-muted/50 rounded p-3 max-h-[200px] overflow-auto">
                {check.evidence}
              </pre>
            </td>
          </tr>
        </CollapsibleContent>
      </>
    </Collapsible>
  );
}
