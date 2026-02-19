import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { ControlCenterTabs } from "./ControlCenterTabs";
import { useSystemIssues } from "./IssuesList";

export function ControlCenterDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { data: issues } = useSystemIssues();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("issues");

  // Default to Issues tab if critical issues exist, otherwise notifications
  const criticalCount = issues?.filter(i => i.severity === 'critical').length ?? 0;

  useEffect(() => {
    if (criticalCount > 0) {
      setActiveTab("issues");
    } else if (unreadCount > 0) {
      setActiveTab("notifications");
    }
  }, [criticalCount, unreadCount]);

  // Badge: unread notifications + critical issues
  const badgeCount = unreadCount + criticalCount;

  // Keyboard: Esc closes
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) setOpen(false);
  }, [open]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-h-10 min-w-10"
          aria-label="Open control center"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {badgeCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4.5 min-w-[18px] p-0 flex items-center justify-center text-[10px] font-semibold"
            >
              {badgeCount > 9 ? '9+' : badgeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0 bg-popover/95 backdrop-blur-xl border-border/60 shadow-lg rounded-xl z-[100]"
        align="end"
        sideOffset={8}
        role="dialog"
        aria-label="Control Center"
      >
        <ControlCenterTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          notifications={notifications.slice(0, 20)}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
