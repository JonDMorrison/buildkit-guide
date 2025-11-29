import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Shield, 
  Users, 
  Info 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Notification, NotificationType } from "@/hooks/useNotifications";

interface NotificationsListProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  compact?: boolean;
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'task_assigned':
      return <CheckCircle2 className="h-5 w-5 text-status-info" />;
    case 'blocker_added':
      return <AlertTriangle className="h-5 w-5 text-status-issue" />;
    case 'safety_alert':
      return <Shield className="h-5 w-5 text-status-progress" />;
    case 'manpower_request':
      return <Users className="h-5 w-5 text-status-info" />;
    case 'general':
    default:
      return <Info className="h-5 w-5 text-muted-foreground" />;
  }
};

const getTypeLabel = (type: NotificationType) => {
  switch (type) {
    case 'task_assigned':
      return 'Task Assigned';
    case 'blocker_added':
      return 'Blocker';
    case 'safety_alert':
      return 'Safety';
    case 'manpower_request':
      return 'Manpower';
    case 'general':
    default:
      return 'General';
  }
};

export const NotificationsList = ({ 
  notifications, 
  onMarkAsRead, 
  compact = false 
}: NotificationsListProps) => {
  const navigate = useNavigate();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
    if (notification.link_url) {
      navigate(notification.link_url);
    }
  };

  return (
    <div className={cn("divide-y divide-border", compact ? "p-0" : "space-y-0")}>
      {notifications.map((notification) => (
        <div
          key={notification.id}
          onClick={() => handleNotificationClick(notification)}
          className={cn(
            "flex gap-3 transition-colors cursor-pointer",
            compact ? "p-3" : "p-4",
            !notification.is_read && "bg-accent/50",
            "hover:bg-accent"
          )}
        >
          <div className="flex-shrink-0 mt-1">
            {getNotificationIcon(notification.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className={cn(
                "text-sm font-semibold truncate",
                !notification.is_read && "text-foreground",
                notification.is_read && "text-muted-foreground"
              )}>
                {notification.title}
              </h4>
              {!notification.is_read && (
                <div className="h-2 w-2 bg-primary rounded-full flex-shrink-0 mt-1" />
              )}
            </div>
            
            <p className={cn(
              "text-sm mb-2",
              compact ? "line-clamp-2" : "line-clamp-3",
              notification.is_read ? "text-muted-foreground" : "text-foreground"
            )}>
              {notification.message}
            </p>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {getTypeLabel(notification.type)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
