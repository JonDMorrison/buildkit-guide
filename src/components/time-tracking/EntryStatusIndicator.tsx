import {
  Check,
  AlertTriangle,
  Clock,
  Edit,
  MapPinOff,
  RefreshCw,
  Lock,
  Radio,
  Crosshair,
  Copy,
  Layers,
  FileX,
  Timer,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Extended type to include all persisted flag codes
export type EntryIndicatorType =
  | 'normal'
  | 'manual'
  | 'auto_closed'
  | 'location_unverified'
  | 'gps_accuracy_low'
  | 'geofence_not_verified'
  | 'offline_sync'
  | 'offline_queued'
  | 'duplicate_tap_prevented'
  | 'manual_time_added'
  | 'edited_after_submission'
  | 'overlapping_entry_attempt'
  | 'missing_job_site'
  | 'long_shift'
  | 'force_checkout'
  | 'flagged';

interface EntryStatusIndicatorProps {
  type: EntryIndicatorType;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export const INDICATOR_CONFIG: Record<
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
  gps_accuracy_low: {
    icon: Crosshair,
    label: 'Low GPS Accuracy',
    description: 'GPS accuracy was poor during check-in',
    className: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  },
  geofence_not_verified: {
    icon: Radio,
    label: 'Geofence Not Verified',
    description: 'Could not verify location against job site boundary',
    className: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  },
  offline_sync: {
    icon: RefreshCw,
    label: 'Offline Sync',
    description: 'Entry was recorded offline and synced later',
    className: 'text-blue-600 bg-blue-500/10 border-blue-500/20',
  },
  offline_queued: {
    icon: RefreshCw,
    label: 'Queued',
    description: 'Pending sync when online',
    className: 'text-blue-600 bg-blue-500/10 border-blue-500/20 animate-pulse',
  },
  duplicate_tap_prevented: {
    icon: Copy,
    label: 'Duplicate Prevented',
    description: 'A duplicate check-in attempt was blocked',
    className: 'text-muted-foreground bg-muted/10 border-muted/20',
  },
  manual_time_added: {
    icon: Edit,
    label: 'Manual Entry',
    description: 'Time was added manually by supervisor',
    className: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  },
  edited_after_submission: {
    icon: Lock,
    label: 'Post-Submit Edit',
    description: 'Entry was edited after timesheet submission',
    className: 'text-destructive bg-destructive/10 border-destructive/20',
  },
  overlapping_entry_attempt: {
    icon: Layers,
    label: 'Overlap Blocked',
    description: 'An overlapping entry was attempted',
    className: 'text-destructive bg-destructive/10 border-destructive/20',
  },
  missing_job_site: {
    icon: FileX,
    label: 'No Job Site',
    description: 'Entry is missing job site assignment',
    className: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  },
  long_shift: {
    icon: Timer,
    label: 'Long Shift',
    description: 'Shift exceeded normal duration',
    className: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  },
  force_checkout: {
    icon: Clock,
    label: 'Force Closed',
    description: 'Entry was closed by a supervisor',
    className: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
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
  if (!config) return null;
  
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

// Map DB flag codes to indicator types
export function mapFlagCodeToIndicator(flagCode: string): EntryIndicatorType | null {
  const mapping: Record<string, EntryIndicatorType> = {
    location_unverified: 'location_unverified',
    gps_accuracy_low: 'gps_accuracy_low',
    geofence_not_verified: 'geofence_not_verified',
    offline_sync: 'offline_sync',
    offline_queued: 'offline_queued',
    duplicate_tap_prevented: 'duplicate_tap_prevented',
    manual_time_added: 'manual_time_added',
    auto_closed: 'auto_closed',
    edited_after_submission: 'edited_after_submission',
    overlapping_entry_attempt: 'overlapping_entry_attempt',
    missing_job_site: 'missing_job_site',
    long_shift: 'long_shift',
    force_checkout: 'force_checkout',
    checkout_location_missing: 'location_unverified',
  };
  return mapping[flagCode] || null;
}

// Get indicators from persisted flags (preferred) or fallback to entry data
export function getEntryIndicators(
  entry: {
    status?: string;
    is_flagged?: boolean;
    closed_method?: string | null;
    source?: string;
    flag_reason?: string | null;
  },
  persistedFlags?: string[]
): EntryIndicatorType[] {
  const indicators: EntryIndicatorType[] = [];

  // Prefer persisted flags from DB
  if (persistedFlags && persistedFlags.length > 0) {
    for (const code of persistedFlags) {
      const indicator = mapFlagCodeToIndicator(code);
      if (indicator && !indicators.includes(indicator)) {
        indicators.push(indicator);
      }
    }
  }

  // Fallback to entry-level data if no persisted flags
  if (indicators.length === 0) {
    if (entry.closed_method === 'auto_closed' || entry.closed_method === 'force_closed' || entry.closed_method === 'force') {
      indicators.push('auto_closed');
    }
    if (entry.closed_method === 'adjusted' || entry.closed_method === 'manual_adjustment' || entry.source === 'manual_adjustment') {
      indicators.push('manual');
    }
    if (entry.source === 'offline_sync') {
      indicators.push('offline_sync');
    }
    if (entry.flag_reason?.toLowerCase().includes('location') || entry.flag_reason?.toLowerCase().includes('geofence') || entry.flag_reason?.toLowerCase().includes('gps')) {
      indicators.push('location_unverified');
    }
    if (entry.flag_reason?.toLowerCase().includes('after submission')) {
      indicators.push('edited_after_submission');
    }
    if (entry.is_flagged && indicators.length === 0) {
      indicators.push('flagged');
    }
  }

  // If still nothing and entry is closed, mark as normal
  if (indicators.length === 0 && entry.status === 'closed') {
    indicators.push('normal');
  }

  return indicators;
}
