import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldAlert, ShieldCheck, ShieldX, TrendingDown, TrendingUp,
  Minus, RefreshCw, CheckSquare, AlertTriangle, Zap
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface RequiredAction {
  key: string;
  label: string;
  severity: 'high' | 'medium' | 'low';
  explanation: string;
}

interface ActionPanel {
  project_id: string;
  risk_score: number;
  economic_position: 'at_risk' | 'volatile' | 'stable';
  intervention_priority: number;
  intervention_flags: string[];
  required_actions: RequiredAction[];
  recommended_guardrail_mode: 'block' | 'warn' | 'none';
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function PositionIcon({ position }: { position: string }) {
  if (position === 'at_risk')  return <ShieldX  className="h-5 w-5 text-destructive" />;
  if (position === 'volatile') return <ShieldAlert className="h-5 w-5 text-accent-foreground" />;
  return                              <ShieldCheck className="h-5 w-5 text-primary" />;
}

function PositionLabel({ position }: { position: string }) {
  if (position === 'at_risk')  return <span className="text-destructive font-semibold">At Risk</span>;
  if (position === 'volatile') return <span className="text-accent-foreground font-semibold">Volatile</span>;
  return                              <span className="text-primary font-semibold">Stable</span>;
}

function RiskBar({ score }: { score: number }) {
  const color =
    score > 60 ? 'bg-destructive' :
    score >= 30 ? 'bg-accent-foreground/50' :
    'bg-primary';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className="text-sm font-mono font-bold tabular-nums w-8 text-right">{score}</span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === 'high')   return <Badge className="bg-destructive/10 text-destructive border-destructive/30 border text-xs shrink-0">High</Badge>;
  if (severity === 'medium') return <Badge className="bg-accent text-accent-foreground border-accent border text-xs shrink-0">Medium</Badge>;
  return                            <Badge className="bg-muted text-muted-foreground border text-xs shrink-0">Low</Badge>;
}

function GuardrailBadge({ mode }: { mode: string }) {
  if (mode === 'block') return (
    <Badge className="bg-destructive/10 text-destructive border-destructive/30 border text-xs gap-1">
      <ShieldX className="h-3 w-3" /> Block
    </Badge>
  );
  if (mode === 'warn') return (
    <Badge className="bg-accent text-accent-foreground border-accent border text-xs gap-1">
      <AlertTriangle className="h-3 w-3" /> Warn
    </Badge>
  );
  return (
    <Badge className="bg-primary/10 text-primary border-primary/30 border text-xs gap-1">
      <ShieldCheck className="h-3 w-3" /> None
    </Badge>
  );
}

const PRIORITY_LABELS = ['', 'Low', 'Low-Med', 'Medium', 'High', 'Critical'];

const FLAG_LABELS: Record<string, string> = {
  below_low_band:     'Below historical margin band',
  labor_burn_high:    'Labor burn exceeding benchmark',
  low_historical_data: 'Low historical data',
  margin_declining:   'Margin declining',
};

function humanFlag(f: string) {
  return FLAG_LABELS[f] ?? f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Main component ───────────────────────────────────────────────────────────

export function EconomicControlPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ActionPanel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: rpcError } = await (supabase as any).rpc(
        'rpc_get_project_action_panel',
        { p_project_id: projectId }
      );
      if (rpcError) throw new Error(rpcError.message);
      setData(result as ActionPanel);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  return (
    <Card className={
      !data ? 'border-muted' :
      data.economic_position === 'at_risk'  ? 'border-destructive/40' :
      data.economic_position === 'volatile' ? 'border-accent' :
      'border-primary/20'
    }>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Economic Control</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Loading */}
        {loading && !data && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Panel data */}
        {data && !loading && (
          <>
            {/* Row 1: Position + Risk Score */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Position</p>
                <div className="flex items-center gap-1.5">
                  <PositionIcon position={data.economic_position} />
                  <PositionLabel position={data.economic_position} />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Priority</p>
                <div className="flex items-center gap-1.5">
                  <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {PRIORITY_LABELS[data.intervention_priority] ?? data.intervention_priority}
                  </span>
                </div>
              </div>
            </div>

            {/* Risk Score Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-wide">
                <span>Risk Score</span>
                <span>/ 100</span>
              </div>
              <RiskBar score={data.risk_score} />
            </div>

            {/* Guardrail mode */}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-xs text-muted-foreground">Recommended guardrail</span>
              <GuardrailBadge mode={data.recommended_guardrail_mode} />
            </div>

            {/* Active flags (compact) */}
            {data.intervention_flags.length > 0 && (
              <div className="space-y-1.5 border-t pt-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Flags</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.intervention_flags.map(f => (
                    <Badge key={f} variant="outline" className="text-xs font-normal">
                      {humanFlag(f)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Required actions */}
            {data.required_actions.length > 0 ? (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Required Actions</p>
                <div className="space-y-2">
                  {data.required_actions.map(a => (
                    <div
                      key={a.key}
                      className="rounded-md border bg-muted/30 p-3 space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <CheckSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-px" />
                          <span className="text-sm font-medium leading-tight">{a.label}</span>
                        </div>
                        <SeverityBadge severity={a.severity} />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed pl-5">
                        {a.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border-t pt-3 flex items-center gap-1.5 text-xs text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                No required actions — project is within acceptable range.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
