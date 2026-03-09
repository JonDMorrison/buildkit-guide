import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { DashboardGrid } from "@/components/dashboard/shared/DashboardGrid";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  projectId: string | null;
}

function getRiskColor(score: number | null) {
  if (score == null) return "text-muted-foreground";
  if (score >= 70) return "text-destructive";
  if (score >= 40) return "text-accent-foreground";
  return "text-primary";
}

function getPositionBadge(pos: string | null) {
  if (pos === "at_risk") return <Badge className="bg-destructive/10 text-destructive border-destructive/30 border text-xs">At Risk</Badge>;
  if (pos === "volatile") return <Badge className="bg-secondary text-secondary-foreground border text-xs">Volatile</Badge>;
  if (pos === "stable" || pos === "healthy") return <Badge className="bg-primary/10 text-primary border-primary/30 border text-xs">Stable</Badge>;
  return <Badge variant="outline" className="text-xs">No Data</Badge>;
}

function DeltaIndicator({ current, previous, suffix = "", invert = false }: { current: number | null; previous: number | null; suffix?: string; invert?: boolean }) {
  if (current == null || previous == null) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  const delta = current - previous;
  if (Math.abs(delta) < 0.5) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  const improving = invert ? delta < 0 : delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-mono font-medium ${improving ? "text-primary" : "text-destructive"}`}>
      {improving ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {delta > 0 ? "+" : ""}{delta.toFixed(1)}{suffix}
    </span>
  );
}

interface MarginControlData {
  economic_position: string | null;
  risk_score: number | null;
  projected_margin_at_completion_percent: number | null;
  labor_burn_ratio: number | null;
  contract_value: number | null;
  executive_summary: string | null;
}

interface MarginSnapshotEntry {
  risk_score: number | null;
  projected_margin_ratio: number | null;
}

export function ProjectHealthSignalCard({ projectId }: Props) {
  const { data: marginControl, isLoading: mcLoading } = useQuery({
    queryKey: ["pm-margin-control", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "rpc_generate_project_margin_control" as any,
        { p_project_id: projectId }
      );
      if (error) throw error;
      return data as MarginControlData | null;
    },
    enabled: !!projectId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: snapshotHistory } = useQuery({
    queryKey: ["pm-snapshot-history", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "rpc_get_margin_snapshot_history" as any,
        { p_project_id: projectId, p_window_days: 7 }
      );
      if (error) throw error;
      return (data as unknown as MarginSnapshotEntry[]) ?? [];
    },
    enabled: !!projectId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const position = marginControl?.economic_position ?? null;
  const riskScore = marginControl?.risk_score ?? null;
  const marginPct = marginControl?.projected_margin_at_completion_percent ?? null;
  const burnRatio = marginControl?.labor_burn_ratio ?? null;

  // Previous snapshot for delta indicators
  const prevSnapshot = snapshotHistory && snapshotHistory.length >= 2 ? snapshotHistory[snapshotHistory.length - 2] : null;
  const prevRisk = prevSnapshot?.risk_score ?? null;
  const prevMargin = prevSnapshot?.projected_margin_ratio != null ? prevSnapshot.projected_margin_ratio * 100 : null;

  const loading = mcLoading;

  return (
    <DashboardCard
      title="Project Health Signal"
      description="Latest snapshot · risk movement · margin · burn"
      icon={Activity}
      loading={loading}
      variant="chart"
      helpText="Projected vs. actual margin and cost signals. You need an approved estimate linked to this project for data to appear."
      empty={!loading && !marginControl}
      emptyMessage="No economic data. Link an approved estimate to begin tracking."
    >
      {marginControl && (
        <div className="space-y-4">
          {/* Position + Risk */}
          <div className="flex items-center justify-between">
            {getPositionBadge(position)}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">Risk</span>
                <span className={`text-2xl font-bold tabular-nums ${getRiskColor(riskScore)}`}>
                  {riskScore ?? "—"}
                </span>
              </div>
              <DeltaIndicator current={riskScore} previous={prevRisk} invert />
            </div>
          </div>

          {/* KPI strip */}
          <DashboardGrid columns={3} gap="sm">
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <span className={`text-xl font-bold tabular-nums ${
                  marginPct == null ? "text-muted-foreground"
                  : marginPct < 0 ? "text-destructive"
                  : marginPct < 10 ? "text-accent-foreground"
                  : "text-primary"
                }`}>
                  {marginPct != null ? `${Math.round(marginPct)}%` : "—"}
                </span>
                <DeltaIndicator current={marginPct} previous={prevMargin} suffix="%" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Proj. Margin</p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <span className={`text-xl font-bold tabular-nums ${
                burnRatio == null ? "text-muted-foreground"
                : burnRatio > 1.1 ? "text-destructive"
                : burnRatio > 0.85 ? "text-accent-foreground"
                : "text-foreground"
              }`}>
                {burnRatio != null ? burnRatio.toFixed(2) : "—"}
              </span>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Labor Burn</p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <span className="text-xl font-bold tabular-nums text-foreground">
                {marginControl?.contract_value
                  ? `$${(marginControl.contract_value / 1000).toFixed(0)}k`
                  : "—"
                }
              </span>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Contract</p>
            </div>
          </DashboardGrid>

          {/* Executive summary */}
          {marginControl?.executive_summary && (
            <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
              {marginControl.executive_summary}
            </p>
          )}
        </div>
      )}
    </DashboardCard>
  );
}
