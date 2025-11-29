import { useState } from "react";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationsList } from "@/components/notifications/NotificationsList";
import { useNotifications, NotificationType } from "@/hooks/useNotifications";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";

const Notifications = () => {
  const [filterType, setFilterType] = useState<NotificationType | undefined>(undefined);
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead } = useNotifications(filterType);

  const typeFilters: { label: string; value: NotificationType | undefined }[] = [
    { label: 'All', value: undefined },
    { label: 'Tasks', value: 'task_assigned' },
    { label: 'Blockers', value: 'blocker_added' },
    { label: 'Cleared', value: 'blocker_cleared' },
    { label: 'Safety', value: 'safety_alert' },
    { label: 'Manpower', value: 'manpower_request' },
    { label: 'Deficiencies', value: 'deficiency_created' },
    { label: 'Documents', value: 'document_uploaded' },
    { label: 'General', value: 'general' },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="container max-w-2xl mx-auto px-4 py-6">
          <Skeleton className="h-12 w-64 mb-6" />
          <Skeleton className="h-10 w-full mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-foreground">Notifications</h2>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-sm">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button onClick={markAllAsRead} variant="outline" size="sm">
              Mark all read
            </Button>
          )}
        </div>

        <Tabs 
          value={filterType || 'all'} 
          onValueChange={(value) => setFilterType(value === 'all' ? undefined : value as NotificationType)}
          className="mb-6"
        >
          <TabsList className="w-full grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 h-auto gap-1">
            {typeFilters.map((filter) => (
              <TabsTrigger 
                key={filter.label} 
                value={filter.value || 'all'}
                className="text-xs px-2 py-1.5"
              >
                {filter.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-6 mb-4">
              <Bell className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No notifications</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {filterType 
                ? `You don't have any ${typeFilters.find(f => f.value === filterType)?.label.toLowerCase()} notifications yet.`
                : "You're all caught up! Check back later for updates."
              }
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <NotificationsList
              notifications={notifications}
              onMarkAsRead={markAsRead}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Notifications;
