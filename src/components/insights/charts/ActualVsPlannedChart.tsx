import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DollarSign, Info } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip,
} from "recharts";
import { format, parseISO } from "date-fns";
import { formatCurrency } from "@/lib/formatters";
import type { ProjectSnapshot } from "@/hooks/useProjectSnapshots";

interface Props {
  snapshots: ProjectSnapshot[];
  loading: boolean;
}

export const ActualVsPlannedChart = ({ snapshots, loading }: Props) => {
  const data = useMemo(() =>
    snapshots.map((s) => ({
      label: format(parseISO(s.snapshot_date), "MMM d"),
      actual: s.actual_total_cost,
      planned: s.has_budget ? s.planned_total_cost : null,
    })),
    [snapshots]
  );

  const missingBudgetCount = useMemo(
    () => snapshots.filter((s) => !s.has_budget).length,
    [snapshots]
  );

  if (loading) return <Skeleton className="h-64" />;
  if (!data.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          Actual vs Planned Cost
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Snapshots are collected weekly.{missingBudgetCount > 0 && ` ${missingBudgetCount} week(s) had no budget — planned line has gaps.`}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <RechartsTooltip
              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value: number | null, name: string) => [
                value !== null ? formatCurrency(value) : "No budget",
                name === "planned" ? "Planned" : "Actual",
              ]}
            />
            <Area
              type="monotone"
              dataKey="planned"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              fill="hsl(var(--muted))"
              fillOpacity={0.3}
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="hsl(var(--primary))"
              fillOpacity={0.15}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
