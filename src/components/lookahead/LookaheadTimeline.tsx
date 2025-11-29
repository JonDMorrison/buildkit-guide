import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { StatusBadge } from '../StatusBadge';
import { AlertCircle, AlertTriangle } from 'lucide-react';
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

interface LookaheadTimelineProps {
  tasks: Task[];
  startDate: Date;
  delayedTaskIds: string[];
  onTaskClick: (taskId: string) => void;
}

export const LookaheadTimeline = ({ tasks, startDate, delayedTaskIds, onTaskClick }: LookaheadTimelineProps) => {
  // Generate 14 days
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    return date;
  });

  // Group tasks by trade
  const tasksByTrade = tasks.reduce((acc, task) => {
    const tradeName = task.trades?.company_name || 'Unassigned';
    if (!acc[tradeName]) acc[tradeName] = [];
    acc[tradeName].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  // Helper to check if a task spans or starts on a given date
  const getTasksForDate = (trade: string, date: Date, dayIndex: number) => {
    const dateStr = date.toISOString().split('T')[0];
    
    return tasksByTrade[trade]?.filter(task => {
      // If task has start_date and end_date, check if date is within range
      if (task.start_date && task.end_date) {
        return dateStr >= task.start_date && dateStr <= task.end_date;
      }
      // Otherwise use due_date
      return task.due_date?.startsWith(dateStr);
    }).map(task => {
      // Calculate span info for multi-day tasks
      let spanDays = 1;
      let isStartOfSpan = false;
      
      if (task.start_date && task.end_date) {
        const taskStart = new Date(task.start_date);
        const taskEnd = new Date(task.end_date);
        const diffTime = taskEnd.getTime() - taskStart.getTime();
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        // Check if this date is the start of the task
        if (task.start_date === dateStr) {
          isStartOfSpan = true;
          // Calculate how many days to span from this date (max 14 - current day index)
          spanDays = Math.min(totalDays, 14 - dayIndex);
        } else {
          // Task continues from previous day, don't render it again
          return null;
        }
      } else {
        isStartOfSpan = true;
      }
      
      return { ...task, _spanDays: spanDays, _isStartOfSpan: isStartOfSpan };
    }).filter(Boolean) || [];
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1200px]">
        {/* Header Row - Days */}
        <div className="grid grid-cols-[240px_repeat(14,1fr)] gap-2 mb-4">
          <div className="font-bold text-base sticky left-0 bg-background z-10 pr-2">Trade</div>
          {days.map((day, i) => (
            <div
              key={i}
              className={cn(
                "text-center p-3 rounded-t-lg font-bold",
                isToday(day) && "bg-primary text-primary-foreground",
                !isToday(day) && isWeekend(day) && "bg-muted/50 text-muted-foreground",
                !isToday(day) && !isWeekend(day) && "bg-card"
              )}
            >
              <div className="text-xs uppercase tracking-wide">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className="text-xl font-bold">
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Trade Rows */}
        {Object.entries(tasksByTrade).map(([trade, _]) => (
          <div key={trade} className="grid grid-cols-[240px_repeat(14,1fr)] gap-2 mb-4">
            {/* Trade Name - Sticky */}
            <div className="flex items-center sticky left-0 bg-background z-10 pr-2">
              <div className="font-bold text-base truncate bg-card p-4 rounded-lg border-2 border-border w-full">
                {trade}
              </div>
            </div>

            {/* Days */}
            {days.map((day, dayIndex) => {
              const dayTasks = getTasksForDate(trade, day, dayIndex);
              
              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "min-h-[96px] p-2 rounded-lg border-2 relative",
                    isWeekend(day) && "bg-muted/30 border-muted",
                    !isWeekend(day) && "bg-card border-border"
                  )}
                >
                  <div className="space-y-2">
                    {dayTasks.map((task: any) => {
                      if (!task._isStartOfSpan) return null;
                      
                      const isDelayed = delayedTaskIds.includes(task.id);
                      
                      return (
                        <Card
                          key={task.id}
                          onClick={() => onTaskClick(task.id)}
                          style={{
                            gridColumn: task._spanDays > 1 ? `span ${task._spanDays}` : undefined,
                          }}
                          className={cn(
                            "p-4 cursor-pointer hover:shadow-lg transition-all border-l-4 min-h-[48px] relative",
                            task.status === 'done' && "border-l-status-complete bg-status-complete/10",
                            task.status === 'blocked' && "border-l-status-issue bg-status-issue/10",
                            task.status === 'in_progress' && "border-l-status-progress bg-status-progress/10",
                            task.status === 'not_started' && "border-l-muted bg-background",
                            task._spanDays > 1 && "col-span-full"
                          )}
                        >
                          {isDelayed && (
                            <div className="absolute top-1 right-1">
                              <Badge variant="warning" className="text-xs h-5 px-2 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                At Risk
                              </Badge>
                            </div>
                          )}
                          
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold leading-tight line-clamp-2 flex-1">
                              {task.title}
                            </p>
                            <StatusBadge
                              status={
                                task.status === 'done' ? 'complete' :
                                task.status === 'blocked' ? 'blocked' :
                                task.status === 'in_progress' ? 'progress' : 'info'
                              }
                              dotOnly
                            />
                          </div>
                          
                          <div className="flex items-center gap-1.5 mt-2">
                            {task.priority === 1 && (
                              <Badge variant="error" className="text-xs h-5 px-2 font-bold">
                                !
                              </Badge>
                            )}
                            {task._blockerCount && task._blockerCount > 0 && (
                              <div className="flex items-center gap-1 bg-status-issue/20 rounded px-2 py-0.5">
                                <AlertCircle className="h-3 w-3 text-status-issue" />
                                <span className="text-xs font-bold text-status-issue">
                                  {task._blockerCount}
                                </span>
                              </div>
                            )}
                            {task._spanDays > 1 && (
                              <Badge variant="secondary" className="text-xs h-5 px-2">
                                {task._spanDays}d
                              </Badge>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};