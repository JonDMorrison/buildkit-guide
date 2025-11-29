import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

type StatusType = "complete" | "progress" | "blocked" | "info";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  dotOnly?: boolean;
  className?: string;
}

const statusConfig: Record<StatusType, { defaultLabel: string; className: string }> = {
  complete: {
    defaultLabel: "Complete",
    className: "bg-status-complete text-status-complete-foreground",
  },
  progress: {
    defaultLabel: "In Progress",
    className: "bg-status-progress text-status-progress-foreground",
  },
  blocked: {
    defaultLabel: "Blocked",
    className: "bg-status-issue text-status-issue-foreground",
  },
  info: {
    defaultLabel: "Info",
    className: "bg-status-info text-status-info-foreground",
  },
};

export const StatusBadge = ({ status, label, dotOnly = false, className }: StatusBadgeProps) => {
  const config = statusConfig[status];
  const displayLabel = label || config.defaultLabel;

  if (dotOnly) {
    return (
      <span className={cn("inline-block w-2 h-2 rounded-full", config.className, className)} />
    );
  }

  return (
    <Badge className={cn(config.className, className)}>
      {displayLabel}
    </Badge>
  );
};
