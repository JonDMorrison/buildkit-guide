import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { TradeBadge } from '../TradeBadge';
import { StatusBadge } from '../StatusBadge';
import { Separator } from '../ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Calendar, AlertTriangle, FileText, Users, Link2, History } from 'lucide-react';

interface TaskDetailModalProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated?: () => void;
}

export const TaskDetailModal = ({ taskId, open, onOpenChange, onTaskUpdated }: TaskDetailModalProps) => {
  const { toast } = useToast();
  const [task, setTask] = useState<any>(null);
  const [blockers, setBlockers] = useState<any[]>([]);
  const [dependencies, setDependencies] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId || !open) {
      setTask(null);
      return;
    }

    const fetchTaskDetails = async () => {
      setLoading(true);
      try {
        // Fetch task
        const { data: taskData, error: taskError } = await supabase
          .from('tasks')
          .select(`
            *,
            trades(name, trade_type, company_name),
            projects(name)
          `)
          .eq('id', taskId)
          .single();

        if (taskError) throw taskError;
        setTask(taskData);

        // Fetch blockers
        const { data: blockersData } = await supabase
          .from('blockers')
          .select('*, trades(name, trade_type)')
          .eq('task_id', taskId)
          .eq('is_resolved', false);
        setBlockers(blockersData || []);

        // Fetch dependencies
        const { data: depsData } = await supabase
          .from('task_dependencies')
          .select('*, depends_on_task:tasks!task_dependencies_depends_on_task_id_fkey(id, title, status)')
          .eq('task_id', taskId);
        setDependencies(depsData || []);

        // Fetch attachments
        const { data: attachData } = await supabase
          .from('attachments')
          .select('*')
          .eq('task_id', taskId)
          .order('created_at', { ascending: false });
        setAttachments(attachData || []);

        // Fetch assignments
        const { data: assignData } = await supabase
          .from('task_assignments')
          .select('*, profiles(full_name, email)')
          .eq('task_id', taskId);
        setAssignments(assignData || []);

      } catch (error: any) {
        toast({
          title: 'Error loading task',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTaskDetails();
  }, [taskId, open, toast]);

  const updateTaskStatus = async (newStatus: string) => {
    if (!taskId) return;

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus as 'not_started' | 'in_progress' | 'blocked' | 'done' })
      .eq('id', taskId);

    if (error) {
      toast({
        title: 'Error updating status',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Status updated',
        description: `Task status changed to ${newStatus}`,
      });
      setTask({ ...task, status: newStatus });
      onTaskUpdated?.();
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-24" />
            <Skeleton className="h-32" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold mb-2 block">Status</label>
              <Select value={task.status} onValueChange={updateTaskStatus}>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border z-50">
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-semibold mb-2 block">Priority</label>
              <Badge variant={task.priority === 1 ? 'error' : 'secondary'}>
                {task.priority === 1 ? 'Urgent' : task.priority === 2 ? 'High' : 'Normal'}
              </Badge>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </div>
          )}

          <Separator />

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Due Date</span>
              </div>
              <p className="text-sm text-muted-foreground ml-6">
                {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Trade</span>
              </div>
              <div className="ml-6">
                {task.trades ? (
                  <TradeBadge trade={task.trades.trade_type} />
                ) : (
                  <p className="text-sm text-muted-foreground">Not assigned</p>
                )}
              </div>
            </div>
          </div>

          {/* Blockers */}
          {blockers.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-status-issue" />
                  <h3 className="text-sm font-semibold">Active Blockers</h3>
                  <Badge variant="error">{blockers.length}</Badge>
                </div>
                <div className="space-y-2">
                  {blockers.map((blocker) => (
                    <div key={blocker.id} className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">{blocker.reason}</p>
                      {blocker.description && (
                        <p className="text-sm text-muted-foreground mt-1">{blocker.description}</p>
                      )}
                      {blocker.trades && (
                        <TradeBadge trade={blocker.trades.trade_type} className="mt-2" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Dependencies */}
          {dependencies.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Dependencies</h3>
                </div>
                <div className="space-y-2">
                  {dependencies.map((dep) => (
                    <div key={dep.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="text-sm">{dep.depends_on_task?.title}</span>
                      <StatusBadge
                        status={
                          dep.depends_on_task?.status === 'done' ? 'complete' :
                          dep.depends_on_task?.status === 'blocked' ? 'blocked' : 'progress'
                        }
                        label={dep.depends_on_task?.status}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Assigned Workers */}
          {assignments.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Assigned Workers</h3>
                </div>
                <div className="space-y-2">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                        {assignment.profiles?.full_name?.[0] || assignment.profiles?.email?.[0] || 'U'}
                      </div>
                      <span className="text-sm">
                        {assignment.profiles?.full_name || assignment.profiles?.email}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Attachments</h3>
                  <Badge variant="secondary">{attachments.length}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                      <p className="text-xs text-muted-foreground">{attachment.file_type}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};