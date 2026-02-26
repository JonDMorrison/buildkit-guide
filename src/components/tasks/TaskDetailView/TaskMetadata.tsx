import { useState } from 'react';
import { TaskDetailData } from './index';
import { TradeBadge } from '@/components/TradeBadge';
import { Calendar, Users, Clock, Save, X, Check } from 'lucide-react';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';

interface TaskMetadataProps {
  task: TaskDetailData;
  trade?: { id: string; name: string; trade_type: string; company_name: string | null } | null;
  trades?: { id: string; name: string; trade_type: string }[];
  canEditDates?: boolean;
  canEditTrade?: boolean;
  canEditHours?: boolean;
  onUpdate?: (updates: Partial<TaskDetailData>) => void;
}

const MetadataCard = ({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  variant = 'default',
  onClick,
  editable,
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string; 
  subValue?: string;
  variant?: 'default' | 'warning' | 'success';
  onClick?: () => void;
  editable?: boolean;
}) => {
  const variants = {
    default: 'bg-muted/50',
    warning: 'bg-amber-500/10 border border-amber-500/20',
    success: 'bg-emerald-500/10 border border-emerald-500/20',
  };

  return (
    <div
      className={`rounded-lg p-3 ${variants[variant]} ${editable ? 'cursor-pointer hover:bg-muted/70 transition-colors' : ''}`}
      onClick={onClick}
    >
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

export const TaskMetadata = ({ task, trade, trades = [], canEditDates, canEditTrade, canEditHours, onUpdate }: TaskMetadataProps) => {
  const { toast } = useToast();
  const [editingField, setEditingField] = useState<'due' | 'trade' | 'budget' | null>(null);
  const [saving, setSaving] = useState(false);

  // Local edit states
  const [localDueDate, setLocalDueDate] = useState<Date | undefined>(
    task.end_date || task.due_date ? new Date(task.end_date || task.due_date!) : undefined
  );
  const [localTradeId, setLocalTradeId] = useState<string>(task.assigned_trade_id || '');
  const [localHours, setLocalHours] = useState<string>(
    String(task.planned_hours ?? task.estimated_hours ?? '')
  );

  const saveField = async (field: 'due' | 'trade' | 'budget') => {
    setSaving(true);
    try {
      let updatePayload: Record<string, any> = {};
      let localUpdates: Partial<TaskDetailData> = {};

      if (field === 'due') {
        const dateStr = localDueDate ? localDueDate.toISOString().split('T')[0] : null;
        updatePayload = { end_date: dateStr };
        localUpdates = { end_date: dateStr };
      } else if (field === 'trade') {
        const tradeId = localTradeId && localTradeId !== '__none__' ? localTradeId : null;
        updatePayload = { assigned_trade_id: tradeId };
        localUpdates = { assigned_trade_id: tradeId };
      } else if (field === 'budget') {
        const hours = localHours ? parseFloat(localHours) : null;
        updatePayload = { planned_hours: hours };
        localUpdates = { planned_hours: hours };
      }

      const { error } = await supabase
        .from('tasks')
        .update(updatePayload)
        .eq('id', task.id);

      if (error) throw error;

      onUpdate?.(localUpdates);
      setEditingField(null);
      toast({ title: `${field === 'due' ? 'Due date' : field === 'trade' ? 'Trade' : 'Budget'} updated` });
    } catch (err: any) {
      toast({ title: 'Error saving', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    // Reset local states
    setLocalDueDate(task.end_date || task.due_date ? new Date(task.end_date || task.due_date!) : undefined);
    setLocalTradeId(task.assigned_trade_id || '');
    setLocalHours(String(task.planned_hours ?? task.estimated_hours ?? ''));
    setEditingField(null);
  };

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

  const formatStartDate = () => {
    if (!task.start_date) return 'Not set';
    return format(new Date(task.start_date), 'MMM d');
  };

  const formatEstimate = () => {
    const hours = task.planned_hours ?? task.estimated_hours;
    if (!hours) return 'Not set';
    return `${hours}h`;
  };

  const dueDateInfo = formatDueDate();

  // Inline edit save/cancel buttons
  const EditActions = ({ field }: { field: 'due' | 'trade' | 'budget' }) => (
    <div className="flex gap-1 mt-2">
      <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-7 px-2" disabled={saving}>
        <X className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" onClick={() => saveField(field)} disabled={saving} className="h-7 px-2">
        <Check className="h-3.5 w-3.5 mr-1" />
        Save
      </Button>
    </div>
  );

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Due Date */}
      {editingField === 'due' ? (
        <div className="rounded-lg p-3 bg-muted/50 border-2 border-primary/30">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wide">Due</span>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start">
                {localDueDate ? format(localDueDate, 'MMM d, yyyy') : 'Pick date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={localDueDate}
                onSelect={setLocalDueDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <EditActions field="due" />
        </div>
      ) : (
        <MetadataCard
          icon={Calendar}
          label="Due"
          value={dueDateInfo.value}
          subValue={dueDateInfo.subValue}
          variant={dueDateInfo.variant}
          editable={!!canEditDates}
          onClick={() => { if (canEditDates) setEditingField('due'); }}
        />
      )}

      {/* Trade */}
      {editingField === 'trade' ? (
        <div className="rounded-lg p-3 bg-muted/50 border-2 border-primary/30">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Users className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wide">Trade</span>
          </div>
          <Select value={localTradeId} onValueChange={setLocalTradeId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select trade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No trade</SelectItem>
              {trades.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <EditActions field="trade" />
        </div>
      ) : (
        <div
          className={`rounded-lg p-3 bg-muted/50 ${canEditTrade ? 'cursor-pointer hover:bg-muted/70 transition-colors' : ''}`}
          onClick={() => { if (canEditTrade) setEditingField('trade'); }}
        >
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
      )}

      {/* Budget */}
      {editingField === 'budget' ? (
        <div className="rounded-lg p-3 bg-muted/50 border-2 border-primary/30">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wide">Budget</span>
          </div>
          <Input
            type="number"
            value={localHours}
            onChange={(e) => setLocalHours(e.target.value)}
            placeholder="Hours"
            className="h-8 text-xs"
            min={0}
            step={0.5}
            autoFocus
          />
          <EditActions field="budget" />
        </div>
      ) : (
        <MetadataCard
          icon={Clock}
          label="Budget"
          value={formatEstimate()}
          subValue={task.start_date ? `Start: ${formatStartDate()}` : undefined}
          editable={!!canEditHours}
          onClick={() => { if (canEditHours) setEditingField('budget'); }}
        />
      )}
    </div>
  );
};
