import { TaskDetailData } from './index';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  X, 
  MoreVertical, 
  Edit2, 
  Copy, 
  Link2, 
  Trash2,
  MapPin,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
} from 'lucide-react';

interface TaskHeaderProps {
  task: TaskDetailData;
  onStatusChange: (status: string) => void;
  onClose: () => void;
  editMode: boolean;
  onEditModeChange: (edit: boolean) => void;
  canEdit: boolean;
}

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', icon: Circle, color: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  blocked: { label: 'Blocked', icon: AlertTriangle, color: 'bg-destructive/10 text-destructive' },
  done: { label: 'Done', icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
};

const PRIORITY_CONFIG = {
  1: { label: 'Urgent', color: 'destructive' as const },
  2: { label: 'High', color: 'default' as const },
  3: { label: 'Normal', color: 'secondary' as const },
};

export const TaskHeader = ({
  task,
  onStatusChange,
  onClose,
  editMode,
  onEditModeChange,
  canEdit,
}: TaskHeaderProps) => {
  const statusConfig = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.not_started;
  const priorityConfig = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG[3];
  const StatusIcon = statusConfig.icon;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/tasks?taskId=${task.id}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 space-y-3">
      {/* Top Row: Title and Close */}
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold leading-tight line-clamp-2 flex-1">
          {task.title}
        </h2>
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditModeChange(!editMode)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  {editMode ? 'View Mode' : 'Edit Mode'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate Task
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bottom Row: Quick Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status Dropdown */}
        <Select value={task.status} onValueChange={onStatusChange}>
          <SelectTrigger className={`h-8 w-auto gap-1.5 px-2.5 text-xs font-medium ${statusConfig.color} border-0`}>
            <StatusIcon className="h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => {
              const Icon = config.icon;
              return (
                <SelectItem key={value} value={value}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {config.label}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Priority Badge */}
        <Badge variant={priorityConfig.color} className="text-xs">
          {priorityConfig.label}
        </Badge>

        {/* Location */}
        {task.location && (
          <Badge variant="outline" className="text-xs gap-1">
            <MapPin className="h-3 w-3" />
            {task.location}
          </Badge>
        )}

        {/* Review Requested Badge */}
        {task.review_requested_at && (
          <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400">
            Review Requested
          </Badge>
        )}
      </div>
    </div>
  );
};
