import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { StatusBadge } from '../StatusBadge';
import { AlertCircle, AlertTriangle, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string;
  start_date?: string | null;
  end_date?: string | null;
  priority: number;
  trades?: {
    name: string;
    trade_type: string;
    company_name: string;
  };
  _blockerCount?: number;
}

interface LookaheadMobileViewProps {
  tasks: Task[];
  startDate: Date;
  delayedTaskIds: string[];
  onTaskClick: (taskId: string) => void;
}

export const LookaheadMobileView = ({ 
  tasks, 
  startDate, 
  delayedTaskIds, 
  onTaskClick 
}: LookaheadMobileViewProps) => {
  // Generate 14 days
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    return date;
  });

  // Group tasks by date
  const tasksByDate = days.map(date => {
    const dateStr = date.toISOString().split('T')[0];
    
    const dayTasks = tasks.filter(task => {
      // If task has start_date and end_date, check if date is within range
      if (task.start_date && task.end_date) {
        return dateStr >= task.start_date && dateStr <= task.end_date;
      }
      // Otherwise use due_date
      return task.due_date?.startsWith(dateStr);
    });

    return {
      date,
      dateStr,
      tasks: dayTasks,
    };
  });

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="space-y-3">
      {tasksByDate.map(({ date, dateStr, tasks: dayTasks }) => (
        <div key={dateStr}>
          {/* Date Header */}
          <div
            className={cn(
              "sticky top-0 z-20 flex items-center justify-between p-4 mb-3 rounded-lg font-bold",
              isToday(date) && "bg-primary text-primary-foreground",
              !isToday(date) && isWeekend(date) && "bg-muted text-muted-foreground",
              !isToday(date) && !isWeekend(date) && "bg-card border-2 border-border"
            )}
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <span className="text-base">{formatDate(date)}</span>
            </div>
            <Badge 
              variant={isToday(date) ? "secondary" : "outline"}
              className="text-sm font-bold"
            >
              {dayTasks.length} {dayTasks.length === 1 ? 'task' : 'tasks'}
            </Badge>
          </div>

          {/* Tasks for this date */}
          {dayTasks.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No tasks scheduled
            </div>
          ) : (
            <div className="space-y-3">
              {dayTasks.map((task) => {
                const isDelayed = delayedTaskIds.includes(task.id);
                const isMultiDay = task.start_date && task.end_date && task.start_date !== task.end_date;

                return (
                  <Card
                    key={task.id}
                    onClick={() => onTaskClick(task.id)}
                    className={cn(
                      "p-4 cursor-pointer hover:shadow-lg transition-all border-l-4 relative",
                      task.status === 'done' && "border-l-status-complete bg-status-complete/10",
                      task.status === 'blocked' && "border-l-status-issue bg-status-issue/10",
                      task.status === 'in_progress' && "border-l-status-progress bg-status-progress/10",
                      task.status === 'not_started' && "border-l-muted bg-background"
                    )}
                  >
                    {/* Delay Warning Badge */}
                    {isDelayed && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="warning" className="text-xs h-6 px-2 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          At Risk
                        </Badge>
                      </div>
                    )}

                    {/* Trade Name */}
                    {task.trades && (
                      <div className="text-xs font-semibold text-muted-foreground mb-2">
                        {task.trades.company_name}
                      </div>
                    )}

                    {/* Task Title */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="text-base font-bold leading-tight flex-1 pr-8">
                        {task.title}
                      </h3>
                      <StatusBadge
                        status={
                          task.status === 'done' ? 'complete' :
                          task.status === 'blocked' ? 'blocked' :
                          task.status === 'in_progress' ? 'progress' : 'info'
                        }
                      />
                    </div>

                    {/* Task Metadata */}
                    <div className="flex items-center flex-wrap gap-2">
                      {task.priority === 1 && (
                        <Badge variant="error" className="text-xs h-6 px-2 font-bold">
                          ! High Priority
                        </Badge>
                      )}
                      
                      {task._blockerCount && task._blockerCount > 0 && (
                        <Badge variant="destructive" className="text-xs h-6 px-2 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {task._blockerCount} {task._blockerCount === 1 ? 'Blocker' : 'Blockers'}
                        </Badge>
                      )}
                      
                      {isMultiDay && (
                        <Badge variant="secondary" className="text-xs h-6 px-2">
                          {new Date(task.start_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {' - '}
                          {new Date(task.end_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Badge>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
