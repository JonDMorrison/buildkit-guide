import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { ListChecks } from "lucide-react";

interface Props {
  todayCount: number;
  totalOpen: number;
  loading?: boolean;
}

export function TodayTasksCard({ todayCount, totalOpen, loading }: Props) {
  return (
    <DashboardCard
      title="Today's Tasks"
      icon={ListChecks}
      loading={loading}
      variant="metric"
      helpText="Number of tasks due today shown in large text, with total open tasks below. Use this to gauge today's workload at a glance."
    >
      <div className="text-4xl font-bold tabular-nums text-foreground">{todayCount}</div>
      <p className="text-xs text-muted-foreground">
        due today · <span className="font-medium text-foreground">{totalOpen}</span> open total
      </p>
    </DashboardCard>
  );
}
