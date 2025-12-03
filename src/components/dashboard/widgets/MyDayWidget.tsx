import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="border-primary/20 shadow-md h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-secondary" />
          My Day
        </CardTitle>
        <CardDescription className="text-sm">Priority tasks needing attention</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto min-h-0 p-3">
        {priorityTasks.length > 0 ? (
          <div className="space-y-2">
            {priorityTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate("/tasks")}
              >
                <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  task.status === "blocked" ? "bg-accent animate-pulse" : "bg-primary"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{task.title}</p>
                  {task.due_date && (
                    <p className="text-xs text-muted-foreground">
                      Due: {format(new Date(task.due_date), "MMM dd")}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-6">
            <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-secondary" />
            </div>
            <p className="font-semibold text-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground">No urgent tasks today</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
