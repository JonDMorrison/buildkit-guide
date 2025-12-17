import { Badge } from '@/components/ui/badge';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { Clock, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityLogEntry {
  id: string;
  action: string;
  created_at: string;
  old_data: any;
  new_data: any;
  profiles?: { full_name: string | null; email: string } | null;
}

interface TaskActivityProps {
  taskId: string;
  projectId: string;
  activityLog: ActivityLogEntry[];
}

export const TaskActivity = ({
  taskId,
  projectId,
  activityLog,
}: TaskActivityProps) => {
  const formatAction = (action: string) => {
    switch (action) {
      case 'INSERT': return 'created';
      case 'UPDATE': return 'updated';
      case 'DELETE': return 'deleted';
      default: return action.toLowerCase();
    }
  };

  const getChangeSummary = (entry: ActivityLogEntry) => {
    if (!entry.old_data || !entry.new_data) return null;
    
    const changes: string[] = [];
    
    if (entry.old_data.status !== entry.new_data.status) {
      changes.push(`status → ${entry.new_data.status}`);
    }
    if (entry.old_data.title !== entry.new_data.title) {
      changes.push('title updated');
    }
    if (entry.old_data.description !== entry.new_data.description) {
      changes.push('description updated');
    }
    
    return changes.length > 0 ? changes.join(', ') : null;
  };

  return (
    <div className="space-y-4">
      {/* Comments Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Discussion
        </div>
        <CommentsSection
          taskId={taskId}
          projectId={projectId}
        />
      </div>

      {/* Activity Log */}
      {activityLog.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Activity
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {activityLog.map((entry) => {
              const changeSummary = getChangeSummary(entry);
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">
                      {entry.profiles?.full_name || entry.profiles?.email || 'Someone'}
                    </span>
                    {' '}
                    {formatAction(entry.action)} this task
                    {changeSummary && (
                      <span className="text-muted-foreground"> ({changeSummary})</span>
                    )}
                    <span className="text-muted-foreground">
                      {' · '}
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
