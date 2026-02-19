import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Shield, Users, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Notification, NotificationType } from "@/hooks/useNotifications";

interface NotificationsFeedProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onClose: () => void;
}

const typeIcon: Record<string, React.ReactNode> = {
  task_assigned: <CheckCircle2 className="h-4 w-4 text-status-info" />,
  blocker_added: <AlertTriangle className="h-4 w-4 text-status-issue" />,
  blocker_cleared: <CheckCircle2 className="h-4 w-4 text-status-success" />,
  safety_alert: <Shield className="h-4 w-4 text-status-progress" />,
  manpower_request: <Users className="h-4 w-4 text-status-info" />,
  manpower_approved: <Users className="h-4 w-4 text-status-success" />,
  manpower_denied: <Users className="h-4 w-4 text-status-issue" />,
  deficiency_created: <AlertTriangle className="h-4 w-4 text-status-issue" />,
  document_uploaded: <Info className="h-4 w-4 text-status-info" />,
  incident_report: <Shield className="h-4 w-4 text-status-issue" />,
  general: <Info className="h-4 w-4 text-muted-foreground" />,
};

// Filter out system/integrity notifications — those belong in Issues tab
const isHumanActivity = (type: NotificationType) =>
  !['guardrail_warning'].includes(type);

export function NotificationsFeed({ notifications, onMarkAsRead, onClose }: NotificationsFeedProps) {
  const navigate = useNavigate();
  const filtered = notifications.filter(n => isHumanActivity(n.type)).slice(0, 20);

  const handleClick = (n: Notification) => {
    if (!n.is_read) onMarkAsRead(n.id);
    if (n.link_url) {
      navigate(n.link_url);
      onClose();
    }
  };

  if (filtered.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No notifications yet
      </div>
    );
  }

  return (
    <ScrollArea className="h-[360px]">
      <div className="divide-y divide-border/50">
        {filtered.map(n => (
          <button
            key={n.id}
            onClick={() => handleClick(n)}
            className={cn(
              "w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
              !n.is_read && "bg-primary/[0.03]"
            )}
          >
            <div className="shrink-0 mt-0.5">
              {typeIcon[n.type] || typeIcon.general}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className={cn(
                  "text-sm leading-tight truncate",
                  !n.is_read ? "font-medium text-foreground" : "text-muted-foreground"
                )}>
                  {n.title}
                </p>
                {!n.is_read && (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.message}</p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5 tabular-nums">
              {formatDistanceToNow(new Date(n.created_at), { addSuffix: false })}
            </span>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
