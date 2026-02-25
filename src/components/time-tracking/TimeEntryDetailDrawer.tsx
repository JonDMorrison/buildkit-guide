import { format, parseISO } from 'date-fns';
import { Clock, MapPin, Calendar, User, FileText, X, AlertTriangle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TimeEntry } from '@/hooks/useRecentTimeEntries';
import { EntryStatusIndicator, getEntryIndicators, INDICATOR_CONFIG, EntryIndicatorType } from './EntryStatusIndicator';

// Map flag codes to suggested request types
type RequestType = 'missed_check_in' | 'missed_check_out' | 'change_times' | 'change_job_site' | 'add_note' | 'add_manual_entry';

export function getSuggestedRequestType(flagReason: string | null | undefined): RequestType | null {
  if (!flagReason) return null;
  
  const codes = flagReason.toLowerCase().split(',').map(s => s.trim());
  
  // Location-related flags → suggest changing job site
  if (codes.some(c => 
    c.includes('location') || 
    c.includes('geofence') || 
    c.includes('gps') || 
    c.includes('job_site') ||
    c === 'missing_job_site' ||
    c === 'location_unverified'
  )) {
    return 'change_job_site';
  }
  
  // Time-related flags → suggest changing times
  if (codes.some(c => 
    c.includes('auto_closed') || 
    c.includes('force') || 
    c.includes('long_shift') ||
    c.includes('duration')
  )) {
    return 'change_times';
  }
  
  return null;
}

// Get contextual guidance based on flag type
function getContextualGuidance(flagReason: string | null | undefined): { title: string; description: string; action: string } | null {
  if (!flagReason) return null;
  
  const codes = flagReason.toLowerCase().split(',').map(s => s.trim());
  
  if (codes.some(c => c.includes('location_unverified') || c.includes('geofence'))) {
    return {
      title: 'Location couldn\'t be verified',
      description: 'Your check-in location couldn\'t be matched to a known job site. This usually happens when GPS is unavailable or you\'re at a new location.',
      action: 'Assign the correct job site to fix this.',
    };
  }
  
  if (codes.some(c => c === 'missing_job_site' || c.includes('no_job_site'))) {
    return {
      title: 'No job site assigned',
      description: 'This entry doesn\'t have a job site selected. Job sites help track where work was performed.',
      action: 'Select the job site where you worked.',
    };
  }
  
  if (codes.some(c => c.includes('auto_closed'))) {
    return {
      title: 'Automatically checked out',
      description: 'The system closed this entry because you didn\'t check out manually. The recorded time may not be accurate.',
      action: 'If the time is wrong, request a correction.',
    };
  }
  
  if (codes.some(c => c.includes('force') || c.includes('force_checkout'))) {
    return {
      title: 'Closed by supervisor',
      description: 'A supervisor closed this entry. The end time may have been adjusted.',
      action: 'If you disagree with the time, request a review.',
    };
  }
  
  if (codes.some(c => c.includes('long_shift') || c.includes('duration'))) {
    return {
      title: 'Unusually long shift',
      description: 'This entry shows more hours than typical. Please verify the times are correct.',
      action: 'If something looks wrong, request a correction.',
    };
  }
  
  if (codes.some(c => c.includes('gps_accuracy'))) {
    return {
      title: 'GPS accuracy was low',
      description: 'Your location couldn\'t be precisely determined at check-in. This might affect job site verification.',
      action: 'If the job site is wrong, request a correction.',
    };
  }
  
  return {
    title: 'This entry needs review',
    description: 'There\'s an issue with this time entry that requires attention.',
    action: 'Request a correction to resolve this.',
  };
}

// Convert raw flag codes to human-readable text
function formatFlagReason(flagReason: string): string {
  const codes = flagReason.split(',').map(s => s.trim());
  const labels = codes
    .map(code => {
      const config = INDICATOR_CONFIG[code as EntryIndicatorType];
      return config?.description || null;
    })
    .filter(Boolean);
  
  return labels.length > 0 ? labels.join('. ') : flagReason;
}

