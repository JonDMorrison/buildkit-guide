import {
  Check,
  AlertTriangle,
  Clock,
  XCircle,
  Edit,
  Timer,
  MapPinOff,
  RefreshCw,
  Lock,
  LockOpen,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type EntryIndicatorType =
  | 'normal'
  | 'manual'
  | 'auto_closed'
  | 'location_unverified'
  | 'offline_sync'
  | 'edited_after_submission'
  | 'flagged';

interface EntryStatusIndicatorProps {
  type: EntryIndicatorType;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

const INDICATOR_CONFIG: Record<
  EntryIndicatorType,
  {
    icon: typeof Check;
    label: string;
    description: string;
    className: string;
  }
> = {
  normal: {
    icon: Check,
    label: 'Normal',
    description: 'Entry recorded normally',
    className: 'text-primary bg-primary/10 border-primary/20',
  },
  manual: {
    icon: Edit,
    label: 'Manual',
    description: 'Entry was manually adjusted or created',
    className: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  },
  auto_closed: {
    icon: Clock,
    label: 'Auto-Closed',
    description: 'System closed this entry automatically',
    className: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  },
  location_unverified: {
    icon: MapPinOff,
    label: 'Location Unverified',
    description: "Location couldn't be confirmed at check-in",
    className: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  },
  offline_sync: {
    icon: RefreshCw,
    label: 'Offline Sync',
    description: 'Entry was recorded offline and synced later',
    className: 'text-blue-600 bg-blue-500/10 border-blue-500/20',
  },
  edited_after_submission: {
    icon: Lock,
    label: 'Post-Submit Edit',
    description: 'Entry was edited after timesheet submission',
    className: 'text-destructive bg-destructive/10 border-destructive/20',
  },
  flagged: {
    icon: AlertTriangle,
    label: 'Needs Review',
    description: 'This entry requires supervisor review',
    className: 'text-destructive bg-destructive/10 border-destructive/20',
  },
};

export function EntryStatusIndicator({
  type,
  size = 'sm',
  showLabel = true,
  className,
}: EntryStatusIndicatorProps) {
  const config = INDICATOR_CONFIG[type];
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'gap-1 font-normal',
              config.className,
              size === 'sm' && 'text-xs py-0.5 px-1.5',
              className
            )}
          >
            <Icon className={iconSize} />
            {showLabel && <span>{config.label}</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Helper to get indicators from entry data
export function getEntryIndicators(entry: {
  status?: string;
  is_flagged?: boolean;
  closed_method?: string | null;
  source?: string;
  flag_reason?: string | null;
}): EntryIndicatorType[] {
  const indicators: EntryIndicatorType[] = [];

  // Check for auto-closed
  if (entry.closed_method === 'auto_closed' || entry.closed_method === 'force_closed') {
    indicators.push('auto_closed');
  }

  // Check for manual/adjusted
  if (
    entry.closed_method === 'adjusted' ||
    entry.closed_method === 'manual_adjustment' ||
    entry.source === 'manual'
  ) {
    indicators.push('manual');
  }

  // Check for offline sync
  if (entry.source === 'offline_sync') {
    indicators.push('offline_sync');
  }

  // Check for location issues
  if (
    entry.flag_reason?.toLowerCase().includes('location') ||
    entry.flag_reason?.toLowerCase().includes('geofence') ||
    entry.flag_reason?.toLowerCase().includes('gps')
  ) {
    indicators.push('location_unverified');
  }

  // Check for edited after submission
  if (entry.flag_reason?.toLowerCase().includes('after submission')) {
    indicators.push('edited_after_submission');
  }

  // Check for flagged
  if (entry.is_flagged && indicators.length === 0) {
    indicators.push('flagged');
  }

  // If nothing else, it's normal (only if closed)
  if (indicators.length === 0 && entry.status === 'closed') {
    indicators.push('normal');
  }

  return indicators;
}
