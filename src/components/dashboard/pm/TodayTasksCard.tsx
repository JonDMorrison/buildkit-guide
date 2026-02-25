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
      traceSource="tasks → due_date = today"
    >
      <div className="text-4xl font-bold tabular-nums text-foreground">{todayCount}</div>
      <p className="text-xs text-muted-foreground">
        due today · <span className="font-medium text-foreground">{totalOpen}</span> open total
      </p>
    </DashboardCard>
  );
}
