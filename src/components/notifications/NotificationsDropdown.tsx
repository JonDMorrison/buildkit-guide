import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationsList } from "./NotificationsList";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";

export const NotificationsDropdown = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const recentNotifications = notifications.slice(0, 5);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative min-h-10 min-w-10">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs"
            >
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {recentNotifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <NotificationsList
              notifications={recentNotifications}
              onMarkAsRead={markAsRead}
              compact
            />
          )}
        </ScrollArea>
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate('/notifications')}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
