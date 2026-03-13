import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  priority?: number | null;
  assigned_trade?: { name: string } | null;
}

interface Props {
  tasks: Task[];
  loading?: boolean;
}

const statusColors: Record<string, string> = {
  blocked: "bg-destructive animate-pulse",
  in_progress: "bg-primary",
  not_started: "bg-muted-foreground/40",
};

export const MyDayTaskList = memo(function MyDayTaskList({ tasks, loading }: Props) {
  const navigate = useNavigate();

  return (
    <DashboardCard
      title="My Day"
      description={`${tasks.length} priority tasks`}
      icon={CheckCircle2}
      loading={loading}
      variant="table"
      helpText="Your top tasks sorted by priority then due date. Click any row to open the task and update progress or add notes."
      empty={!loading && tasks.length === 0}
      emptyMessage="All caught up — no urgent tasks today."
    >
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {tasks.map(task => (
          <div
            key={task.id}
            className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/5 hover:bg-white/5 hover:border-primary/20 transition-colors duration-150 cursor-pointer"
            onClick={() => navigate("/tasks")}
          >
            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${statusColors[task.status] ?? "bg-muted-foreground/40"}`} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground truncate">{task.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {task.due_date && (
                  <span className="text-xs text-muted-foreground">
                    Due: {format(new Date(task.due_date), "MMM dd")}
                  </span>
                )}
                {task.assigned_trade && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                    {task.assigned_trade.name}
                  </Badge>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          </div>
        ))}
      </div>
    </DashboardCard>
  );
});
