import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Cell,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { OrgSnapshot } from "@/hooks/useOrgSnapshots";

interface Props {
  snapshots: OrgSnapshot[];
  loading: boolean;
}

export const OverBudgetTrendChart = ({ snapshots, loading }: Props) => {
  const data = useMemo(() =>
    snapshots.map((s) => ({
      date: s.snapshot_date,
      label: format(parseISO(s.snapshot_date), "MMM d"),
      overBudget: s.projects_over_budget_count,
      total: s.projects_with_budget_count,
      missingBudget: s.projects_missing_budget_count,
    })),
    [snapshots]
  );

  if (loading) return <Skeleton className="h-64" />;
  if (!data.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          Over-Budget Projects Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              allowDecimals={false}
            />
            <RechartsTooltip
              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value: number, name: string) => {
                if (name === "overBudget") return [value, "Over Budget"];
                if (name === "missingBudget") return [value, "Missing Budget"];
                return [value, name];
              }}
            />
            <Bar dataKey="overBudget" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {data.map((_, i) => (
                <Cell key={i} fill="hsl(var(--destructive))" fillOpacity={0.8} />
              ))}
            </Bar>
            <Bar dataKey="missingBudget" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {data.map((_, i) => (
                <Cell key={i} fill="hsl(var(--status-warning))" fillOpacity={0.6} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
