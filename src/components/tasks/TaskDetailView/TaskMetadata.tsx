import { TaskDetailData } from './index';
import { TradeBadge } from '@/components/TradeBadge';
import { Calendar, Users, Clock, Building2 } from 'lucide-react';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns';

interface TaskMetadataProps {
  task: TaskDetailData;
  trade?: { id: string; name: string; trade_type: string; company_name: string | null } | null;
}

const MetadataCard = ({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  variant = 'default',
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string; 
  subValue?: string;
  variant?: 'default' | 'warning' | 'success';
}) => {
  const variants = {
    default: 'bg-muted/50',
    warning: 'bg-amber-500/10 border border-amber-500/20',
    success: 'bg-emerald-500/10 border border-emerald-500/20',
  };

  return (
    <div className={`rounded-lg p-3 ${variants[variant]}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-semibold text-sm truncate">{value}</p>
      {subValue && (
        <p className="text-xs text-muted-foreground truncate">{subValue}</p>
      )}
    </div>
  );
};

export const TaskMetadata = ({ task, trade }: TaskMetadataProps) => {
  // Format due date with relative context
  const formatDueDate = () => {
    if (!task.end_date && !task.due_date) return { value: 'Not set', subValue: undefined, variant: 'default' as const };
    
    const dueDate = new Date(task.end_date || task.due_date!);
    const formatted = format(dueDate, 'MMM d');
    
    if (isToday(dueDate)) {
      return { value: formatted, subValue: 'Today', variant: 'warning' as const };
    }
    if (isTomorrow(dueDate)) {
      return { value: formatted, subValue: 'Tomorrow', variant: 'warning' as const };
    }
    if (isPast(dueDate) && task.status !== 'done') {
      return { value: formatted, subValue: 'Overdue', variant: 'warning' as const };
    }
    
    return { 
      value: formatted, 
      subValue: formatDistanceToNow(dueDate, { addSuffix: true }),
      variant: 'default' as const,
    };
  };

  // Format start date
  const formatStartDate = () => {
    if (!task.start_date) return 'Not set';
    return format(new Date(task.start_date), 'MMM d');
  };

  // Format budget hours — planned_hours is canonical, estimated_hours is legacy fallback
  const formatEstimate = () => {
    const hours = task.planned_hours ?? task.estimated_hours;
    if (!hours) return 'Not set';
    return `${hours}h`;
  };

  const dueDateInfo = formatDueDate();

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Due Date */}
      <MetadataCard
        icon={Calendar}
        label="Due"
        value={dueDateInfo.value}
        subValue={dueDateInfo.subValue}
        variant={dueDateInfo.variant}
      />

      {/* Trade */}
      <div className="rounded-lg p-3 bg-muted/50">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
          <Users className="h-3.5 w-3.5" />
          <span className="text-xs font-medium uppercase tracking-wide">Trade</span>
        </div>
        {trade ? (
          <>
            <div className="mb-0.5">
              <TradeBadge trade={trade.trade_type} />
            </div>
            {trade.company_name && (
              <p className="text-xs text-muted-foreground truncate">{trade.company_name}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Not assigned</p>
        )}
      </div>

      {/* Estimate */}
      <MetadataCard
        icon={Clock}
        label="Budget"
        value={formatEstimate()}
        subValue={task.start_date ? `Start: ${formatStartDate()}` : undefined}
      />
    </div>
  );
};
