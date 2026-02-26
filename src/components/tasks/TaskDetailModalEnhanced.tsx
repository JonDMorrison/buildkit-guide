import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { useSmartDefaults } from '@/hooks/useSmartDefaults';
import { useAuthRole } from '@/hooks/useAuthRole';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Alert, AlertDescription } from '../ui/alert';
import { CommentsSection } from '../comments/CommentsSection';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { TradeBadge } from '../TradeBadge';
import { StatusBadge } from '../StatusBadge';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { DatePicker } from '../ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { 
  Calendar, 
  AlertTriangle, 
  FileText, 
  Users, 
  Link2, 
  Paperclip, 
  Edit2,
  Save,
  X,
  Clock,
  Upload,
  Plus,
  HardHat,
  UserPlus,
  UserMinus,
  Mail
} from 'lucide-react';
import { FormField } from '../FormField';
import { RequestManpowerModal } from './RequestManpowerModal';
import { TaskDependencyManager } from './TaskDependencyManager';
import { AssignWorkerModal } from './AssignWorkerModal';
import { EscalationEmailModal } from '../ai-assist/EscalationEmailModal';

interface TaskDetailModalEnhancedProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated?: () => void;
}

export const TaskDetailModalEnhanced = ({ 
  taskId, 
  open, 
  onOpenChange, 
  onTaskUpdated 
}: TaskDetailModalEnhancedProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [task, setTask] = useState<any>(null);
  const [blockers, setBlockers] = useState<any[]>([]);
  const [dependencies, setDependencies] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [manpowerRequests, setManpowerRequests] = useState<any[]>([]);
  const [assignedWorkers, setAssignedWorkers] = useState<any[]>([]);
  const [projectMembersMap, setProjectMembersMap] = useState<Map<string, { full_name: string | null; email: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [assigningWorkerId, setAssigningWorkerId] = useState<string | null>(null);
  const [manpowerModalOpen, setManpowerModalOpen] = useState(false);
  const [assignWorkerModalOpen, setAssignWorkerModalOpen] = useState(false);
  const [escalationEmailOpen, setEscalationEmailOpen] = useState(false);
  
  // Get permissions using task's project_id
  const { 
    can, 
    isWorker, 
    isExternalTrade,
    canRequestManpower 
  } = useAuthRole(task?.project_id);
  
  const canEdit = task?.project_id && can('edit_tasks', task.project_id);
  const canDelete = task?.project_id && can('delete_tasks', task.project_id);
  const canEditDates = task?.project_id && can('edit_task_dates', task.project_id);
  const canEditTrade = task?.project_id && can('assign_tasks', task.project_id);
  const isWorkerRole = task?.project_id && isWorker(task.project_id);
  const isExternalTradeRole = task?.project_id && isExternalTrade(task.project_id);

  const smartDefaults = useSmartDefaults(task?.project_id || undefined);

  // Compute worker suggestion chips
  const workerChips = useMemo(() => {
    if (!canEditTrade || smartDefaults.suggestedWorkerIds.length === 0) return [];
    const assignedUserIds = new Set(assignedWorkers.map((a: any) => a.user_id));
    return smartDefaults.suggestedWorkerIds
      .filter((uid) => !assignedUserIds.has(uid) && projectMembersMap.has(uid))
      .map((uid) => {
        const member = projectMembersMap.get(uid)!;
        return { id: uid, name: member.full_name || member.email };
      })
      .slice(0, 5);
  }, [canEditTrade, smartDefaults.suggestedWorkerIds, assignedWorkers, projectMembersMap]);

  const handleQuickAssign = useCallback(async (userId: string) => {
    if (!taskId || assigningWorkerId) return;
    // Guard against duplicate
    if (assignedWorkers.some((a: any) => a.user_id === userId)) {
      toast({ title: 'Already assigned', description: 'This worker is already on this task.' });
      return;
    }
    setAssigningWorkerId(userId);
    try {
      const { error } = await supabase
        .from('task_assignments')
        .insert({ task_id: taskId, user_id: userId });
      if (error) throw error;
      // Refetch assigned workers
      const { data } = await supabase
        .from('task_assignments')
        .select('id, user_id, assigned_at, profile:profiles!task_assignments_user_id_fkey(id, full_name, email, avatar_url)')
        .eq('task_id', taskId);
      setAssignedWorkers(data || []);
      queryClient.invalidateQueries({ queryKey: ['smart-defaults', task?.project_id] });
      onTaskUpdated?.();
      toast({ title: 'Worker assigned', description: 'Worker has been added to this task.' });
    } catch (error: any) {
      toast({ title: 'Error assigning worker', description: error.message, variant: 'destructive' });
    } finally {
      setAssigningWorkerId(null);
    }
  }, [taskId, assigningWorkerId, assignedWorkers, task?.project_id, queryClient, onTaskUpdated, toast]);

  useEffect(() => {
    if (!taskId || !open) {
      setTask(null);
      setEditMode(false);
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
            trades(id, name, trade_type, company_name),
            projects(name)
          `)
          .eq('id', taskId)
          .single();

        if (taskError) throw taskError;
        setTask(taskData);
        setEditForm({
          title: taskData.title,
          description: taskData.description || '',
          assigned_trade_id: taskData.assigned_trade_id || '',
          start_date: taskData.start_date || '',
          end_date: taskData.end_date || '',
          status: taskData.status,
        });

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

        // Fetch activity log from audit_log
        const { data: auditData } = await supabase
          .from('audit_log')
          .select('*, profiles:user_id(full_name, email)')
          .eq('record_id', taskId)
          .eq('table_name', 'tasks')
          .order('created_at', { ascending: false })
          .limit(10);
        setActivityLog(auditData || []);

        // Fetch trades for dropdown
        const { data: tradesData } = await supabase
          .from('trades')
          .select('id, name, trade_type')
          .eq('is_active', true)
          .order('name');
        setTrades(tradesData || []);

        // Fetch manpower requests
        const { data: manpowerData } = await supabase
          .from('manpower_requests')
          .select('*, approved_by_profile:approved_by(full_name)')
          .eq('task_id', taskId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });
        setManpowerRequests(manpowerData || []);

        // Fetch assigned workers
        const { data: assignmentsData } = await supabase
          .from('task_assignments')
          .select(`
            id,
            user_id,
            assigned_at,
            profile:profiles!task_assignments_user_id_fkey(id, full_name, email, avatar_url)
          `)
          .eq('task_id', taskId);
        setAssignedWorkers(assignmentsData || []);

        // Fetch project members for smart worker chips (lightweight: just user_id + display)
        if (taskData.project_id) {
          const { data: membersData } = await supabase
            .from('project_members')
            .select('user_id, profile:profiles!project_members_user_id_fkey(full_name, email)')
            .eq('project_id', taskData.project_id);
          const map = new Map<string, { full_name: string | null; email: string }>();
          (membersData || []).forEach((m: any) => {
            if (m.profile) map.set(m.user_id, { full_name: m.profile.full_name, email: m.profile.email });
          });
          setProjectMembersMap(map);
        }
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

  const handleSave = async () => {
    if (!taskId) return;

    // Validation
    if (!editForm.title?.trim()) {
      toast({
        title: 'Validation error',
        description: 'Title is required',
        variant: 'destructive',
      });
      return;
    }

    if (!editForm.assigned_trade_id) {
      toast({
        title: 'Validation error',
        description: 'Trade is required',
        variant: 'destructive',
      });
      return;
    }

    if (editForm.start_date && editForm.end_date) {
      if (new Date(editForm.end_date) < new Date(editForm.start_date)) {
        toast({
          title: 'Validation error',
          description: 'End date must be on or after start date',
          variant: 'destructive',
        });
        return;
      }
    }

    if (editForm.status === 'blocked' && blockers.length === 0) {
      toast({
        title: 'Validation error',
        description: 'Please add a blocker reason before marking as blocked',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editForm.title.trim(),
          description: editForm.description?.trim() || null,
          assigned_trade_id: editForm.assigned_trade_id,
          start_date: editForm.start_date || null,
          end_date: editForm.end_date || null,
          status: editForm.status,
        })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Task updated',
        description: 'Changes saved successfully',
      });

      setTask({ ...task, ...editForm });
      setEditMode(false);
      onTaskUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Error saving',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
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
          <div className="flex items-start justify-between">
            {editMode ? (
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="text-xl font-semibold"
                placeholder="Task title"
                disabled={!canEdit}
              />
            ) : (
              <DialogTitle className="text-xl">{task.title}</DialogTitle>
            )}
            {canEdit && !editMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditMode(true)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* View-only warning for workers */}
          {isWorkerRole && (
            <Alert>
              <AlertDescription className="text-sm">
                You have view-only access. You can only update the task status.
              </AlertDescription>
            </Alert>
          )}

          {/* Status and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold mb-2 block">Status</label>
              {editMode ? (
                <Select 
                  value={editForm.status} 
                  onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                >
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
              ) : (
                <StatusBadge 
                  status={
                    task.status === 'done' ? 'complete' :
                    task.status === 'blocked' ? 'blocked' :
                    task.status === 'in_progress' ? 'progress' : 'info'
                  }
                  label={task.status}
                />
              )}
            </div>

            <div>
              <label className="text-sm font-semibold mb-2 block">Priority</label>
              <Badge variant={task.priority === 1 ? 'destructive' : 'secondary'}>
                {task.priority === 1 ? 'Urgent' : task.priority === 2 ? 'High' : 'Normal'}
              </Badge>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Description</h3>
            {editMode ? (
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Task description..."
                className="min-h-[80px]"
                disabled={!canEdit}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {task.description || 'No description provided'}
              </p>
            )}
          </div>

          <Separator />

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Start Date</span>
              </div>
              {editMode ? (
                <div className="ml-6">
                  <DatePicker
                    value={editForm.start_date}
                    onChange={(v) => setEditForm({ ...editForm, start_date: v })}
                    placeholder="Select start date"
                    disabled={!canEditDates}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground ml-6">
                  {task.start_date ? new Date(task.start_date).toLocaleDateString() : 'Not set'}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">End Date</span>
              </div>
              {editMode ? (
                <div className="ml-6">
                  <DatePicker
                    value={editForm.end_date}
                    onChange={(v) => setEditForm({ ...editForm, end_date: v })}
                    placeholder="Select end date"
                    minDate={editForm.start_date}
                    disabled={!canEditDates}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground ml-6">
                  {task.end_date ? new Date(task.end_date).toLocaleDateString() : 'Not set'}
                </p>
              )}
            </div>

            <div className="col-span-2">
              <div className="flex items-center gap-2 text-sm mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Assigned Trade</span>
              </div>
              {editMode ? (
                <Select
                  value={editForm.assigned_trade_id}
                  onValueChange={(v) => setEditForm({ ...editForm, assigned_trade_id: v })}
                  disabled={!canEditTrade}
                >
                  <SelectTrigger className="ml-6 bg-card border-border">
                    <SelectValue placeholder="Select trade" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border z-50">
                    {trades.map((trade) => (
                      <SelectItem key={trade.id} value={trade.id}>
                        {trade.name} ({trade.trade_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="ml-6">
                  {task.trades ? (
                    <TradeBadge trade={task.trades.trade_type} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Not assigned</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Assigned Workers Section */}
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Assigned Workers</h3>
                {assignedWorkers.length > 0 && (
                  <Badge variant="secondary">{assignedWorkers.length}</Badge>
                )}
              </div>
              {canEditTrade && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAssignWorkerModalOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Assign
                </Button>
              )}
            </div>
            {/* Smart worker suggestion chips */}
            {workerChips.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                <span className="text-xs text-muted-foreground">Recently assigned:</span>
                {workerChips.map((w) => (
                  <Badge
                    key={w.id}
                    variant="outline"
                    className={`cursor-pointer text-xs px-2 py-0.5 hover:bg-accent active:scale-95 transition-all ${assigningWorkerId === w.id ? 'opacity-50 pointer-events-none' : ''}`}
                    onClick={() => handleQuickAssign(w.id)}
                  >
                    {w.name}
                  </Badge>
                ))}
              </div>
            )}
            {assignedWorkers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workers assigned to this task</p>
            ) : (
              <div className="space-y-2">
                {assignedWorkers.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={assignment.profile?.avatar_url || undefined} />
                        <AvatarFallback>
                          {assignment.profile?.full_name
                            ? assignment.profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                            : assignment.profile?.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {assignment.profile?.full_name || assignment.profile?.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {canEditTrade && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from('task_assignments')
                              .delete()
                              .eq('id', assignment.id);
                            
                            if (error) throw error;
                            
                            setAssignedWorkers(prev => prev.filter(a => a.id !== assignment.id));
                            toast({
                              title: 'Worker removed',
                              description: 'Worker has been unassigned from this task',
                            });
                            onTaskUpdated?.();
                          } catch (error: any) {
                            toast({
                              title: 'Error removing worker',
                              description: error.message,
                              variant: 'destructive',
                            });
                          }
                        }}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Blockers */}
          {blockers.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-status-issue" />
                    <h3 className="text-sm font-semibold">Active Blockers</h3>
                    <Badge variant="destructive">{blockers.length}</Badge>
                  </div>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEscalationEmailOpen(true)}
                      className="gap-1.5 text-xs"
                    >
                      <Mail className="h-3 w-3" />
                      Draft Escalation
                    </Button>
                  )}
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
          <Separator />
          <TaskDependencyManager
            taskId={taskId!}
            projectId={task.project_id}
            dependencies={dependencies}
            onDependenciesChanged={() => {
              // Refetch dependencies
              supabase
                .from('task_dependencies')
                .select('*, depends_on_task:tasks!task_dependencies_depends_on_task_id_fkey(id, title, status)')
                .eq('task_id', taskId)
                .then(({ data }) => setDependencies(data || []));
            }}
            canEdit={canEdit}
          />

          {/* Manpower */}
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HardHat className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Manpower</h3>
                {manpowerRequests.length > 0 && (
                  <Badge variant="secondary">{manpowerRequests.length}</Badge>
                )}
              </div>
              {canRequestManpower && task.assigned_trade_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManpowerModalOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Request
                </Button>
              )}
            </div>
            {manpowerRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No manpower requests</p>
            ) : (
              <div className="space-y-2">
                {manpowerRequests.map((request) => (
                  <div key={request.id} className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {request.requested_count} workers • {request.duration_days} days
                      </span>
                      <Badge
                        variant={
                          request.status === 'approved' ? 'default' :
                          request.status === 'rejected' ? 'destructive' : 'secondary'
                        }
                      >
                        {request.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Starting {new Date(request.required_date).toLocaleDateString()}
                    </p>
                    {request.approved_by_profile && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {request.status === 'approved' ? 'Approved' : 'Rejected'} by {request.approved_by_profile.full_name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

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
                    <a
                      key={attachment.id}
                      href={attachment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      <Paperclip className="h-4 w-4" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                        <p className="text-xs text-muted-foreground">{attachment.file_type}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Activity Log */}
          {activityLog.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Activity Log</h3>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {activityLog.map((log) => (
                    <div key={log.id} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-primary">
                          {log.action.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">
                        by {log.profiles?.full_name || log.profiles?.email || 'Unknown'}
                      </p>
                      {log.old_data && log.new_data && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {JSON.stringify(log.new_data).slice(0, 100)}...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Comments Section */}
          <Separator />
          <div>
            <h3 className="text-sm font-semibold mb-3">Discussion</h3>
            <CommentsSection
              taskId={taskId}
              projectId={task.project_id}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex gap-2 pt-4">
            {editMode ? (
              <>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setEditMode(false);
                    setEditForm({
                      title: task.title,
                      description: task.description || '',
                      assigned_trade_id: task.assigned_trade_id || '',
                      start_date: task.start_date || '',
                      end_date: task.end_date || '',
                      status: task.status,
                    });
                  }}
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                {/* Request Review button for workers */}
                {isWorkerRole && !task.review_requested_at && task.status !== 'done' && (
                  <Button 
                    variant="default"
                    className="flex-1"
                    onClick={async () => {
                      try {
                        const { error } = await supabase
                          .from('tasks')
                          .update({
                            review_requested_at: new Date().toISOString(),
                            review_requested_by: user?.id,
                          })
                          .eq('id', taskId);
                        
                        if (error) throw error;
                        
                        setTask({ ...task, review_requested_at: new Date().toISOString() });
                        toast({
                          title: 'Review requested',
                          description: 'PM/Foreman has been notified to review this task.',
                        });
                        onTaskUpdated?.();
                      } catch (error: any) {
                        toast({
                          title: 'Error requesting review',
                          description: error.message,
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    Request Review
                  </Button>
                )}
                {isWorkerRole && task.review_requested_at && (
                  <Badge variant="secondary" className="flex-1 justify-center py-2">
                    Review Requested
                  </Badge>
                )}
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
      
      {/* Request Manpower Modal */}
      {task && (
        <RequestManpowerModal
          taskId={task.id}
          projectId={task.project_id}
          tradeId={task.assigned_trade_id || ''}
          taskTitle={task.title}
          taskStatus={task.status}
          open={manpowerModalOpen}
          onOpenChange={setManpowerModalOpen}
          onSuccess={() => {
            // Refetch manpower requests
            supabase
              .from('manpower_requests')
              .select('*, approved_by_profile:approved_by(full_name)')
              .eq('task_id', task.id)
              .eq('is_deleted', false)
              .order('created_at', { ascending: false })
              .then(({ data }) => setManpowerRequests(data || []));
          }}
        />
      )}

      {/* Assign Worker Modal */}
      {task && (
        <AssignWorkerModal
          open={assignWorkerModalOpen}
          onOpenChange={setAssignWorkerModalOpen}
          taskId={task.id}
          projectId={task.project_id}
          assignedTradeId={task.assigned_trade_id}
          currentAssignments={assignedWorkers.map(a => a.user_id)}
          onAssignmentChanged={() => {
            // Refetch assigned workers
            supabase
              .from('task_assignments')
              .select(`
                id,
                user_id,
                assigned_at,
                profile:profiles!task_assignments_user_id_fkey(id, full_name, email, avatar_url)
              `)
              .eq('task_id', task.id)
              .then(({ data }) => setAssignedWorkers(data || []));
            onTaskUpdated?.();
          }}
        />
      )}

      {/* Escalation Email Modal */}
      {task && blockers.length > 0 && (
        <EscalationEmailModal
          open={escalationEmailOpen}
          onOpenChange={setEscalationEmailOpen}
          projectId={task.project_id}
          blockerId={blockers[0]?.id}
          blockerReason={blockers[0]?.reason || ''}
          taskTitle={task.title}
        />
      )}
    </Dialog>
  );
};