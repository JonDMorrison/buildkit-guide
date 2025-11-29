import { ListItem } from '../ListItem';
import { StatusBadge } from '../StatusBadge';
import { TradeBadge } from '../TradeBadge';
import { Badge } from '../ui/badge';
import { Calendar, AlertCircle } from 'lucide-react';

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

interface TaskListViewProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
}

export const TaskListView = ({ tasks, onTaskClick }: TaskListViewProps) => {
  const getStatusBadgeType = (status: string) => {
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

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <ListItem
          key={task.id}
          title={task.title}
          subtitle={
            task.due_date ? (
              `${new Date(task.due_date).toLocaleDateString()}${isOverdue(task.due_date) ? ' - Overdue' : ''}${task.priority === 1 ? ' - Urgent' : ''}`
            ) : (
              task.priority === 1 ? 'Urgent' : ''
            )
          }
          leading={<StatusBadge status={getStatusBadgeType(task.status)} dotOnly />}
          trailing={
            task.trades && <TradeBadge trade={task.trades.trade_type as any} />
          }
          onClick={() => onTaskClick(task.id)}
        />
      ))}
    </div>
  );
};