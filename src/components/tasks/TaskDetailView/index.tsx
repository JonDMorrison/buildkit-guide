import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useAuthRole } from '@/hooks/useAuthRole';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

import { TaskHeader } from './TaskHeader';
import { TaskMetadata } from './TaskMetadata';
import { TaskDescription } from './TaskDescription';
import { TaskAssignees } from './TaskAssignees';
import { TaskBlockers } from './TaskBlockers';
import { TaskDependencies } from './TaskDependencies';
import { TaskManpower } from './TaskManpower';
import { TaskAttachments } from './TaskAttachments';
import { TaskPhotos } from './TaskPhotos';
import { TaskChecklist } from './TaskChecklist';
import { TaskActivity } from './TaskActivity';
import { TaskActions } from './TaskActions';

export interface TaskDetailData {
  id: string;
  title: string;
  description: string | null;
  status: 'not_started' | 'in_progress' | 'blocked' | 'done';
  priority: number;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  due_date: string | null;
  estimated_hours: number | null;
  planned_hours: number | null;
  project_id: string;
  assigned_trade_id: string | null;
  review_requested_at: string | null;
  review_requested_by: string | null;
  created_at: string;
  trades?: { id: string; name: string; trade_type: string; company_name: string | null } | null;
  projects?: { name: string } | null;
}

interface TaskDetailViewProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated?: () => void;
}

