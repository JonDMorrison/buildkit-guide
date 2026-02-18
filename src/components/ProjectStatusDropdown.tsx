import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
  { value: 'deleted', label: 'Deleted' },
] as const;

const STATUS_STYLES: Record<string, string> = {
  not_started: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/15 text-primary',
  completed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  archived: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  deleted: 'bg-destructive/15 text-destructive',
};

interface ProjectStatusDropdownProps {
  projectId: string;
  status: string;
  canEdit: boolean;
  onStatusChanged: (newStatus: string) => void;
}

export function ProjectStatusDropdown({
  projectId,
  status,
  canEdit,
  onStatusChanged,
}: ProjectStatusDropdownProps) {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);

  const currentLabel = STATUS_OPTIONS.find(o => o.value === status)?.label ?? status;
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.not_started;

  if (!canEdit) {
    return (
      <Badge variant="secondary" className={cn('text-xs font-medium', style)}>
        {currentLabel}
      </Badge>
    );
  }

  const handleChange = async (newStatus: string) => {
    if (newStatus === status) return;
    setUpdating(true);
    try {
      const { error } = await supabase.rpc('rpc_update_project_status', {
        p_project_id: projectId,
        p_status: newStatus,
      });
      if (error) throw error;
      onStatusChanged(newStatus);
      toast({ title: 'Status updated', description: `Project status set to ${newStatus.replace(/_/g, ' ')}.` });
    } catch (err: any) {
      toast({ title: 'Failed to update status', description: err.message, variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="relative">
      {updating && (
        <Loader2 className="absolute -left-5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
      <Select value={status} onValueChange={handleChange} disabled={updating}>
        <SelectTrigger className={cn('h-7 w-auto min-w-[120px] text-xs font-medium border-0 gap-1.5', style)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-popover z-50">
          {STATUS_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              <span className={cn('inline-block rounded-full h-2 w-2 mr-2', STATUS_STYLES[opt.value]?.split(' ')[0])} />
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
