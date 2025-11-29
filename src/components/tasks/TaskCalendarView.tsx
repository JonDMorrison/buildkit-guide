import { useState, useMemo } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  trades?: {
    trade_type: string;
  };
}

interface TaskCalendarViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
}

export const TaskCalendarView = ({ tasks, onTaskClick }: TaskCalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const { year, month } = useMemo(() => ({
    year: currentDate.getFullYear(),
    month: currentDate.getMonth(),
  }), [currentDate]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getTasksForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.filter(task => task.due_date?.startsWith(dateStr));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && 
           today.getMonth() === month && 
           today.getFullYear() === year;
  };

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  return (
    <div>
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          {new Date(year, month).toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
          })}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={previousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day Headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
            {day}
          </div>
        ))}

        {/* Blank spaces for first week */}
        {blanks.map((blank) => (
          <div key={`blank-${blank}`} className="min-h-[100px]" />
        ))}

        {/* Calendar Days */}
        {days.map((day) => {
          const dayTasks = getTasksForDate(day);
          
          return (
            <Card
              key={day}
              className={cn(
                "min-h-[100px] p-2",
                isToday(day) && "border-primary border-2"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  "text-sm font-semibold",
                  isToday(day) && "text-primary"
                )}>
                  {day}
                </span>
                {dayTasks.length > 0 && (
                  <Badge variant="secondary" className="text-xs h-5">
                    {dayTasks.length}
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                {dayTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onTaskClick(task.id)}
                    className={cn(
                      "text-xs p-1 rounded cursor-pointer hover:opacity-80 truncate",
                      task.status === 'done' && "bg-status-complete/20 text-status-complete",
                      task.status === 'blocked' && "bg-status-issue/20 text-status-issue",
                      task.status === 'in_progress' && "bg-status-progress/20 text-status-progress-foreground",
                      task.status === 'not_started' && "bg-muted text-foreground"
                    )}
                  >
                    {task.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center">
                    +{dayTasks.length - 3} more
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};