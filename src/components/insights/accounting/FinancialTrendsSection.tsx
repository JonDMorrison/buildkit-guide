import { DashboardGrid } from "@/components/dashboard/shared/DashboardGrid";
import { MarginTrendChart } from "@/components/insights/charts/MarginTrendChart";
import { CostTrendChart } from "@/components/insights/charts/CostTrendChart";
import { OverBudgetTrendChart } from "@/components/insights/charts/OverBudgetTrendChart";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { Camera, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { OrgSnapshot } from "@/hooks/useOrgSnapshots";

interface Props {
  snapshots: OrgSnapshot[];
  loading: boolean;
}

export function FinancialTrendsSection({ snapshots, loading }: Props) {
  const navigate = useNavigate();

  if (!loading && snapshots.length === 0) {
    return (
      <DashboardCard
        title="Financial Trends"
        description="Revenue · Margin · Labor"
        icon={TrendingUp}
        variant="chart"
        empty
        emptyMessage="No weekly snapshots yet. Generate snapshots to see trend charts."
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate("/insights/snapshots")} className="text-xs">
            <Camera className="h-3 w-3 mr-1" /> Generate
          </Button>
        }
      />
    );
  }

  return (
    <DashboardGrid columns={3}>
      <MarginTrendChart snapshots={snapshots} loading={loading} />
      <CostTrendChart snapshots={snapshots} loading={loading} />
      <OverBudgetTrendChart snapshots={snapshots} loading={loading} />
    </DashboardGrid>
  );
}
