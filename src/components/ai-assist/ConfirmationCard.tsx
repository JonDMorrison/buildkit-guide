import { CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ActionSuggestion } from '@/hooks/useAiAssist';

interface ConfirmationCardProps {
  action: ActionSuggestion;
  onConfirm: (confirmationId: string, entityType: string, entityData: Record<string, unknown>) => void;
  onCancel: () => void;
}

const ENTITY_LABELS: Record<string, string> = {
  task: 'Task',
  deficiency: 'Deficiency',
  project: 'Project',
  manpower_request: 'Manpower Request',
};

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  due_date: 'Due Date',
  location: 'Location',
  priority: 'Priority',
  name: 'Name',
  start_date: 'Start Date',
  end_date: 'End Date',
  job_type: 'Job Type',
  trade_name: 'Trade',
  requested_count: 'Workers Needed',
  required_date: 'Required Date',
  reason: 'Reason',
  duration_days: 'Duration (days)',
};

export const ConfirmationCard = ({ action, onConfirm, onCancel }: ConfirmationCardProps) => {
  if (!action.entity_type || !action.entity_data || !action.confirmation_id) return null;

  const entityLabel = ENTITY_LABELS[action.entity_type] || action.entity_type;

  return (
    <div className="border border-amber-500/30 bg-amber-500/5 rounded-xl p-3 space-y-2.5 text-sm">
      <div className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
        <CheckCircle2 className="h-4 w-4" />
        Create {entityLabel}
      </div>
      <div className="space-y-1">
        {Object.entries(action.entity_data).map(([key, value]) => {
          if (value == null || value === '') return null;
          const label = FIELD_LABELS[key] || key;
          return (
            <div key={key} className="flex gap-2 text-xs">
              <span className="text-muted-foreground min-w-[96px]">{label}:</span>
              <span className="text-foreground font-medium">{String(value)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
          onClick={() => onConfirm(action.confirmation_id!, action.entity_type!, action.entity_data!)}
        >
          Confirm &amp; Create
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground"
          onClick={onCancel}
        >
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
};