export const TaskDetailView = ({
  taskId,
  open,
  onOpenChange,
  onTaskUpdated,
}: TaskDetailViewProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  const [task, setTask] = useState<TaskDetailData | null>(null);
  const [blockers, setBlockers] = useState<any[]>([]);
  const [dependencies, setDependencies] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [manpowerRequests, setManpowerRequests] = useState<any[]>([]);
  const [assignedWorkers, setAssignedWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Partial<TaskDetailData>>({});
  
  // Get permissions
  const { can, isWorker, isExternalTrade, canRequestManpower } = useAuthRole(task?.project_id);
  
  const canEdit = task?.project_id && can('edit_tasks', task.project_id);
  const canEditDates = task?.project_id && can('edit_task_dates', task.project_id);
  const canEditTrade = task?.project_id && can('assign_tasks', task.project_id);
  const isWorkerRole = task?.project_id && isWorker(task.project_id);

  const fetchTaskDetails = async () => {
    if (!taskId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch task
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select(`
          *,
          trades(id, name, trade_type, company_name),
          projects(name)
        `)
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;
      if (!taskData) throw new Error('Task not found');
      
      setTask(taskData);

      // Parallel fetch all related data
      const [
        blockersRes,
        depsRes,
        attachmentsRes,
        activityRes,
        tradesRes,
        manpowerRes,
        assignmentsRes,
      ] = await Promise.all([
        supabase
          .from('blockers')
          .select('*, trades(name, trade_type)')
          .eq('task_id', taskId)
          .eq('is_resolved', false),
        supabase
          .from('task_dependencies')
          .select('*, depends_on_task:tasks!task_dependencies_depends_on_task_id_fkey(id, title, status)')
          .eq('task_id', taskId),
        supabase
          .from('attachments')
          .select('*')
          .eq('task_id', taskId)
          .order('created_at', { ascending: false }),
        supabase
          .from('audit_log')
          .select('*, profiles:user_id(full_name, email)')
          .eq('record_id', taskId)
          .eq('table_name', 'tasks')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('trades')
          .select('id, name, trade_type')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('manpower_requests')
          .select('*, approved_by_profile:approved_by(full_name)')
          .eq('task_id', taskId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('task_assignments')
          .select(`
            id,
            user_id,
            assigned_at,
            profile:profiles!task_assignments_user_id_fkey(id, full_name, email, avatar_url)
          `)
          .eq('task_id', taskId),
      ]);

      setBlockers(blockersRes.data || []);
      setDependencies(depsRes.data || []);
      setAttachments(attachmentsRes.data || []);
      setActivityLog(activityRes.data || []);
      setTrades(tradesRes.data || []);
      setManpowerRequests(manpowerRes.data || []);
      setAssignedWorkers(assignmentsRes.data || []);

    } catch (err: any) {
      console.error('Error fetching task:', err);
      setError(err.message || 'Failed to load task');
      toast({
        title: 'Error loading task',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!taskId || !open) {
      setTask(null);
      setEditMode(false);
      setError(null);
      setPendingChanges({});
      return;
    }
    fetchTaskDetails();
  }, [taskId, open]);

  // Handle quick status change (optimistic update)
  const handleStatusChange = async (newStatus: string) => {
    if (!task || !taskId) return;
    
    const oldStatus = task.status;
    
    // Optimistic update
    setTask({ ...task, status: newStatus as TaskDetailData['status'] });
    
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus as 'not_started' | 'in_progress' | 'blocked' | 'done' })
        .eq('id', taskId);
      
      if (error) throw error;
      
      toast({
        title: 'Status updated',
        description: `Task marked as ${newStatus.replace('_', ' ')}`,
      });
      onTaskUpdated?.();
    } catch (err: any) {
      // Revert on error
      setTask({ ...task, status: oldStatus });
      toast({
        title: 'Error updating status',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Refetch helpers for child components
  const refetchBlockers = async () => {
    const { data } = await supabase
      .from('blockers')
      .select('*, trades(name, trade_type)')
      .eq('task_id', taskId)
      .eq('is_resolved', false);
    setBlockers(data || []);
  };

  const refetchDependencies = async () => {
    const { data } = await supabase
      .from('task_dependencies')
      .select('*, depends_on_task:tasks!task_dependencies_depends_on_task_id_fkey(id, title, status)')
      .eq('task_id', taskId);
    setDependencies(data || []);
  };

  const refetchManpower = async () => {
    const { data } = await supabase
      .from('manpower_requests')
      .select('*, approved_by_profile:approved_by(full_name)')
      .eq('task_id', taskId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    setManpowerRequests(data || []);
  };

  const refetchAssignees = async () => {
    const { data } = await supabase
      .from('task_assignments')
      .select(`
        id,
        user_id,
        assigned_at,
        profile:profiles!task_assignments_user_id_fkey(id, full_name, email, avatar_url)
      `)
      .eq('task_id', taskId);
    setAssignedWorkers(data || []);
    onTaskUpdated?.();
  };

  const refetchAttachments = async () => {
    const { data } = await supabase
      .from('attachments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    setAttachments(data || []);
  };

  // Content to render
  const renderContent = () => {
    // Loading state
    if (loading) {
      return (
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-24" />
          <Skeleton className="h-32" />
        </div>
      );
    }

    // Error state
    if (error || !task) {
      return (
        <div className="p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to load task</h3>
          <p className="text-muted-foreground mb-4">{error || 'Task not found'}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={fetchTaskDetails}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    // Main content
    return (
      <div className="flex flex-col h-full">
        {/* Sticky Header */}
        <TaskHeader
          task={task}
          onStatusChange={handleStatusChange}
          onClose={() => onOpenChange(false)}
          editMode={editMode}
          onEditModeChange={setEditMode}
          canEdit={!!canEdit}
        />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {/* Metadata Cards */}
          <TaskMetadata
            task={task}
            trade={task.trades}
            trades={trades}
            canEditDates={!!canEditDates}
            canEditTrade={!!canEditTrade}
            canEditHours={!!canEdit}
            onUpdate={(updates) => {
              setTask({ ...task, ...updates });
              if (updates.assigned_trade_id !== undefined) {
                // Refetch to get updated trade relation
                fetchTaskDetails();
              }
              onTaskUpdated?.();
            }}
          />

          {/* Description */}
          <TaskDescription
            task={task}
            editMode={editMode}
            canEdit={!!canEdit}
            onUpdate={(updates) => {
              setTask({ ...task, ...updates });
              onTaskUpdated?.();
            }}
          />

          {/* Assignees */}
          <TaskAssignees
            taskId={task.id}
            projectId={task.project_id}
            assignedTradeId={task.assigned_trade_id}
            assignedWorkers={assignedWorkers}
            canEdit={!!canEditTrade}
            onAssignmentChanged={refetchAssignees}
          />

          {/* Photos */}
          <TaskPhotos
            taskId={task.id}
            projectId={task.project_id}
            attachments={attachments.filter(a => 
              a.file_type?.startsWith('image/')
            )}
            canUpload={!!canEdit || !!isWorkerRole}
            onUploadComplete={refetchAttachments}
          />

          {/* Checklist */}
          <TaskChecklist
            taskId={task.id}
            canEdit={!!canEdit || !!isWorkerRole}
          />

          {/* Blockers */}
          <TaskBlockers
            task={task}
            blockers={blockers}
            canEdit={!!canEdit}
            onBlockersChanged={refetchBlockers}
          />

          {/* Dependencies */}
          <TaskDependencies
            taskId={task.id}
            projectId={task.project_id}
            dependencies={dependencies}
            canEdit={!!canEdit}
            onDependenciesChanged={refetchDependencies}
          />

          {/* Manpower */}
          <TaskManpower
            task={task}
            manpowerRequests={manpowerRequests}
            canRequest={!!canRequestManpower && !!task.assigned_trade_id}
            onManpowerChanged={refetchManpower}
          />

          {/* Attachments */}
          <TaskAttachments
            taskId={task.id}
            projectId={task.project_id}
            attachments={attachments.filter(a => 
              !a.file_type?.startsWith('image/')
            )}
            canUpload={!!canEdit}
            onUploadComplete={refetchAttachments}
          />

          {/* Activity */}
          <TaskActivity
            taskId={task.id}
            projectId={task.project_id}
            activityLog={activityLog}
          />
        </div>

        {/* Footer Actions */}
        <TaskActions
          task={task}
          editMode={editMode}
          isWorker={!!isWorkerRole}
          pendingChanges={pendingChanges}
          onEditModeChange={(edit) => {
            setEditMode(edit);
            if (!edit) {
              setPendingChanges({});
            }
          }}
          onClose={() => onOpenChange(false)}
          onTaskUpdated={() => {
            setPendingChanges({});
            fetchTaskDetails();
            onTaskUpdated?.();
          }}
        />
      </div>
    );
  };

  // Responsive container - Drawer on mobile, Dialog on desktop
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[90vh] max-h-[90vh]">
          {renderContent()}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};

export default TaskDetailView;
