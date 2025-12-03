import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
}

interface MyDayWidgetProps {
  priorityTasks: Task[];
}

export const MyDayWidget = ({ priorityTasks }: MyDayWidgetProps) => {
  const navigate = useNavigate();

  return (
    <div className="widget-card h-full">
      <div className="flex-shrink-0 mb-3">
        <h3 className="widget-title">
          <CheckCircle2 className="h-4 w-4 text-secondary" />
          My Day
        </h3>
        <p className="widget-subtitle">Priority tasks needing attention</p>
      </div>
      
      <div className="flex-1 overflow-auto min-h-0">
        {priorityTasks.length > 0 ? (
          <div className="space-y-2">
            {priorityTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/5 hover:bg-muted/10 hover:border-primary/20 transition-all duration-200 cursor-pointer"
                onClick={() => navigate("/tasks")}
              >
                <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  task.status === "blocked" ? "bg-accent animate-pulse" : "bg-secondary"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{task.title}</p>
                  {task.due_date && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due: {format(new Date(task.due_date), "MMM dd")}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-6">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-secondary" />
            </div>
            <p className="font-medium text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground">No urgent tasks today</p>
          </div>
        )}
      </div>
    </div>
  );
};
