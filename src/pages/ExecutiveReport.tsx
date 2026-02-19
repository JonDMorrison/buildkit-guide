import { useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  RefreshCw, AlertTriangle,
  Shield, Award, Crown, Gem, ExternalLink, BarChart3, Zap,
  Copy, Check, Printer, FileText, Target, ShieldAlert, HelpCircle,
} from 'lucide-react';
import { getCause } from '@/lib/causesDictionary';

// ── Types ────────────────────────────────────────────────────────────────────

interface TopProject {
  project_id: string;
  project_name: string;
  risk_score: number;
  economic_position: 'at_risk' | 'volatile' | 'stable';
  executive_summary: string;
}

interface TopCause {
  cause: string;
  count: number;
}

interface OsScore {
  score: number;
  tier: string;
  breakdown?: Record<string, number>;
}

interface RiskSummary {
  org_id: string;
  projects_active_count: number;
  at_risk_count: number;
  volatile_count: number;
  stable_count: number;
  avg_projected_margin_at_completion_percent: number;
  top_risk_projects: TopProject[];
  top_causes: TopCause[];
  os_score: OsScore;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function humanCause(cause: string) {
  return getCause(cause).label;
}

function fmt(n: number, decimals = 1) {
  return n.toFixed(decimals);
}

function guardrailMode(atRisk: number, riskScore: number): 'block' | 'warn' | 'none' {
  if (atRisk > 0 && riskScore > 60) return 'block';
  if (atRisk > 0 || riskScore >= 30) return 'warn';
  return 'none';
}

const GUARDRAIL_LABEL: Record<string, string> = {
  block: 'Block — critical actions require director approval',
  warn:  'Warn — flag elevated-risk actions for PM review',
  none:  'None — all operations within acceptable thresholds',
};

// ── Sub-components ───────────────────────────────────────────────────────────

function TierIcon({ tier }: { tier?: string }) {
  const t = (tier ?? '').toLowerCase();
  if (t === 'platinum') return <Gem   className="h-4 w-4 text-primary" />;
  if (t === 'gold')     return <Crown className="h-4 w-4 text-accent-foreground" />;
  if (t === 'silver')   return <Award className="h-4 w-4 text-muted-foreground" />;
  return <Shield className="h-4 w-4 text-destructive/70" />;
}

function TierBadge({ tier }: { tier?: string }) {
  const t = (tier ?? 'Bronze').toLowerCase();
  const map: Record<string, string> = {
    platinum: 'bg-primary/10 text-primary border-primary/30',
    gold:     'bg-accent text-accent-foreground border-accent',
    silver:   'bg-muted text-muted-foreground border-border',
    bronze:   'bg-destructive/10 text-destructive/80 border-destructive/20',
  };
  return (
    <Badge className={`border text-xs font-semibold ${map[t] ?? map.bronze}`}>
      {tier ?? 'Bronze'}
    </Badge>
  );
}

function PositionBadge({ position }: { position: string }) {
  if (position === 'at_risk')  return <Badge className="bg-destructive/10 text-destructive border-destructive/30 border text-xs">At Risk</Badge>;
  if (position === 'volatile') return <Badge className="bg-secondary text-secondary-foreground border text-xs">Volatile</Badge>;
  return <Badge className="bg-primary/10 text-primary border-primary/30 border text-xs">Stable</Badge>;
}

function RiskBar({ score }: { score: number }) {
  const color = score > 60 ? 'bg-destructive' : score >= 30 ? 'bg-accent-foreground/60' : 'bg-primary';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-6 text-right">{score}</span>
    </div>
  );
}

// ── Value Narrative (fully templated, zero randomness) ───────────────────────

