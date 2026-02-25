import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { HardHat } from "lucide-react";

interface Props {
  crewCount: number;
  activeTrades: number;
  loading?: boolean;
}

export function CrewAssignedCard({ crewCount, activeTrades, loading }: Props) {
  return (
    <DashboardCard
      title="Crew on Site"
      icon={HardHat}
      loading={loading}
      variant="metric"
      traceSource="daily_logs → crew_count"
    >
      <div className="text-4xl font-bold tabular-nums text-foreground">{crewCount}</div>
      <p className="text-xs text-muted-foreground">
        workers · <span className="font-medium text-foreground">{activeTrades}</span> active trades
      </p>
    </DashboardCard>
  );
}
