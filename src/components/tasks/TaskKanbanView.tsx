import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { TradeBadge } from '../TradeBadge';
import { Calendar, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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