import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, UserMinus, Plus } from 'lucide-react';
import { AssignWorkerModal } from '../AssignWorkerModal';

interface AssignedWorker {
  id: string;
  user_id: string;
  assigned_at: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

interface TaskAssigneesProps {
  taskId: string;
  projectId: string;
  assignedTradeId: string | null;
  assignedWorkers: AssignedWorker[];
  canEdit: boolean;
  onAssignmentChanged: () => void;
}

export const TaskAssignees = ({
  taskId,
  projectId,
  assignedTradeId,
  assignedWorkers,
  canEdit,
  onAssignmentChanged,
}: TaskAssigneesProps) => {
  const { toast } = useToast();
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  const handleRemoveWorker = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('task_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      toast({ title: 'Worker removed from task' });
      onAssignmentChanged();
    } catch (err: any) {
      toast({
        title: 'Error removing worker',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const getInitials = (worker: AssignedWorker) => {
    if (worker.profile?.full_name) {
      return worker.profile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return worker.profile?.email?.charAt(0).toUpperCase() || '?';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          Assigned Workers
          {assignedWorkers.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {assignedWorkers.length}
            </Badge>
          )}
        </div>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAssignModalOpen(true)}
            className="h-7 px-2"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Assign
          </Button>
        )}
      </div>

      {assignedWorkers.length === 0 ? (
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-sm text-muted-foreground">No workers assigned</p>
          {canEdit && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setAssignModalOpen(true)}
              className="mt-1 h-auto p-0"
            >
              Assign someone
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {/* Avatar Stack for compact view */}
          {assignedWorkers.slice(0, 5).map((worker, index) => (
            <div
              key={worker.id}
              className="group relative flex items-center gap-2 rounded-full bg-muted/50 pl-1 pr-3 py-1"
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={worker.profile?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(worker)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium truncate max-w-[100px]">
                {worker.profile?.full_name || worker.profile?.email}
              </span>
              {canEdit && (
                <button
                  onClick={() => handleRemoveWorker(worker.id)}
                  className="absolute -right-1 -top-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                >
                  <UserMinus className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
          {assignedWorkers.length > 5 && (
            <div className="flex items-center justify-center rounded-full bg-muted px-3 py-1">
              <span className="text-xs font-medium">
                +{assignedWorkers.length - 5} more
              </span>
            </div>
          )}
        </div>
      )}

      <AssignWorkerModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        taskId={taskId}
        projectId={projectId}
        assignedTradeId={assignedTradeId}
        currentAssignments={assignedWorkers.map(w => w.user_id)}
        onAssignmentChanged={onAssignmentChanged}
      />
    </div>
  );
};
