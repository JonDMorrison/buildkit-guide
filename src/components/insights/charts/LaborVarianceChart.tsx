import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Cell,
} from "recharts";
import { format, parseISO } from "date-fns";
import { formatNumber } from "@/lib/formatters";
import type { ProjectSnapshot } from "@/hooks/useProjectSnapshots";

interface Props {
  snapshots: ProjectSnapshot[];
  loading: boolean;
}

export const LaborVarianceChart = ({ snapshots, loading }: Props) => {
  const data = useMemo(() =>
    snapshots
      .filter((s) => s.has_budget)
      .map((s) => ({
        label: format(parseISO(s.snapshot_date), "MMM d"),
        variance: s.actual_labor_hours - s.planned_labor_hours,
        actual: s.actual_labor_hours,
        planned: s.planned_labor_hours,
      })),
    [snapshots]
  );

  if (loading) return <Skeleton className="h-64" />;
  if (!data.length) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Labor Hours Variance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No snapshots with budget data available for labor variance.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Labor Hours Variance Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `${v}h`} />
            <RechartsTooltip
              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value: number, name: string) => {
                if (name === "variance") return [`${value > 0 ? "+" : ""}${formatNumber(value)} hrs`, "Variance"];
                return [formatNumber(value), name];
              }}
            />
            <Bar dataKey="variance" radius={[4, 4, 0, 0]} maxBarSize={28}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.variance > 0 ? "hsl(var(--destructive))" : "hsl(var(--status-complete))"}
                  fillOpacity={0.75}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
