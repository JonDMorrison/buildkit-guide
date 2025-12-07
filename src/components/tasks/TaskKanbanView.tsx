import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { TradeBadge } from '../TradeBadge';
import { Calendar, AlertCircle } from 'lucide-react';
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
  trades?: {
    name: string;
    trade_type: string;
  };
  task_assignments?: AssignedWorker[];
}

interface TaskKanbanViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
}

const columns = [
  { id: 'not_started', label: 'Not Started', color: 'border-muted' },
  { id: 'in_progress', label: 'In Progress', color: 'border-status-progress' },
  { id: 'blocked', label: 'Blocked', color: 'border-status-issue' },
  { id: 'done', label: 'Done', color: 'border-status-complete' },
];

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
              <Avatar className="h-5 w-5 border-2 border-background">
                <AvatarImage src={assignment.profiles.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
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
              <Avatar className="h-5 w-5 border-2 border-background">
                <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
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

export const TaskKanbanView = ({ tasks, onTaskClick }: TaskKanbanViewProps) => {
  const getTasksByStatus = (status: string) => {
    return tasks.filter(task => task.status === status);
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {columns.map((column) => {
        const columnTasks = getTasksByStatus(column.id);
        
        return (
          <div key={column.id} className="flex flex-col">
            <div className={cn(
              "border-t-4 rounded-t-lg p-3 bg-card mb-2",
              column.color
            )}>
              <h3 className="font-semibold text-foreground">{column.label}</h3>
              <p className="text-sm text-muted-foreground">{columnTasks.length} tasks</p>
            </div>

            <div className="space-y-3 flex-1">
              {columnTasks.map((task) => (
                <Card
                  key={task.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => onTaskClick(task.id)}
                >
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold">
                      {task.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2">
                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap gap-2">
                      {task.priority === 1 && (
                        <Badge variant="error" className="text-xs">Urgent</Badge>
                      )}
                      {task.trades && (
                        <TradeBadge trade={task.trades.trade_type as any} />
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      {task.due_date && (
                        <div className={cn(
                          "flex items-center gap-1 text-xs",
                          isOverdue(task.due_date) && "text-status-issue"
                        )}>
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(task.due_date).toLocaleDateString()}</span>
                          {isOverdue(task.due_date) && (
                            <AlertCircle className="h-3 w-3" />
                          )}
                        </div>
                      )}
                      <AssignedWorkersAvatars assignments={task.task_assignments} />
                    </div>
                  </CardContent>
                </Card>
              ))}

              {columnTasks.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};