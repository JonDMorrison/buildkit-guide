import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { ChevronRight } from "lucide-react";

interface ProjectCardProps {
  name: string;
  location: string;
  status: "active" | "planning" | "completed";
  tasks: {
    total: number;
    completed: number;
  };
}

const statusConfig = {
  active: {
    label: "Active",
    className: "bg-status-complete text-status-complete-foreground",
  },
  planning: {
    label: "Planning",
    className: "bg-status-progress text-status-progress-foreground",
  },
  completed: {
    label: "Completed",
    className: "bg-muted text-muted-foreground",
  },
};

export const ProjectCard = ({ name, location, status, tasks }: ProjectCardProps) => {
  const statusInfo = statusConfig[status];
  const completion = Math.round((tasks.completed / tasks.total) * 100);

  return (
    <Card className="p-4 border border-border hover:border-primary/50 transition-colors cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-foreground mb-1">{name}</h3>
          <p className="text-sm text-muted-foreground">{location}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <Badge className={statusInfo.className}>
            {statusInfo.label}
          </Badge>
          <span className="text-muted-foreground">
            {tasks.completed}/{tasks.total} tasks
          </span>
        </div>
        <Progress value={completion} />
      </div>
    </Card>
  );
};
