import { format, parseISO } from 'date-fns';
import { Clock, MapPin, Calendar, User, FileText, X, HelpCircle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { TimeEntry } from '@/hooks/useRecentTimeEntries';
import { EntryStatusIndicator, getEntryIndicators } from './EntryStatusIndicator';

interface TimeEntryDetailDrawerProps {
  entry: TimeEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestAdjustment: (entry: TimeEntry) => void;
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
    const h = hours || 0;
    const m = minutes || 0;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  const indicators = getEntryIndicators(entry);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
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

        <div className="mt-6 space-y-6">
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

          {/* Flag Reason - human-friendly */}
          {entry.is_flagged && entry.flag_reason && (
            <>
              <Separator />
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                <p className="text-sm font-medium text-amber-700">
                  This entry needs review
                </p>
                <p className="text-sm text-muted-foreground">{entry.flag_reason}</p>
                <p className="text-xs text-muted-foreground">
                  Don't worry — you can request a correction below if something's not right.
                </p>
              </div>
            </>
          )}

          <Separator />

          {/* Action Button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onRequestAdjustment(entry);
              onOpenChange(false);
            }}
          >
            <HelpCircle className="h-4 w-4 mr-2" />
            Something wrong? Request correction
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