function buildNarrative(d: RiskSummary, date: string): string {
  const margin   = fmt(d.avg_projected_margin_at_completion_percent);
  const at_risk  = d.at_risk_count;
  const volatile = d.volatile_count;
  const stable   = d.stable_count;
  const active   = d.projects_active_count;
  const os       = d.os_score?.score ?? 0;
  const tier     = d.os_score?.tier ?? 'Bronze';

  const top2causes = d.top_causes
    .slice(0, 2)
    .map(c => humanCause(c.cause).toLowerCase());

  const causeText = top2causes.length === 2
    ? `${top2causes[0]} and ${top2causes[1]}`
    : top2causes[0] ?? 'unclassified risk factors';

  const topRisk = d.top_risk_projects[0];
  const topRiskName = topRisk ? topRisk.project_name : null;

  const maxRiskScore = topRisk?.risk_score ?? 0;
  const guardrail = guardrailMode(at_risk, maxRiskScore);

  const positionLine =
    at_risk > 0
      ? `${at_risk} project${at_risk > 1 ? 's are' : ' is'} at risk, ${volatile} volatile, and ${stable} stable`
      : volatile > 0
      ? `No projects are at critical risk — ${volatile} remain volatile and ${stable} are stable`
      : `All ${active} active project${active !== 1 ? 's' : ''} are operating within safe margin thresholds`;

  const marginLine =
    d.avg_projected_margin_at_completion_percent > 15
      ? `Average projected margin at completion is ${margin}%, which is above the healthy threshold.`
      : d.avg_projected_margin_at_completion_percent > 0
      ? `Average projected margin at completion is ${margin}%, which is below the recommended 15% target.`
      : `Average projected margin at completion is ${margin}% — immediate financial review is recommended.`;

  const topProjectLine = topRiskName
    ? `The highest-risk project is "${topRiskName}" with a risk score of ${maxRiskScore}.`
    : '';

  const guardrailLine = `Recommended control mode: ${guardrail.toUpperCase()} — ${GUARDRAIL_LABEL[guardrail]}.`;

  return [
    `EXECUTIVE RISK REPORT — ${date}`,
    `Organization Operating System Score: ${os}/100 (${tier} Certification)`,
    '',
    `As of ${date}, ${active} active project${active !== 1 ? 's are' : ' is'} tracked. ${positionLine}.`,
    `Primary risk drivers are ${causeText}. ${marginLine}`,
    topProjectLine,
    '',
    guardrailLine,
  ].filter(Boolean).join('\n');
}

