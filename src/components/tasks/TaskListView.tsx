import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ListItem } from '../ListItem';
import { StatusBadge } from '../StatusBadge';
import { TradeBadge } from '../TradeBadge';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { GripVertical, ChevronDown, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '../ui/checkbox';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface AssignedWorker {
  id: string;
  user_id: string;
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string;
  };
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  due_date: string | null;
  priority: number;
  sort_order?: number;
  is_generated?: boolean;
  scope_item_id?: string | null;
  project_id?: string;
  playbook_collapsed?: boolean;
  playbook_required?: boolean | null;
  trades?: {
    name: string;
    trade_type: string;
  };
  task_assignments?: AssignedWorker[];
}

interface TaskListViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  canReorder?: boolean;
  onTasksReordered?: (tasks: Task[]) => void;
  onTaskStatusChanged?: () => void;
}

interface SortableTaskItemProps {
  task: Task;
  onTaskClick: (taskId: string) => void;
  canReorder: boolean;
  isOptional?: boolean;
  onTaskStatusChanged?: () => void;
}

const getInitials = (name: string | null, email: string) => {
  if (name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  return email.substring(0, 2).toUpperCase();
};

const AssignedWorkersAvatars = ({ assignments }: { assignments?: AssignedWorker[] }) => {
  if (!assignments || assignments.length === 0) return null;

  const maxDisplay = 3;
  const displayWorkers = assignments.slice(0, maxDisplay);
  const remainingCount = assignments.length - maxDisplay;

  return (
    <TooltipProvider>
      <div className="flex -space-x-2">
        {displayWorkers.map((assignment) => (
          <Tooltip key={assignment.id}>
            <TooltipTrigger asChild>
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarImage src={assignment.profiles.avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {getInitials(assignment.profiles.full_name, assignment.profiles.email)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p>{assignment.profiles.full_name || assignment.profiles.email}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                  +{remainingCount}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p>{remainingCount} more assigned</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};

const SortableTaskItem = ({ task, onTaskClick, canReorder, isOptional = false, onTaskStatusChanged }: SortableTaskItemProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const currentStatus = optimisticStatus ?? task.status;

  const handleCheckboxChange = async (checked: boolean) => {
    const newStatus = checked ? 'done' : 'not_started';
    setOptimisticStatus(newStatus);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id);

      if (error) throw error;
      
      // Invalidate task queries so the UI updates
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] });
      onTaskStatusChanged?.();
      
      toast({
        title: checked ? 'Task completed' : 'Task reopened',
        description: task.title,
      });
    } catch (err: any) {
      setOptimisticStatus(null);
      toast({
        title: 'Error updating task',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadgeType = (status: string): 'complete' | 'blocked' | 'progress' | 'info' => {
    switch (status) {
      case 'done':
        return 'complete';
      case 'blocked':
        return 'blocked';
      case 'in_progress':
        return 'progress';
      default:
        return 'info';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'done':
        return 'Done';
      case 'blocked':
        return 'Blocked';
      case 'in_progress':
        return 'In Progress';
      case 'not_started':
        return 'Not Started';
      default:
        return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("flex items-center gap-2", isOptional && "opacity-50")}>
      {canReorder && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground touch-none"
        >
          <GripVertical className="h-5 w-5" />
        </button>
      )}
      <Checkbox
        checked={currentStatus === 'done'}
        onCheckedChange={handleCheckboxChange}
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0"
      />
      <div className="flex-1">
        <ListItem
          title={task.title}
          subtitle={
            task.due_date ? (
              `${new Date(task.due_date).toLocaleDateString()}${isOverdue(task.due_date) ? ' - Overdue' : ''}${task.priority === 1 ? ' - Urgent' : ''}`
            ) : (
              task.priority === 1 ? 'Urgent' : ''
            )
          }
          leading={<StatusBadge status={getStatusBadgeType(currentStatus)} label={getStatusLabel(currentStatus)} />}
          trailing={
            <div className="flex items-center gap-2">
              {task.is_generated && (
                <Badge
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-accent"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (task.project_id) {
                      navigate(`/projects/${task.project_id}?tab=scope`);
                    }
                  }}
                >
                  Generated
                </Badge>
              )}
              <AssignedWorkersAvatars assignments={task.task_assignments} />
              {task.trades && <TradeBadge trade={task.trades.trade_type as any} />}
            </div>
          }
          showChevron={false}
          onClick={() => onTaskClick(task.id)}
        />
      </div>
    </div>
  );
};
const DENSITY_THRESHOLD = 40;

export const TaskListView = ({ tasks, onTaskClick, canReorder = false, onTasksReordered, onTaskStatusChanged }: TaskListViewProps) => {
  const { toast } = useToast();
  const [localTasks, setLocalTasks] = useState(tasks);
  const [optionalExpanded, setOptionalExpanded] = useState(false);

  // Update local tasks when prop changes
  if (tasks !== localTasks && !canReorder) {
    setLocalTasks(tasks);
  }

  const displayTasks = canReorder ? localTasks : tasks;

  // Density governor: split core vs optional when above threshold
  const hasPlaybookTasks = displayTasks.some(t => t.playbook_collapsed != null);
  const shouldGovernDensity = hasPlaybookTasks && displayTasks.length > DENSITY_THRESHOLD;

  const coreTasks = shouldGovernDensity
    ? displayTasks.filter(t => !t.playbook_collapsed)
    : displayTasks;
  const optionalTasks = shouldGovernDensity
    ? displayTasks.filter(t => t.playbook_collapsed)
    : [];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localTasks.findIndex((t) => t.id === active.id);
      const newIndex = localTasks.findIndex((t) => t.id === over.id);
      
      const newTasks = arrayMove(localTasks, oldIndex, newIndex);
      setLocalTasks(newTasks);
      
      try {
        const updates = newTasks.map((task, index) => ({
          id: task.id,
          sort_order: index,
        }));

        const updatePromises = updates.map((update) =>
          supabase
            .from('tasks')
            .update({ sort_order: update.sort_order })
            .eq('id', update.id)
        );
        
        const results = await Promise.all(updatePromises);
        const hasError = results.some(r => r.error);
        
        if (hasError) {
          throw new Error('Failed to save task order');
        }

        onTasksReordered?.(newTasks);
        
        toast({
          title: 'Tasks reordered',
          description: 'Task order has been saved.',
        });
      } catch (error: any) {
        toast({
          title: 'Error saving order',
          description: error.message,
          variant: 'destructive',
        });
        setLocalTasks(tasks);
      }
    }
  };

  const renderTaskItem = (task: Task, isOptional: boolean) => (
    <SortableTaskItem
      key={task.id}
      task={task}
      onTaskClick={onTaskClick}
      canReorder={canReorder}
      isOptional={isOptional}
      onTaskStatusChanged={onTaskStatusChanged}
    />
  );

  const densityGovernorSection = shouldGovernDensity && optionalTasks.length > 0 ? (
    <div className="space-y-2">
      {/* Density summary bar */}
      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40 border border-border/40">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {coreTasks.length} Core Tasks Loaded
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOptionalExpanded(!optionalExpanded)}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn(
            "h-3.5 w-3.5 transition-transform",
            optionalExpanded && "rotate-180"
          )} />
          +{optionalTasks.length} Optional ({optionalExpanded ? 'Collapse' : 'Expand'})
        </Button>
      </div>

      {/* Optional tasks (collapsed by default) */}
      {optionalExpanded && (
        <div className="space-y-3 pl-2 border-l-2 border-border/30">
          <p className="text-[11px] text-muted-foreground px-2">
            Optional tasks are not assigned by default and do not trigger workflow blocks.
          </p>
          {optionalTasks.map(task => renderTaskItem(task, true))}
        </div>
      )}
    </div>
  ) : null;

  if (!canReorder) {
    return (
      <div className="space-y-3">
        {coreTasks.map(task => renderTaskItem(task, false))}
        {densityGovernorSection}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={displayTasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {coreTasks.map(task => renderTaskItem(task, false))}
          {densityGovernorSection}
        </div>
      </SortableContext>
    </DndContext>
  );
};
