import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  projectId: string | null;
}

interface SnapshotEntry {
  snapshot_date: string;
  risk_score: number;
  projected_margin_at_completion_percent: number;
  economic_position: string;
}

export function EconomicPulseStrip({ projectId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["economic-pulse", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("rpc_get_margin_snapshot_history", {
        p_project_id: projectId!,
        p_days: 14,
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data : [];
      return result as SnapshotEntry[];
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !data || data.length === 0 || !data[0]?.snapshot_date) return null;

  const latest = data[0];
  const previous = data.length > 1 ? data[1] : null;

  const riskDelta = previous ? latest.risk_score - previous.risk_score : 0;
  const marginDelta = previous
    ? latest.projected_margin_at_completion_percent - previous.projected_margin_at_completion_percent
    : 0;

  const freshness = formatDistanceToNow(new Date(latest.snapshot_date), { addSuffix: true });

  const positionColor =
    latest.economic_position === "at_risk"
      ? "text-destructive"
      : latest.economic_position === "volatile"
      ? "text-accent-foreground"
      : "text-primary";

  return (
    <Card className="border-primary/20">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            <span className="font-medium">Economic Pulse</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Snapshot {freshness}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`font-medium capitalize ${positionColor}`}>
              {latest.economic_position?.replace(/_/g, " ") || "—"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {riskDelta > 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-destructive" />
            ) : riskDelta < 0 ? (
              <TrendingDown className="h-3.5 w-3.5 text-primary" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span>
              Risk {latest.risk_score}
              {previous && (
                <span className={riskDelta > 0 ? "text-destructive" : riskDelta < 0 ? "text-primary" : "text-muted-foreground"}>
                  {" "}({riskDelta > 0 ? "+" : ""}{riskDelta.toFixed(0)})
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span>
              Margin {latest.projected_margin_at_completion_percent?.toFixed(1)}%
              {previous && (
                <span className={marginDelta < 0 ? "text-destructive" : marginDelta > 0 ? "text-primary" : "text-muted-foreground"}>
                  {" "}({marginDelta > 0 ? "+" : ""}{marginDelta.toFixed(1)}%)
                </span>
              )}
            </span>
          </div>

          {!previous && (
            <Badge variant="outline" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Need 2+ snapshots for deltas
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
