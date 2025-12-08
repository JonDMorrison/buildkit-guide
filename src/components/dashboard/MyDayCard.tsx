import { useNavigate } from "react-router-dom";
import { Calendar, ChevronRight, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
}

interface MyDayCardProps {
  tasks: Task[];
  isLoading?: boolean;
}

const getStatusDotClass = (status: string) => {
  switch (status) {
    case "done": return "status-dot-success";
    case "in_progress": return "status-dot-success";
    case "blocked": return "status-dot-danger";
    default: return "status-dot-muted";
  }
};

export const MyDayCard = ({ tasks, isLoading = false }: MyDayCardProps) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="space-y-1">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="widget-body space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/10">
              <Skeleton className="w-2 h-2 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="widget-card premium-card-interactive group"
      onClick={() => navigate("/tasks")}
    >
      <div className="widget-header">
        <div>
          <h3 className="widget-title">
            <Calendar className="h-4 w-4 text-accent" />
            My Day
          </h3>
          <p className="widget-subtitle">Priority tasks</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="widget-body">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-status-success-bg flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-secondary" />
            </div>
            <p className="text-sm font-medium text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground mt-1">
              No priority tasks assigned today
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.slice(0, 5).map((task, index) => (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg",
                  "bg-muted/10 hover:bg-muted/20 transition-colors",
                  "animate-fade-in-up"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/tasks`);
                }}
              >
                <span className={cn("status-dot flex-shrink-0", getStatusDotClass(task.status))} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {task.title}
                  </p>
                  {task.due_date && (
                    <p className="text-xs text-muted-foreground">
                      Due {format(new Date(task.due_date), "MMM d")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {tasks.length > 5 && (
        <div className="widget-footer">
          <p className="text-xs text-muted-foreground text-center">
            +{tasks.length - 5} more tasks
          </p>
        </div>
      )}
    </div>
  );
};