import { format, parseISO } from 'date-fns';
import { Clock, MapPin, AlertTriangle, Calendar, User, FileText, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { TimeEntry } from '@/hooks/useRecentTimeEntries';

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

  const getStatusBadge = () => {
    if (entry.status === 'open') {
      return <Badge className="bg-primary/20 text-primary">Active</Badge>;
    }
    if (entry.is_flagged) {
      return <Badge variant="destructive">Flagged</Badge>;
    }
    if (entry.closed_method === 'adjusted') {
      return <Badge variant="secondary">Adjusted</Badge>;
    }
    return <Badge variant="secondary">Closed</Badge>;
  };

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
            {getStatusBadge()}
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

          {/* Flags */}
          {entry.is_flagged && entry.flag_reason && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Flagged</span>
                </div>
                <p className="text-sm text-muted-foreground">{entry.flag_reason}</p>
              </div>
            </>
          )}

          {/* Closure Method */}
          {entry.closed_method && entry.closed_method !== 'self' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Closed By</span>
              </div>
              <p className="text-sm capitalize">
                {entry.closed_method.replace('_', ' ')}
              </p>
            </div>
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
            <AlertTriangle className="h-4 w-4 mr-2" />
            Something wrong? Request adjustment
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
