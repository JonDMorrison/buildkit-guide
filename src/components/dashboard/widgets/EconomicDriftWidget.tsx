import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingDown, TrendingUp, Minus, ChevronRight, Camera } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Snapshot {
  snapshot_date: string;
  risk_score: number;
  projected_margin_ratio: number;
}

function DeltaIndicator({ value, suffix = "", invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  const isPositive = invert ? value < 0 : value > 0;
  const isNegative = invert ? value > 0 : value < 0;
  if (value === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;
  return (
    <span
      className={`text-xs font-mono font-medium inline-flex items-center gap-0.5 ${
        isNegative ? "text-destructive" : isPositive ? "text-primary" : "text-muted-foreground"
      }`}
    >
      {isNegative ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
      {value > 0 ? "+" : ""}{value.toFixed(1)}{suffix}
    </span>
  );
}

interface Props {
  projectId: string | null;
}

export const EconomicDriftWidget = memo(function EconomicDriftWidget({ projectId }: Props) {
  const navigate = useNavigate();

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ["margin-snapshot-history", projectId, 30],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("rpc_get_margin_snapshot_history", {
        p_project_id: projectId!,
        p_days: 30,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as Snapshot[];
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });

  // Need at least 2 snapshots for drift
  const hasDrift = snapshots && snapshots.length >= 2;
  const latest = hasDrift ? snapshots[snapshots.length - 1] : null;
  const previous = hasDrift ? snapshots[snapshots.length - 2] : null;

  const riskDelta = latest && previous ? latest.risk_score - previous.risk_score : 0;
  const marginDelta = latest && previous
    ? (latest.projected_margin_ratio - previous.projected_margin_ratio) * 100
    : 0;

  return (
    <div
      className="widget-card group cursor-pointer hover:border-primary/30 transition-all h-full flex flex-col"
      onClick={() => navigate("/intelligence")}
    >
      <div className="flex-shrink-0 mb-3 flex items-start justify-between">
        <div>
          <h3 className="widget-title">
            <TrendingDown className="h-4 w-4 text-accent-foreground" />
            Economic Drift
          </h3>
          <p className="widget-subtitle">Change since previous snapshot</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : !projectId ? (
          <p className="text-xs text-muted-foreground text-center">
            Select a project to view drift.
          </p>
        ) : !hasDrift ? (
          <div className="text-center space-y-2 py-2">
            <Camera className="h-5 w-5 mx-auto text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              Collect one more snapshot to see drift.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Risk score delta */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Risk Score</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-semibold tabular-nums">{latest!.risk_score}</span>
                <DeltaIndicator value={riskDelta} invert />
              </div>
            </div>

            {/* Projected margin delta */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Projected Margin</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-semibold tabular-nums">
                  {(latest!.projected_margin_ratio * 100).toFixed(1)}%
                </span>
                <DeltaIndicator value={marginDelta} suffix="%" />
              </div>
            </div>

            {/* Snapshot dates */}
            <div className="pt-1 border-t border-border">
              <p className="text-[10px] text-muted-foreground font-mono">
                {previous!.snapshot_date} → {latest!.snapshot_date}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
