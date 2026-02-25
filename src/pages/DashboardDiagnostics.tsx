import { useMemo, useSyncExternalStore } from "react";
import { DashboardLayout } from "@/components/dashboard/shared/DashboardLayout";
import { DashboardSection } from "@/components/dashboard/shared/DashboardSection";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { DashboardGrid } from "@/components/dashboard/shared/DashboardGrid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  getRpcTraces,
  subscribeRpcTraces,
  clearRpcTraces,
  CARD_RPC_REGISTRY,
  type RpcTraceEntry,
} from "@/lib/rpc-tracer";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Database,
  Flame, LayoutDashboard, RefreshCw, Trash2, Zap,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function useTraces() {
  return useSyncExternalStore(subscribeRpcTraces, getRpcTraces, getRpcTraces);
}

function fmt(ms: number) {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function durationColor(ms: number) {
  if (ms < 300) return "text-primary";
  if (ms < 1000) return "text-accent-foreground";
  return "text-destructive";
}

/* ------------------------------------------------------------------ */
/* Aggregate stats                                                     */
/* ------------------------------------------------------------------ */

interface AggStat {
  name: string;
  calls: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  errors: number;
  errorRate: number;
  lastMs: number;
}

function aggregate(traces: readonly RpcTraceEntry[]): AggStat[] {
  const map = new Map<string, RpcTraceEntry[]>();
  for (const t of traces) {
    const arr = map.get(t.name) || [];
    arr.push(t);
    map.set(t.name, arr);
  }

  return Array.from(map.entries())
    .map(([name, items]) => {
      const durations = items.map((i) => i.durationMs).sort((a, b) => a - b);
      const errors = items.filter((i) => i.status === "error").length;
      return {
        name,
        calls: items.length,
        avgMs: durations.reduce((a, b) => a + b, 0) / durations.length,
        p95Ms: durations[Math.floor(durations.length * 0.95)] ?? 0,
        maxMs: durations[durations.length - 1] ?? 0,
        errors,
        errorRate: errors / items.length,
        lastMs: durations[0] ?? 0,
      };
    })
    .sort((a, b) => b.avgMs - a.avgMs);
}

/* ------------------------------------------------------------------ */
/* Page component                                                      */
/* ------------------------------------------------------------------ */

export default function DashboardDiagnostics() {
  const traces = useTraces();

  const stats = useMemo(() => aggregate(traces), [traces]);
  const totalCalls = traces.length;
  const totalErrors = traces.filter((t) => t.status === "error").length;
  const avgDuration = totalCalls > 0
    ? traces.reduce((s, t) => s + t.durationMs, 0) / totalCalls
    : 0;
  const slowest = stats[0];

  return (
    <DashboardLayout>
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard Diagnostics</h1>
        <p className="text-sm text-muted-foreground mt-1">Admin tool — RPC performance tracing for dashboard cards</p>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────── */}
      <DashboardSection>
        <DashboardGrid>
          <DashboardCard title="Total RPC Calls" icon={Database} variant="metric" traceSource="rpc-tracer in-memory">
            <div className="text-4xl font-bold tabular-nums text-foreground">
              <AnimatedCounter value={totalCalls} />
            </div>
          </DashboardCard>

          <DashboardCard title="Average Response" icon={Clock} variant="metric" traceSource="rpc-tracer in-memory">
            <div className={`text-4xl font-bold tabular-nums ${durationColor(avgDuration)}`}>
              {fmt(avgDuration)}
            </div>
          </DashboardCard>

          <DashboardCard
            title="Error Rate"
            icon={AlertTriangle}
            variant={totalErrors > 0 ? "alert" : "metric"}
            traceSource="rpc-tracer in-memory"
          >
            <div className={`text-4xl font-bold tabular-nums ${totalErrors > 0 ? "text-destructive" : "text-primary"}`}>
              {totalCalls > 0 ? `${((totalErrors / totalCalls) * 100).toFixed(1)}%` : "—"}
            </div>
            {totalErrors > 0 && (
              <p className="text-xs text-muted-foreground">{totalErrors} failed of {totalCalls}</p>
            )}
          </DashboardCard>
        </DashboardGrid>
      </DashboardSection>

      {/* ── RPC Performance Table ──────────────────────────────── */}
      <DashboardSection title="RPC Performance (Aggregated)">
        <DashboardCard
          title="Response Times by RPC"
          icon={Activity}
          variant="table"
          traceSource="rpc-tracer aggregate"
          empty={stats.length === 0}
          emptyMessage="No RPC traces captured yet. Navigate to a dashboard page, then return here to see data."
          actions={
            <Button variant="ghost" size="sm" onClick={clearRpcTraces}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          }
        >
          {stats.length > 0 && (
            <div className="overflow-x-auto -mx-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">RPC / Table</TableHead>
                    <TableHead className="text-xs text-right">Calls</TableHead>
                    <TableHead className="text-xs text-right">Avg</TableHead>
                    <TableHead className="text-xs text-right">P95</TableHead>
                    <TableHead className="text-xs text-right">Max</TableHead>
                    <TableHead className="text-xs text-right">Errors</TableHead>
                    <TableHead className="text-xs text-right">Fail %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-mono text-xs">{s.name}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{s.calls}</TableCell>
                      <TableCell className={`text-right tabular-nums text-xs font-medium ${durationColor(s.avgMs)}`}>
                        {fmt(s.avgMs)}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums text-xs ${durationColor(s.p95Ms)}`}>
                        {fmt(s.p95Ms)}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums text-xs ${durationColor(s.maxMs)}`}>
                        {fmt(s.maxMs)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {s.errors > 0 ? (
                          <span className="text-destructive font-medium">{s.errors}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {s.errorRate > 0 ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5">
                            {(s.errorRate * 100).toFixed(0)}%
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5 text-primary">0%</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DashboardCard>
      </DashboardSection>

      {/* ── Card → RPC Map ─────────────────────────────────────── */}
      <DashboardSection title="Card → RPC Registry" lazy skeletonHeight="h-56">
        <DashboardCard
          title="Which RPCs power each card"
          icon={LayoutDashboard}
          variant="table"
          traceSource="static CARD_RPC_REGISTRY"
        >
          <div className="overflow-x-auto -mx-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Dashboard</TableHead>
                  <TableHead className="text-xs">Card</TableHead>
                  <TableHead className="text-xs">RPCs</TableHead>
                  <TableHead className="text-xs">Variant</TableHead>
                  <TableHead className="text-xs text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CARD_RPC_REGISTRY.map((m) => {
                  // Check if we have traces for any of the card's RPCs
                  const hasTraces = m.rpcs.some((r) => traces.some((t) => t.name === r));
                  const hasErrors = m.rpcs.some((r) => traces.some((t) => t.name === r && t.status === "error"));

                  return (
                    <TableRow key={`${m.dashboard}-${m.card}`}>
                      <TableCell className="text-xs font-mono text-muted-foreground">{m.dashboard}</TableCell>
                      <TableCell className="text-xs font-medium">{m.card}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {m.rpcs.map((r) => (
                            <Badge key={r} variant="outline" className="text-[10px] font-mono px-1.5">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] px-1.5">{m.variant}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {hasErrors ? (
                          <Flame className="h-3.5 w-3.5 text-destructive inline-block" />
                        ) : hasTraces ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary inline-block" />
                        ) : (
                          <span className="text-muted-foreground text-[10px]">no data</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DashboardCard>
      </DashboardSection>

      {/* ── Recent Trace Log ───────────────────────────────────── */}
      <DashboardSection title="Recent Traces (Raw)" lazy skeletonHeight="h-48">
        <DashboardCard
          title="Trace Log"
          icon={Zap}
          variant="table"
          traceSource="rpc-tracer raw entries"
          empty={traces.length === 0}
          emptyMessage="No traces yet. Visit /dashboard or /executive and come back."
        >
          {traces.length > 0 && (
            <div className="overflow-x-auto -mx-2 max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">RPC</TableHead>
                    <TableHead className="text-xs">Caller</TableHead>
                    <TableHead className="text-xs text-right">Duration</TableHead>
                    <TableHead className="text-xs text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {traces.slice(0, 50).map((t, i) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-[10px] text-muted-foreground tabular-nums">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{t.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.callerHint || "—"}</TableCell>
                      <TableCell className={`text-right tabular-nums text-xs font-medium ${durationColor(t.durationMs)}`}>
                        {fmt(t.durationMs)}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.status === "error" ? (
                          <Badge variant="destructive" className="text-[10px]">ERR</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] text-primary">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DashboardCard>
      </DashboardSection>
    </DashboardLayout>
  );
}
