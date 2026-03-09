import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, ChevronRight, AlertTriangle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface EconomicHealthWidgetProps {
  projectId: string | null;
}

interface MarginControlData {
  economic_position?: string;
  projected_margin_at_completion_percent?: number;
  labor_burn_ratio?: number;
  risk_score?: number;
  contract_value?: number;
}

function useMarginControl(projectId: string | null) {
  return useQuery({
    queryKey: ["dashboard-margin-control", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "rpc_generate_project_margin_control" as any,
        { p_project_id: projectId }
      );
      if (error) throw error;
      return data as MarginControlData | null;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

function getRiskColor(position: string) {
  if (position === "at_risk") return "text-destructive";
  if (position === "volatile") return "text-accent";
  return "text-status-complete";
}

function getRiskBg(position: string) {
  if (position === "at_risk") return "bg-destructive/10 border-destructive/20";
  if (position === "volatile") return "bg-accent/10 border-accent/20";
  return "bg-status-complete/10 border-status-complete/20";
}

function getRiskLabel(position: string) {
  if (position === "at_risk") return "At Risk";
  if (position === "volatile") return "Volatile";
  if (position === "healthy") return "Healthy";
  return "No Data";
}

function formatPct(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "—";
  return `${Math.round(val)}%`;
}

export const EconomicHealthWidget = memo(function EconomicHealthWidget({
  projectId,
}: EconomicHealthWidgetProps) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMarginControl(projectId);

  const position = data?.economic_position ?? "no_data";
  const marginPct = data?.projected_margin_at_completion_percent;
  const burnRatio = data?.labor_burn_ratio;
  const riskScore = data?.risk_score;
  const contractValue = data?.contract_value;

  const hasData = !!data && position !== "no_data";

  return (
    <div
      className="widget-card h-full group cursor-pointer hover:border-primary/30 transition-colors"
      onClick={() => navigate("/intelligence")}
    >
      {/* Header */}
      <div className="flex-shrink-0 mb-3 flex items-start justify-between">
        <div>
          <h3 className="widget-title">
            <TrendingUp className="h-4 w-4 text-primary" />
            Economic Health
          </h3>
          <p className="widget-subtitle">Margin · Burn · Risk</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Body */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <AlertTriangle className="h-4 w-4 text-accent" />
          <span>Could not load</span>
        </div>
      )}

      {!isLoading && !isError && !hasData && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">No estimate linked</p>
          <p className="text-xs text-muted-foreground/60">
            Add an approved estimate to track margin
          </p>
        </div>
      )}

      {!isLoading && !isError && hasData && (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Economic position badge */}
          <div
            className={`rounded-lg border px-3 py-2 flex items-center justify-between ${getRiskBg(position)}`}
          >
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Position
            </span>
            <span className={`text-sm font-bold ${getRiskColor(position)}`}>
              {getRiskLabel(position)}
            </span>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-3 gap-2 flex-1">
            {/* Projected Margin */}
            <div className="flex flex-col items-center justify-center text-center bg-card rounded-lg border border-border/50 p-2">
              <p className={`text-xl font-bold tabular-nums ${
                marginPct == null
                  ? "text-muted-foreground"
                  : marginPct < 0
                  ? "text-destructive"
                  : marginPct < 10
                  ? "text-accent"
                  : "text-status-complete"
              }`}>
                {formatPct(marginPct)}
              </p>
              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                Proj. Margin
              </p>
            </div>

            {/* Labor Burn Ratio */}
            <div className="flex flex-col items-center justify-center text-center bg-card rounded-lg border border-border/50 p-2">
              <p className={`text-xl font-bold tabular-nums ${
                burnRatio == null
                  ? "text-muted-foreground"
                  : burnRatio > 1.1
                  ? "text-destructive"
                  : burnRatio > 0.85
                  ? "text-accent"
                  : "text-foreground"
              }`}>
                {burnRatio == null ? "—" : burnRatio.toFixed(2)}
              </p>
              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                Labor Burn
              </p>
            </div>

            {/* Risk Score */}
            <div className="flex flex-col items-center justify-center text-center bg-card rounded-lg border border-border/50 p-2">
              <p className={`text-xl font-bold tabular-nums ${
                riskScore == null
                  ? "text-muted-foreground"
                  : riskScore >= 70
                  ? "text-destructive"
                  : riskScore >= 40
                  ? "text-accent"
                  : "text-status-complete"
              }`}>
                {riskScore ?? "—"}
              </p>
              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                Risk Score
              </p>
            </div>
          </div>

          {/* Contract value footer */}
          {contractValue != null && contractValue > 0 && (
            <div className="text-center pt-1 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                Contract:{" "}
                <span className="font-medium text-foreground">
                  ${contractValue.toLocaleString("en-CA", { maximumFractionDigits: 0 })}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
