import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { TradeBadge } from "@/components/TradeBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, Calendar, MapPin } from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  start_date: string | null;
  location: string | null;
  assigned_trade?: {
    name: string;
    trade_type?: string;
  } | null;
}

interface SnapshotDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  tasks: Task[];
  filterParam?: string;
}

export const SnapshotDetailModal = ({
  open,
  onOpenChange,
  title,
  tasks,
  filterParam,
}: SnapshotDetailModalProps) => {
  const navigate = useNavigate();

  const getStatusBadgeType = (status: string) => {
    switch (status) {
      case "done": return "complete";
      case "blocked": return "blocked";
      case "in_progress": return "progress";
      default: return "info";
    }
  };

  const handleViewAll = () => {
    onOpenChange(false);
    navigate(filterParam ? `/tasks?${filterParam}` : "/tasks");
  };

  const handleTaskClick = (taskId: string) => {
    onOpenChange(false);
    navigate(`/tasks?taskId=${taskId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{title}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {tasks.length} task{tasks.length !== 1 ? "s" : ""}
            </span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          {tasks.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No tasks found
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task.id)}
                  className="p-3 rounded-lg border border-border bg-card hover:bg-accent/5 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <StatusBadge status={getStatusBadgeType(task.status)} dotOnly />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {task.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {task.due_date && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.due_date), "MMM d")}
                          </span>
                        )}
                        {task.location && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {task.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {task.assigned_trade && (
                        <TradeBadge trade={task.assigned_trade.trade_type || "general"} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="pt-2">
          <Button onClick={handleViewAll} className="w-full" variant="outline">
            View All Tasks <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
