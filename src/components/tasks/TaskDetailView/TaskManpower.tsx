import { useState } from 'react';
import { TaskDetailData } from './index';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HardHat, Plus } from 'lucide-react';
import { RequestManpowerModal } from '../RequestManpowerModal';
import { format } from 'date-fns';

interface ManpowerRequest {
  id: string;
  requested_count: number;
  duration_days: number | null;
  required_date: string;
  status: string;
  reason: string;
  approved_by_profile?: { full_name: string } | null;
}

interface TaskManpowerProps {
  task: TaskDetailData;
  manpowerRequests: ManpowerRequest[];
  canRequest: boolean;
  onManpowerChanged: () => void;
}

export const TaskManpower = ({
  task,
  manpowerRequests,
  canRequest,
  onManpowerChanged,
}: TaskManpowerProps) => {
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <HardHat className="h-4 w-4 text-muted-foreground" />
          Manpower Requests
          {manpowerRequests.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {manpowerRequests.length}
            </Badge>
          )}
        </div>
        {canRequest && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRequestModalOpen(true)}
            className="h-7 px-2"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Request
          </Button>
        )}
      </div>

      {manpowerRequests.length === 0 ? (
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-sm text-muted-foreground">No manpower requests</p>
          {canRequest && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setRequestModalOpen(true)}
              className="mt-1 h-auto p-0"
            >
              Request additional workers
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {manpowerRequests.map((request) => (
            <div
              key={request.id}
              className="rounded-lg bg-muted/50 p-3"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">
                  {request.requested_count} workers
                  {request.duration_days && ` · ${request.duration_days} days`}
                </span>
                <Badge variant={getStatusColor(request.status)}>
                  {request.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Needed by {format(new Date(request.required_date), 'MMM d, yyyy')}
              </p>
              {request.approved_by_profile && (
                <p className="text-xs text-muted-foreground mt-1">
                  {request.status === 'approved' ? 'Approved' : 'Reviewed'} by{' '}
                  {request.approved_by_profile.full_name}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <RequestManpowerModal
        taskId={task.id}
        projectId={task.project_id}
        tradeId={task.assigned_trade_id || ''}
        taskTitle={task.title}
        taskStatus={task.status}
        open={requestModalOpen}
        onOpenChange={setRequestModalOpen}
        onSuccess={onManpowerChanged}
      />
    </div>
  );
};
