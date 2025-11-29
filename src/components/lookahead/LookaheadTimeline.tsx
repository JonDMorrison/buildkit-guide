import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { StatusBadge } from '../StatusBadge';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string;
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
  onTaskClick: (taskId: string) => void;
}

export const LookaheadTimeline = ({ tasks, startDate, onTaskClick }: LookaheadTimelineProps) => {
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

  const getTasksForDate = (trade: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return tasksByTrade[trade]?.filter(t => t.due_date?.startsWith(dateStr)) || [];
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
        <div className="grid grid-cols-[200px_repeat(14,1fr)] gap-2 mb-4">
          <div className="font-bold text-sm">Trade</div>
          {days.map((day, i) => (
            <div
              key={i}
              className={cn(
                "text-center p-2 rounded-t-lg font-semibold",
                isToday(day) && "bg-primary text-primary-foreground",
                !isToday(day) && isWeekend(day) && "bg-muted/50 text-muted-foreground",
                !isToday(day) && !isWeekend(day) && "bg-card"
              )}
            >
              <div className="text-xs uppercase">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className="text-lg font-bold">
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Trade Rows */}
        {Object.entries(tasksByTrade).map(([trade, _]) => (
          <div key={trade} className="grid grid-cols-[200px_repeat(14,1fr)] gap-2 mb-3">
            {/* Trade Name */}
            <div className="flex items-center">
              <div className="font-semibold text-sm truncate bg-card p-3 rounded-lg border border-border">
                {trade}
              </div>
            </div>

            {/* Days */}
            {days.map((day, i) => {
              const dayTasks = getTasksForDate(trade, day);
              
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[80px] p-1 rounded-lg border-2",
                    isWeekend(day) && "bg-muted/30 border-muted",
                    !isWeekend(day) && "bg-card border-border"
                  )}
                >
                  <div className="space-y-1">
                    {dayTasks.map((task) => (
                      <Card
                        key={task.id}
                        onClick={() => onTaskClick(task.id)}
                        className={cn(
                          "p-2 cursor-pointer hover:shadow-md transition-shadow border-l-4",
                          task.status === 'done' && "border-l-status-complete bg-status-complete/10",
                          task.status === 'blocked' && "border-l-status-issue bg-status-issue/10",
                          task.status === 'in_progress' && "border-l-status-progress bg-status-progress/10",
                          task.status === 'not_started' && "border-l-muted bg-background"
                        )}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-xs font-medium leading-tight line-clamp-2 flex-1">
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
                        
                        <div className="flex items-center gap-1 mt-1">
                          {task.priority === 1 && (
                            <Badge variant="error" className="text-[10px] h-4 px-1">
                              !
                            </Badge>
                          )}
                          {task._blockerCount && task._blockerCount > 0 && (
                            <div className="flex items-center gap-0.5 bg-status-issue/20 rounded px-1">
                              <AlertCircle className="h-2.5 w-2.5 text-status-issue" />
                              <span className="text-[10px] font-semibold text-status-issue">
                                {task._blockerCount}
                              </span>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
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