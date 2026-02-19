import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { NotificationsFeed } from "./NotificationsFeed";
import { IssuesList, useSystemIssues } from "./IssuesList";
import { AIInsightsList } from "./AIInsightsList";
import type { Notification } from "@/hooks/useNotifications";

interface ControlCenterTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
}

export function ControlCenterTabs({
  activeTab,
  onTabChange,
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose,
}: ControlCenterTabsProps) {
  const navigate = useNavigate();
  const { data: issues } = useSystemIssues();
  const criticalCount = issues?.filter(i => i.severity === 'critical').length ?? 0;
  const totalIssues = issues?.length ?? 0;

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <div className="px-1 pt-1">
        <TabsList className="grid w-full grid-cols-3 h-8 bg-muted/50">
          <TabsTrigger value="issues" className="text-[11px] gap-1 data-[state=active]:bg-card">
            Issues
            {totalIssues > 0 && (
              <Badge
                variant={criticalCount > 0 ? "destructive" : "secondary"}
                className="h-4 min-w-[16px] px-1 text-[10px] font-semibold"
              >
                {totalIssues}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-[11px] gap-1 data-[state=active]:bg-card">
            Activity
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="insights" className="text-[11px] gap-1 data-[state=active]:bg-card">
            AI
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="issues" className="m-0 mt-0">
        <IssuesList />
      </TabsContent>

      <TabsContent value="notifications" className="m-0 mt-0">
        {unreadCount > 0 && (
          <div className="flex justify-end px-3 py-1.5 border-b border-border/50">
            <Button variant="ghost" size="sm" onClick={onMarkAllAsRead} className="text-[11px] h-6 px-2">
              Mark all read
            </Button>
          </div>
        )}
        <NotificationsFeed
          notifications={notifications}
          onMarkAsRead={onMarkAsRead}
          onClose={onClose}
        />
        <div className="border-t border-border/50 p-1.5">
          <Button
            variant="ghost"
            className="w-full h-7 text-[11px]"
            onClick={() => { navigate('/notifications'); onClose(); }}
          >
            View all notifications
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="insights" className="m-0 mt-0">
        <AIInsightsList onClose={onClose} />
      </TabsContent>
    </Tabs>
  );
}
