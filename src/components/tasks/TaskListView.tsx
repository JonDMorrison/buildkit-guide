import { useState } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '../ui/checkbox';

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
}

interface SortableTaskItemProps {
  task: Task;
  onTaskClick: (taskId: string) => void;
  canReorder: boolean;
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

const SortableTaskItem = ({ task, onTaskClick, canReorder }: SortableTaskItemProps) => {
  const { toast } = useToast();
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

  const handleCheckboxChange = async (checked: boolean) => {
    const newStatus = checked ? 'done' : 'not_started';
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id);

      if (error) throw error;
      
      toast({
        title: checked ? 'Task completed' : 'Task reopened',
        description: task.title,
      });
      
      // Trigger a refresh by clicking (which will refetch)
      window.location.reload();
    } catch (err: any) {
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
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
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
        checked={task.status === 'done'}
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
          leading={<StatusBadge status={getStatusBadgeType(task.status)} label={getStatusLabel(task.status)} />}
          trailing={
            <div className="flex items-center gap-2">
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
export const TaskListView = ({ tasks, onTaskClick, canReorder = false, onTasksReordered }: TaskListViewProps) => {
  const { toast } = useToast();
  const [localTasks, setLocalTasks] = useState(tasks);

  // Update local tasks when prop changes
  if (tasks !== localTasks && !canReorder) {
    setLocalTasks(tasks);
  }

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
      
      // Update sort_order in database with batch operation to prevent race conditions
      try {
        const updates = newTasks.map((task, index) => ({
          id: task.id,
          sort_order: index,
        }));

        // Batch update using Promise.all for atomicity
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
        // Revert on error
        setLocalTasks(tasks);
      }
    }
  };

  const displayTasks = canReorder ? localTasks : tasks;

  if (!canReorder) {
    // Simple non-draggable list
    return (
      <div className="space-y-3">
        {displayTasks.map((task) => (
          <SortableTaskItem
            key={task.id}
            task={task}
            onTaskClick={onTaskClick}
            canReorder={false}
          />
        ))}
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
          {displayTasks.map((task) => (
            <SortableTaskItem
              key={task.id}
              task={task}
              onTaskClick={onTaskClick}
              canReorder={true}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
