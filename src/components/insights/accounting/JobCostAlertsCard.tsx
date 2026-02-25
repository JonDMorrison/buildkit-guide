import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { PortfolioRow } from "@/hooks/usePortfolioInsights";

interface Props {
  rows: PortfolioRow[];
  loading?: boolean;
}

export function JobCostAlertsCard({ rows, loading }: Props) {
  const navigate = useNavigate();

  const alerts = useMemo(() => {
    const overBudget = rows
      .filter(r => r.has_budget && r.total_cost_delta < 0)
      .sort((a, b) => a.total_cost_delta - b.total_cost_delta)
      .slice(0, 5)
      .map(r => ({
        id: r.project_id,
        name: r.project_name,
        type: "over_budget" as const,
        value: Math.abs(r.total_cost_delta),
        pct: r.planned_total_cost > 0 ? Math.abs(r.total_cost_delta / r.planned_total_cost * 100) : 0,
      }));

    const laborOverruns = rows
      .filter(r => r.has_budget && r.labor_hours_delta < 0)
      .sort((a, b) => a.labor_hours_delta - b.labor_hours_delta)
      .slice(0, 5)
      .map(r => ({
        id: r.project_id,
        name: r.project_name,
        type: "labor_overrun" as const,
        value: Math.abs(r.labor_hours_delta),
        pct: r.planned_labor_hours > 0 ? Math.abs(r.labor_hours_delta / r.planned_labor_hours * 100) : 0,
      }));

    const marginErosion = rows
      .filter(r => r.has_budget && r.actual_margin_percent < 5 && r.contract_value > 0)
      .sort((a, b) => a.actual_margin_percent - b.actual_margin_percent)
      .slice(0, 5)
      .map(r => ({
        id: r.project_id,
        name: r.project_name,
        type: "margin_erosion" as const,
        value: r.actual_margin_percent,
        pct: r.actual_margin_percent,
      }));

    return { overBudget, laborOverruns, marginErosion };
  }, [rows]);

  const totalAlerts = alerts.overBudget.length + alerts.laborOverruns.length + alerts.marginErosion.length;

  return (
    <DashboardCard
      title="Job Cost Alerts"
      description={`${totalAlerts} alert${totalAlerts !== 1 ? "s" : ""}`}
      icon={TrendingDown}
      loading={loading}
      variant={totalAlerts > 0 ? "alert" : "metric"}
      traceSource="usePortfolioInsights → cost_delta, labor_cost_delta, actual_margin_percent"
      empty={!loading && totalAlerts === 0}
      emptyMessage="All projects within budget parameters."
    >
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {alerts.overBudget.length > 0 && (
          <AlertGroup title="Over Budget" items={alerts.overBudget} navigate={navigate} formatter={(v) => formatCurrency(v)} />
        )}
        {alerts.laborOverruns.length > 0 && (
          <AlertGroup title="Labor Overruns" items={alerts.laborOverruns} navigate={navigate} formatter={(v) => `${v.toFixed(0)}h`} />
        )}
        {alerts.marginErosion.length > 0 && (
          <AlertGroup
            title="Margin Erosion"
            items={alerts.marginErosion}
            navigate={navigate}
            formatter={(v) => `${v.toFixed(1)}%`}
            isPercent
          />
        )}
      </div>
    </DashboardCard>
  );
}

function AlertGroup({
  title,
  items,
  navigate,
  formatter,
  isPercent,
}: {
  title: string;
  items: Array<{ id: string; name: string; value: number; pct: number }>;
  navigate: any;
  formatter: (v: number) => string;
  isPercent?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-destructive font-semibold mb-1.5">{title}</p>
      {items.map(item => (
        <div
          key={`${title}-${item.id}`}
          className="flex items-center justify-between p-2 rounded-md border border-border/50 bg-card hover:bg-muted/10 transition-colors cursor-pointer mb-1"
          onClick={() => navigate(`/insights/project?projectId=${item.id}`)}
        >
          <span className="text-xs text-foreground font-medium truncate">{item.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono text-destructive font-medium">
              {isPercent ? formatter(item.value) : `-${formatter(item.value)}`}
            </span>
            <Badge variant="outline" className="text-[9px] text-destructive border-destructive/30">
              {item.pct.toFixed(0)}%
            </Badge>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      ))}
    </div>
  );
}
