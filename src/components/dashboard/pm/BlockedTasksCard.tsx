import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { ShieldAlert } from "lucide-react";

interface Props {
  blockedCount: number;
  loading?: boolean;
}

export function BlockedTasksCard({ blockedCount, loading }: Props) {
  const isAlert = blockedCount > 0;
  return (
    <DashboardCard
      title="Blocked"
      icon={ShieldAlert}
      loading={loading}
      variant={isAlert ? "alert" : "metric"}
      helpText="Tasks currently marked as blocked. Resolve blockers to keep work moving."
    >
      <div className={`text-4xl font-bold tabular-nums ${isAlert ? "text-destructive" : "text-foreground"}`}>
        {blockedCount}
      </div>
      <p className="text-xs text-muted-foreground">
        {isAlert ? "tasks need attention" : "no blocked tasks"}
      </p>
    </DashboardCard>
  );
}
