import { useState, useEffect } from "react";
import { Bell, Lightbulb, AlertTriangle, ChevronRight, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationsList } from "./NotificationsList";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { supabase } from "@/integrations/supabase/client";

interface Insight {
  text: string;
  type: 'warning' | 'info' | 'action';
  route?: string;
}

export const NotificationsDropdown = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { currentProjectId } = useCurrentProject();
  const recentNotifications = notifications.slice(0, 5);
  
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("notifications");

  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const fetchInsights = async (force = false) => {
    if (!currentProjectId) return;
    
    const now = Date.now();
    if (!force && lastFetched && now - lastFetched < CACHE_DURATION && insights.length > 0) {
      return;
    }

    setInsightsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assist', {
        body: {
          project_id: currentProjectId,
          quick_action: 'insights',
        },
      });

      if (error) throw error;

      const pressingIssues = data?.pressing_issues;
      const newInsights: Insight[] = [];

      if (pressingIssues) {
        if (pressingIssues.old_blockers_count > 0) {
          newInsights.push({
            text: `${pressingIssues.old_blockers_count} blocker${pressingIssues.old_blockers_count > 1 ? 's' : ''} older than 3 days`,
            type: 'warning',
            route: '/tasks?status=blocked',
          });
        }
        if (pressingIssues.overdue_count > 0) {
          newInsights.push({
            text: `${pressingIssues.overdue_count} overdue task${pressingIssues.overdue_count > 1 ? 's' : ''}`,
            type: 'warning',
            route: '/tasks',
          });
        }
        if (pressingIssues.due_today_count > 0) {
          newInsights.push({
            text: `${pressingIssues.due_today_count} task${pressingIssues.due_today_count > 1 ? 's' : ''} due today`,
            type: 'info',
            route: '/tasks',
          });
        }
        if (pressingIssues.pending_manpower_count > 0) {
          newInsights.push({
            text: `${pressingIssues.pending_manpower_count} pending manpower request${pressingIssues.pending_manpower_count > 1 ? 's' : ''}`,
            type: 'action',
            route: '/manpower',
          });
        }
        if (pressingIssues.safety_incidents_count > 0) {
          newInsights.push({
            text: `${pressingIssues.safety_incidents_count} safety incident${pressingIssues.safety_incidents_count > 1 ? 's' : ''} this week`,
            type: 'warning',
            route: '/safety',
          });
        }
      }

      if (newInsights.length === 0) {
        newInsights.push({
          text: 'No critical issues - project on track',
          type: 'info',
        });
      }

      setInsights(newInsights);
      setLastFetched(now);
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    if (open && activeTab === 'insights' && currentProjectId) {
      fetchInsights();
    }
  }, [open, activeTab, currentProjectId]);

  const handleInsightClick = (insight: Insight) => {
    if (insight.route) {
      navigate(insight.route);
      setOpen(false);
    }
  };

  const warningCount = insights.filter(i => i.type === 'warning').length;
  const actionCount = insights.filter(i => i.type === 'action').length;
  const insightsCount = warningCount + actionCount;
  const totalBadgeCount = unreadCount + insightsCount;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative min-h-10 min-w-10">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {totalBadgeCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {totalBadgeCount > 9 ? '9+' : totalBadgeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-popover" align="end">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between px-2 pt-2 border-b border-border">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="notifications" className="text-xs gap-1.5">
                <Bell className="h-3.5 w-3.5" />
                Notifications
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px]">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="insights" className="text-xs gap-1.5">
                <Lightbulb className="h-3.5 w-3.5" />
                AI Insights
                {insightsCount > 0 && (
                  <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px]">
                    {insightsCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="notifications" className="m-0">
            {unreadCount > 0 && (
              <div className="flex justify-end px-3 py-2 border-b border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs h-7"
                >
                  Mark all read
                </Button>
              </div>
            )}
            <ScrollArea className="h-[320px]">
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
                className="w-full h-8 text-xs"
                onClick={() => {
                  navigate('/notifications');
                  setOpen(false);
                }}
              >
                View all notifications
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="insights" className="m-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs text-muted-foreground">
                {currentProjectId ? 'Project insights' : 'Select a project'}
              </span>
              {currentProjectId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => fetchInsights(true)}
                  disabled={insightsLoading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${insightsLoading ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
            <ScrollArea className="h-[320px]">
              {!currentProjectId ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Select a project to see AI insights
                </div>
              ) : insightsLoading && insights.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : insights.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No insights available
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {insights.map((insight, index) => (
                    <button
                      key={index}
                      onClick={() => handleInsightClick(insight)}
                      disabled={!insight.route}
                      className={`w-full flex items-start gap-3 p-3 text-left transition-colors ${
                        insight.route ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <div className={`mt-0.5 ${
                        insight.type === 'warning' ? 'text-destructive' :
                        insight.type === 'action' ? 'text-accent' : 'text-muted-foreground'
                      }`}>
                        {insight.type === 'warning' ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <Lightbulb className="h-4 w-4" />
                        )}
                      </div>
                      <span className="flex-1 text-sm">{insight.text}</span>
                      {insight.route && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            {lastFetched > 0 && (
              <div className="px-3 py-2 border-t border-border bg-muted/30">
                <p className="text-[10px] text-muted-foreground text-center">
                  Updated {new Date(lastFetched).toLocaleTimeString()}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};