interface TimeEntryDetailDrawerProps {
  entry: TimeEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestAdjustment: (entry: TimeEntry, suggestedType?: RequestType | null) => void;
}

export function TimeEntryDetailDrawer({
  entry,
  open,
  onOpenChange,
  onRequestAdjustment,
}: TimeEntryDetailDrawerProps) {
  if (!entry) return null;

  const formatDuration = (hours: number | null, minutes: number | null) => {
    if (hours === null && minutes === null) return '—';
    const totalMinutes = ((hours || 0) * 60) + (minutes || 0);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const indicators = getEntryIndicators(entry);
  const suggestedRequestType = getSuggestedRequestType(entry.flag_reason);
  const contextualGuidance = getContextualGuidance(entry.flag_reason);

  // Human-readable closure explanation
  const getClosureExplanation = () => {
    if (entry.status === 'open') {
      return 'Timer is currently running';
    }
    switch (entry.closed_method) {
      case 'auto_closed':
        return 'You were automatically checked out by the system';
      case 'force_closed':
        return 'A supervisor closed this entry';
      case 'adjusted':
      case 'manual_adjustment':
        return 'This entry was manually adjusted';
      case 'self':
        return 'You checked out normally';
      default:
        return null;
    }
  };

  const closureExplanation = getClosureExplanation();

  const handleRequestCorrection = () => {
    onRequestAdjustment(entry, suggestedRequestType);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <SheetTitle>Time Entry Details</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <SheetDescription>
            {format(parseISO(entry.check_in_at), 'EEEE, MMMM d, yyyy')}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-6">
            {/* Status & Duration */}
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {entry.status === 'open' ? (
                  <EntryStatusIndicator type="normal" />
                ) : indicators.length > 0 ? (
                  indicators.map((indicator, index) => (
                    <EntryStatusIndicator key={index} type={indicator} />
                  ))
                ) : (
                  <EntryStatusIndicator type="normal" />
                )}
              </div>
              <span className="text-2xl font-bold tabular-nums">
                {formatDuration(entry.duration_hours, entry.duration_minutes)}
              </span>
            </div>

            <Separator />

            {/* Project */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>Project</span>
              </div>
              <p className="font-medium">{entry.project_name || 'Unknown Project'}</p>
            </div>

            {/* Job Site */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Job Site</span>
              </div>
              <p className="font-medium">
                {entry.job_site_name || (
                  <span className="text-muted-foreground italic">No job site selected</span>
                )}
              </p>
            </div>

            {/* Time Range */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Time</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check In:</span>
                  <span className="font-medium">
                    {format(parseISO(entry.check_in_at), 'h:mm a')}
                  </span>
                </div>
                {entry.check_out_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check Out:</span>
                    <span className="font-medium">
                      {format(parseISO(entry.check_out_at), 'h:mm a')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Closure Explanation */}
            {closureExplanation && entry.status !== 'open' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>How it was closed</span>
                </div>
                <p className="text-sm">{closureExplanation}</p>
              </div>
            )}

            {/* Flag Reason - Enhanced with contextual guidance and inline action */}
            {entry.is_flagged && entry.flag_reason && contextualGuidance && (
              <>
                <Separator />
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-700">
                        {contextualGuidance.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {contextualGuidance.description}
                      </p>
                      <p className="text-sm text-foreground font-medium">
                        {contextualGuidance.action}
                      </p>
                    </div>
                  </div>
                  
                  {/* Inline action button - primary action for flagged entries */}
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={handleRequestCorrection}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {suggestedRequestType === 'change_job_site' 
                      ? 'Assign Job Site' 
                      : suggestedRequestType === 'change_times'
                      ? 'Fix Times'
                      : 'Request Correction'}
                  </Button>
                </div>
              </>
            )}

            <Separator />

            {/* General Action Button - always visible at bottom */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleRequestCorrection}
            >
              Something else wrong? Request correction
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