function ValueNarrative({ data, date }: { data: RiskSummary; date: string }) {
  const margin   = fmt(data.avg_projected_margin_at_completion_percent);
  const at_risk  = data.at_risk_count;
  const volatile = data.volatile_count;
  const stable   = data.stable_count;
  const active   = data.projects_active_count;
  const os       = data.os_score?.score ?? 0;
  const tier     = data.os_score?.tier ?? 'Bronze';

  const top2causes = data.top_causes
    .slice(0, 2)
    .map(c => humanCause(c.cause).toLowerCase());

  const causeText = top2causes.length === 2
    ? `${top2causes[0]} and ${top2causes[1]}`
    : top2causes[0] ?? 'unclassified risk factors';

  const maxRiskScore = data.top_risk_projects[0]?.risk_score ?? 0;
  const guardrail = guardrailMode(at_risk, maxRiskScore);

  const positionSentence =
    at_risk > 0
      ? <><span className="font-semibold text-destructive">{at_risk} project{at_risk > 1 ? 's' : ''}</span> at risk, <span className="font-semibold">{volatile}</span> volatile, and <span className="font-semibold text-primary">{stable}</span> stable</>
      : volatile > 0
      ? <>No projects at critical risk — <span className="font-semibold">{volatile}</span> volatile, <span className="font-semibold text-primary">{stable}</span> stable</>
      : <><span className="font-semibold text-primary">All {active} projects</span> within safe margin thresholds</>;

  const marginColor =
    data.avg_projected_margin_at_completion_percent > 15 ? 'text-primary' :
    data.avg_projected_margin_at_completion_percent > 0  ? 'text-accent-foreground' :
    'text-destructive';

  return (
    <Card className="border-primary/20 print:border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Value Narrative</CardTitle>
          <Badge variant="outline" className="ml-auto text-xs text-muted-foreground">Template-generated · no AI</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed">
        {/* OS lead */}
        <p className="text-muted-foreground">
          The organization's Operating System Score is{' '}
          <span className="font-bold text-primary tabular-nums">{os}/100</span> —{' '}
          <TierBadge tier={tier} /> certification.
        </p>

        {/* Risk position */}
        <p>
          As of <span className="font-medium">{date}</span>, across {active} active project{active !== 1 ? 's' : ''}:{' '}
          {positionSentence}.{' '}
          Primary risk drivers are{' '}
          <span className="font-medium">{causeText}</span>.
        </p>

        {/* Margin */}
        <p>
          Average projected margin at completion is{' '}
          <span className={`font-bold tabular-nums ${marginColor}`}>{margin}%</span>.{' '}
          {data.avg_projected_margin_at_completion_percent > 15
            ? 'Margin trajectory is above the healthy threshold.'
            : data.avg_projected_margin_at_completion_percent > 0
            ? 'Margin is below the recommended 15% target — review is advised.'
            : 'Immediate financial review is recommended.'}
        </p>

        {/* Guardrail */}
        <div className={`rounded-md border p-3 flex items-start gap-2.5 ${
          guardrail === 'block' ? 'border-destructive/30 bg-destructive/5' :
          guardrail === 'warn'  ? 'border-accent bg-accent/10' :
          'border-primary/20 bg-primary/5'
        }`}>
          <ShieldAlert className={`h-4 w-4 shrink-0 mt-px ${
            guardrail === 'block' ? 'text-destructive' :
            guardrail === 'warn'  ? 'text-accent-foreground' :
            'text-primary'
          }`} />
          <p>
            <span className="font-semibold">Recommended control mode:{' '}
              <span className="uppercase">{guardrail}</span>
            </span>{' '}
            — {GUARDRAIL_LABEL[guardrail]}.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Copy Summary Button ───────────────────────────────────────────────────────

function CopySummaryButton({ data, date }: { data: RiskSummary; date: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = buildNarrative(data, date);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? <Check className="h-4 w-4 mr-2 text-primary" /> : <Copy className="h-4 w-4 mr-2" />}
      {copied ? 'Copied!' : 'Copy Summary'}
    </Button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExecutiveReport() {
  const { activeOrganizationId } = useOrganization();
  const [data, setData]       = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [ranAt, setRanAt]     = useState<string | null>(null);
  const reportDate = ranAt ?? new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  const refresh = useCallback(async () => {
    if (!activeOrganizationId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: rpcError } = await (supabase as any).rpc(
        'rpc_get_executive_risk_summary',
        { p_org_id: activeOrganizationId }
      );
      if (rpcError) throw new Error(rpcError.message);
      setData(result as RiskSummary);
      setRanAt(new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId]);

  return (
    <TooltipProvider>
    <Layout>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">Executive Risk Report</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Shareable, printable summary of operating health and project risk.
            </p>
            {ranAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Generated <span className="font-medium">{ranAt}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 no-print flex-wrap">
            {data && <CopySummaryButton data={data} date={reportDate} />}
            {data && (
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Print / Save PDF
              </Button>
            )}
            <Button onClick={refresh} disabled={loading || !activeOrganizationId} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading…' : data ? 'Refresh' : 'Generate Report'}
            </Button>
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────────── */}
        {error && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-sm text-destructive">{error}</span>
            </CardContent>
          </Card>
        )}

        {/* ── Empty state ──────────────────────────────────── */}
        {!data && !loading && !error && (
          <Card className="border-dashed">
            <CardContent className="p-14 text-center text-muted-foreground">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium mb-1">No data loaded</p>
              <p className="text-xs">Click <strong>Generate Report</strong> to pull the latest risk data for your organization.</p>
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="space-y-6">

            {/* ── Section 1: OS Score + Tier ────────────────── */}
            <div>
              <SectionLabel icon={<Zap className="h-4 w-4" />} title="Operating System Health" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                {/* Score */}
                <Card className="sm:col-span-1 border-primary/20">
                  <CardContent className="p-5 space-y-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">OS Score</p>
                    <div className="flex items-end gap-2">
                      <span className="text-5xl font-bold tabular-nums text-primary">
                        {data.os_score?.score ?? '—'}
                      </span>
                      <span className="text-muted-foreground text-sm mb-1.5">/ 100</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TierIcon tier={data.os_score?.tier} />
                      <TierBadge tier={data.os_score?.tier} />
                    </div>
                  </CardContent>
                </Card>

                {/* Score breakdown */}
                <Card className="sm:col-span-2">
                  <CardContent className="p-5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Score Breakdown</p>
                    {data.os_score?.breakdown ? (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                        {Object.entries(data.os_score.breakdown).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-xs border-b border-border/50 pb-1.5">
                            <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span>
                            <span className="font-mono font-semibold">{v}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No breakdown available.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Separator />

            {/* ── Section 2: Projects at Risk ───────────────── */}
            <div>
              <SectionLabel icon={<Target className="h-4 w-4" />} title="Projects at Risk" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                {[
                  { label: 'Active',   value: data.projects_active_count,                     cls: 'text-foreground' },
                  { label: 'At Risk',  value: data.at_risk_count,                              cls: 'text-destructive' },
                  { label: 'Volatile', value: data.volatile_count,                             cls: 'text-accent-foreground' },
                  { label: 'Stable',   value: data.stable_count,                               cls: 'text-primary' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="rounded-lg border bg-muted/30 p-4 text-center">
                    <div className={`text-4xl font-bold tabular-nums ${cls}`}>{value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {/* Avg margin */}
              <div className="mt-4 rounded-lg border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Projected Margin at Completion</p>
                <p className={`text-2xl font-bold tabular-nums mt-0.5 ${
                  data.avg_projected_margin_at_completion_percent > 15 ? 'text-primary' :
                  data.avg_projected_margin_at_completion_percent > 0  ? 'text-accent-foreground' :
                  'text-destructive'
                }`}>
                  {fmt(data.avg_projected_margin_at_completion_percent)}%
                </p>
              </div>
            </div>

            <Separator />

            {/* ── Section 3: Top Causes ─────────────────────── */}
            {data.top_causes.length > 0 && (
              <div>
                <SectionLabel icon={<AlertTriangle className="h-4 w-4" />} title="Top Risk Causes" />
                <div className="mt-3 space-y-2">
                  {data.top_causes.slice(0, 5).map((c, i) => {
                    const def = getCause(c.cause);
                    const max = data.top_causes[0]?.count ?? 1;
                    const pct = Math.round((c.count / max) * 100);
                    return (
                      <div key={c.cause} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground font-mono w-4 shrink-0">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-1 gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="truncate">{def.label}</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-muted-foreground/50 shrink-0 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs space-y-1.5 p-3">
                                  <p className="font-semibold text-xs">{def.label}</p>
                                  <p className="text-xs leading-relaxed">{def.whyItMatters}</p>
                                  <p className="text-xs text-muted-foreground border-t pt-1.5 leading-relaxed">
                                    <span className="font-medium">Margin impact:</span> {def.marginImpact}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <span className="font-mono font-semibold text-destructive shrink-0">{c.count}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-destructive/60 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* ── Section 4: Top Risk Projects ──────────────── */}
            {data.top_risk_projects.length > 0 && (
              <div>
                <SectionLabel icon={<BarChart3 className="h-4 w-4" />} title="Top Risk Projects" />
                <div className="mt-3 space-y-3">
                  {data.top_risk_projects.map((p, i) => (
                    <Card key={p.project_id} className={
                      p.economic_position === 'at_risk'  ? 'border-destructive/30' :
                      p.economic_position === 'volatile' ? 'border-accent' :
                      'border-primary/20'
                    }>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-muted-foreground font-mono mt-1 shrink-0 w-5">#{i + 1}</span>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{p.project_name}</span>
                              <PositionBadge position={p.economic_position} />
                            </div>
                            <RiskBar score={p.risk_score} />
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {p.executive_summary}
                            </p>
                            <Link
                              to={`/projects/${p.project_id}`}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline no-print"
                            >
                              <ExternalLink className="h-3 w-3" /> View Project
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* ── Section 5: Value Narrative ────────────────── */}
            <ValueNarrative data={data} date={reportDate} />

            {/* ── Footer ──────────────────────────────────────── */}
            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              Report generated {reportDate} · All figures sourced from live project data · No AI-generated content
            </div>

          </div>
        )}
      </div>
    </Layout>
    </TooltipProvider>
  );
}

// ── Section label helper ──────────────────────────────────────────────────────

function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</h2>
    </div>
  );
}
