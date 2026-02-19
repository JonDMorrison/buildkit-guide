import { useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuthRole } from '@/hooks/useAuthRole';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { NoAccess } from '@/components/NoAccess';
import {
  CheckCircle2, XCircle, Loader2, RefreshCw, ShieldCheck,
  Brain, FlaskConical, Rocket, AlertTriangle, Minus,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditCheck {
  id?: string;
  name?: string;
  area?: string;
  severity?: string;
  status: 'PASS' | 'FAIL' | 'NEEDS_MANUAL' | string;
  expected?: string;
  actual?: string;
  remediation?: string;
}

type SectionState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; checks: AuditCheck[]; raw: any }
  | { status: 'error'; message: string };

interface SectionResult {
  label: string;
  rpcKey: string;
  state: SectionState;
}

// ─── Ship Confidence ─────────────────────────────────────────────────────────

function computeShipConfidence(sections: SectionResult[]): {
  score: number;
  label: string;
  color: string;
  bg: string;
} {
  const done = sections.filter(s => s.state.status === 'done');
  if (done.length === 0) return { score: 0, label: 'Not run', color: 'text-muted-foreground', bg: 'bg-muted' };

  let totalChecks = 0;
  let totalPass   = 0;
  let hasP0Fail   = false;

  for (const sec of done) {
    const st = sec.state as { status: 'done'; checks: AuditCheck[] };
    for (const c of st.checks) {
      totalChecks++;
      if (c.status === 'PASS') totalPass++;
      if ((c.severity === 'P0' || c.severity === 'error') && c.status === 'FAIL') hasP0Fail = true;
    }
  }

  if (hasP0Fail) return { score: 0, label: 'BLOCKED — P0 failure', color: 'text-destructive', bg: 'bg-destructive/10' };

  const score = totalChecks > 0 ? Math.round((totalPass / totalChecks) * 100) : 0;
  if (score === 100 && done.length === sections.length) return { score, label: 'SHIP IT', color: 'text-primary', bg: 'bg-primary/10' };
  if (score >= 80) return { score, label: 'High confidence', color: 'text-primary', bg: 'bg-primary/10' };
  if (score >= 50) return { score, label: 'Moderate risk', color: 'text-accent-foreground', bg: 'bg-accent/20' };
  return { score, label: 'Do not ship', color: 'text-destructive', bg: 'bg-destructive/10' };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Flatten any shape the RPCs might return into a flat array of checks */
function normalizeChecks(raw: any): AuditCheck[] {
  if (!raw) return [];

  // rpc_run_audit_suite returns a JSON array of check objects directly
  if (Array.isArray(raw)) {
    return raw.map((c: any) => ({
      id:          c.id ?? c.check_id ?? '',
      name:        c.name ?? c.label ?? c.id ?? 'Check',
      area:        c.area ?? c.category ?? '',
      severity:    c.severity ?? c.level ?? '',
      status:      (c.status ?? 'FAIL').toString().toUpperCase(),
      expected:    c.expected ?? '',
      actual:      c.actual ?? c.result ?? '',
      remediation: c.remediation ?? '',
    }));
  }

  // rpc_run_ai_brain_test_runner / scenario_suite return { results: [...], summary: {...} }
  const arr: any[] = raw.results ?? raw.checks ?? raw.tests ?? raw.scenarios ?? [];
  return arr.map((c: any) => ({
    id:       c.id ?? c.test_id ?? c.scenario_id ?? '',
    name:     c.name ?? c.label ?? c.test_name ?? c.scenario ?? 'Check',
    area:     c.area ?? c.category ?? c.type ?? '',
    severity: c.severity ?? c.level ?? '',
    status:   (c.status ?? c.result ?? 'FAIL').toString().toUpperCase() === 'PASS' ? 'PASS' : 'FAIL',
    actual:   c.actual ?? c.details ?? c.message ?? '',
  }));
}

function sectionPassFail(checks: AuditCheck[]): { pass: number; fail: number; manual: number } {
  return checks.reduce(
    (acc, c) => {
      const s = (c.status ?? '').toUpperCase();
      if (s === 'PASS') acc.pass++;
      else if (s === 'NEEDS_MANUAL') acc.manual++;
      else acc.fail++;
      return acc;
    },
    { pass: 0, fail: 0, manual: 0 }
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionBadge({ checks }: { checks: AuditCheck[] }) {
  const { pass, fail, manual } = sectionPassFail(checks);
  const total = checks.length;

  if (fail > 0) {
    return (
      <Badge className="bg-destructive/10 text-destructive border border-destructive/30 text-xs font-semibold gap-1 px-2 py-0.5">
        <XCircle className="h-3 w-3" />
        FAIL — {fail} issue{fail > 1 ? 's' : ''}
      </Badge>
    );
  }
  if (manual > 0) {
    return (
      <Badge className="bg-accent/20 text-accent-foreground border border-accent text-xs font-semibold gap-1 px-2 py-0.5">
        <Minus className="h-3 w-3" />
        {pass}/{total} (manual review)
      </Badge>
    );
  }
  return (
    <Badge className="bg-primary/10 text-primary border border-primary/30 text-xs font-semibold gap-1 px-2 py-0.5">
      <CheckCircle2 className="h-3 w-3" />
      PASS — {total}/{total}
    </Badge>
  );
}

function CheckRow({ check }: { check: AuditCheck }) {
  const s = (check.status ?? '').toUpperCase();
  const isPass   = s === 'PASS';
  const isManual = s === 'NEEDS_MANUAL';

  return (
    <div
      className={`flex items-start gap-2.5 py-2 px-3 rounded-lg text-sm border ${
        isPass   ? 'bg-primary/5 border-primary/10' :
        isManual ? 'bg-accent/10 border-accent/20' :
                   'bg-destructive/5 border-destructive/15'
      }`}
    >
      <span className="mt-0.5 shrink-0">
        {isPass   ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> :
         isManual ? <Minus className="h-3.5 w-3.5 text-accent-foreground" /> :
                    <XCircle className="h-3.5 w-3.5 text-destructive" />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium ${isPass ? 'text-foreground' : isManual ? 'text-accent-foreground' : 'text-destructive'}`}>
            {check.name || check.id}
          </span>
          {check.severity && (
            <Badge className={`text-[10px] px-1.5 py-0 border-0 ${
              check.severity === 'P0' || check.severity === 'error'
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-muted text-muted-foreground'
            }`}>
              {check.severity}
            </Badge>
          )}
          {check.area && (
            <span className="text-[11px] text-muted-foreground">{check.area}</span>
          )}
        </div>
        {!isPass && check.actual && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{check.actual}</p>
        )}
        {!isPass && check.remediation && (
          <p className="text-xs text-muted-foreground/70 mt-0.5 italic truncate">{check.remediation}</p>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  state,
  onRun,
  running,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  state: SectionState;
  onRun: () => void;
  running: boolean;
}) {
  const isIdle  = state.status === 'idle';
  const isDone  = state.status === 'done';
  const isError = state.status === 'error';

  const checks = isDone ? (state as any).checks as AuditCheck[] : [];
  const { fail } = isDone ? sectionPassFail(checks) : { fail: 0 };

  return (
    <Card className={
      isDone && fail === 0
        ? 'border-primary/20'
        : isDone && fail > 0
        ? 'border-destructive/30'
        : 'border-border'
    }>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-muted-foreground shrink-0">{icon}</span>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isDone && <SectionBadge checks={checks} />}
            <Button
              size="sm"
              variant={isDone ? 'outline' : 'default'}
              onClick={onRun}
              disabled={running}
              className="text-xs h-7 px-2.5"
            >
              {running
                ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Running</>
                : isDone
                ? <><RefreshCw className="h-3 w-3 mr-1" />Re-run</>
                : 'Run'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-1.5">
        {isIdle && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Press <strong>Run</strong> to execute this suite.
          </p>
        )}

        {state.status === 'running' && (
          <div className="flex items-center gap-2 justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Running checks…</span>
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {(state as any).message}
          </div>
        )}

        {isDone && (
          <div className="space-y-1">
            {checks.map((c, i) => <CheckRow key={c.id || i} check={c} />)}
            {checks.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                No checks returned from this suite.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Ship Confidence Banner ────────────────────────────────────────────────────

function ShipConfidenceBanner({ sections }: { sections: SectionResult[] }) {
  const allDone = sections.every(s => s.state.status === 'done');
  const anyDone = sections.some(s => s.state.status === 'done');

  if (!anyDone) return null;

  const { score, label, color, bg } = computeShipConfidence(sections);
  const isShip    = score === 100 && allDone;
  const isBlocked = score === 0 && label.startsWith('BLOCKED');

  return (
    <Card className={`border-2 ${isShip ? 'border-primary/40' : isBlocked ? 'border-destructive/40' : 'border-border'} ${bg}`}>
      <CardContent className="py-8 text-center space-y-3">
        {isShip ? (
          <Rocket className="h-12 w-12 mx-auto text-primary" />
        ) : isBlocked ? (
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
        ) : (
          <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground" />
        )}

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-1">
            Ship Confidence
          </p>
          <p className={`text-5xl font-bold tabular-nums ${color}`}>{score}%</p>
          <p className={`text-sm font-semibold mt-1 ${color}`}>{label}</p>
        </div>

        {!allDone && (
          <p className="text-xs text-muted-foreground">
            Run all sections for a complete score.
          </p>
        )}

        {isShip && (
          <p className="text-xs text-muted-foreground">
            All checks passed across every suite. This build is release-ready.
          </p>
        )}

        {isBlocked && (
          <p className="text-xs text-destructive/80">
            One or more P0 failures detected. Do not ship until resolved.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminReleaseChecklist() {
  const { currentProjectId }                = useCurrentProject();
  const { isAdmin, isPM, loading: authLoad } = useAuthRole(currentProjectId ?? undefined);
  const { activeOrganizationId }            = useOrganization();

  const SECTIONS = [
    {
      key:      'audit_suite',
      rpcKey:   'rpc_run_audit_suite',
      rpcArgs:  () => ({}),
      label:    'System Audit Suite',
      subtitle: 'RLS enforcement, privilege guards, variance determinism, and security invariants.',
      Icon:     <ShieldCheck className="h-5 w-5" />,
    },
    {
      key:      'brain_test',
      rpcKey:   'rpc_run_ai_brain_test_runner',
      rpcArgs:  () => ({ p_org_id: activeOrganizationId }),
      label:    'AI Brain Test Runner',
      subtitle: 'Validates margin control engine logic, view existence, and SECURITY DEFINER coverage.',
      Icon:     <Brain className="h-5 w-5" />,
    },
    {
      key:      'scenario_suite',
      rpcKey:   'rpc_run_ai_brain_scenario_suite',
      rpcArgs:  () => ({ p_org_id: activeOrganizationId }),
      label:    'AI Brain Scenario Suite',
      subtitle: 'Edge-case project scenarios — tests margin projection against real data patterns.',
      Icon:     <FlaskConical className="h-5 w-5" />,
    },
  ] as const;

  const [states, setStates] = useState<Record<string, SectionState>>(
    Object.fromEntries(SECTIONS.map(s => [s.key, { status: 'idle' }]))
  );
  const [running, setRunning] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map(s => [s.key, false]))
  );

  const runSection = useCallback(async (key: string, rpcKey: string, rpcArgs: () => Record<string, any>) => {
    if (!activeOrganizationId && rpcKey !== 'rpc_run_audit_suite') return;

    setRunning(r => ({ ...r, [key]: true }));
    setStates(s => ({ ...s, [key]: { status: 'running' } }));

    try {
      const { data, error } = await (supabase as any).rpc(rpcKey, rpcArgs());
      if (error) throw new Error(error.message);

      const checks = normalizeChecks(data);
      setStates(s => ({ ...s, [key]: { status: 'done', checks, raw: data } }));
    } catch (e: any) {
      setStates(s => ({ ...s, [key]: { status: 'error', message: e.message } }));
    } finally {
      setRunning(r => ({ ...r, [key]: false }));
    }
  }, [activeOrganizationId]);

  const runAll = useCallback(async () => {
    for (const sec of SECTIONS) {
      await runSection(sec.key, sec.rpcKey, sec.rpcArgs);
    }
  }, [runSection]);

  const sectionResults: SectionResult[] = SECTIONS.map(s => ({
    label:  s.label,
    rpcKey: s.rpcKey,
    state:  states[s.key],
  }));

  if (authLoad) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin && !isPM()) {
    return <Layout><NoAccess /></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Rocket className="h-6 w-6" />
              Pre-release Checklist
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Run all three suites. All must pass before shipping.
            </p>
          </div>
          <Button onClick={runAll} disabled={Object.values(running).some(Boolean)}>
            {Object.values(running).some(Boolean)
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Running all…</>
              : <><RefreshCw className="h-4 w-4 mr-2" />Run All Suites</>}
          </Button>
        </div>

        {/* Ship Confidence Banner */}
        <ShipConfidenceBanner sections={sectionResults} />

        {/* Sections */}
        {SECTIONS.map(sec => (
          <SectionCard
            key={sec.key}
            icon={sec.Icon}
            title={sec.label}
            subtitle={sec.subtitle}
            state={states[sec.key]}
            onRun={() => runSection(sec.key, sec.rpcKey, sec.rpcArgs)}
            running={running[sec.key]}
          />
        ))}

        {/* Footer note */}
        <p className="text-xs text-muted-foreground text-center pb-4">
          All checks are read-only RPC calls. No data is written. Results reflect live database state.
        </p>
      </div>
    </Layout>
  );
}
