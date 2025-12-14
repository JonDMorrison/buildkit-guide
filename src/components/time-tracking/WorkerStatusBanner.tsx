import { format, parseISO } from 'date-fns';
import {
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type WorkerState =
  | 'checked_in'
  | 'checked_out'
  | 'auto_checked_out'
  | 'timesheet_submitted'
  | 'timesheet_approved'
  | 'timesheet_locked';

interface WorkerStatusBannerProps {
  state: WorkerState;
  className?: string;
  // For checked_in state
  checkInTime?: string;
  jobSiteName?: string;
  // For auto_checked_out state
  autoCheckOutTime?: string;
  onRequestCorrection?: () => void;
  // For timesheet states
  periodStart?: string;
  periodEnd?: string;
}

const STATE_CONFIG: Record<
  WorkerState,
  {
    icon: typeof Clock;
    title: string;
    variant: 'default' | 'destructive';
    className: string;
  }
> = {
  checked_in: {
    icon: Clock,
    title: 'Clocked In',
    variant: 'default',
    className: 'border-primary/30 bg-primary/5 [&>svg]:text-primary',
  },
  checked_out: {
    icon: CheckCircle,
    title: 'Clocked Out',
    variant: 'default',
    className: 'border-muted-foreground/30 bg-muted/50 [&>svg]:text-muted-foreground',
  },
  auto_checked_out: {
    icon: XCircle,
    title: 'Auto-Checked Out',
    variant: 'default',
    className: 'border-amber-500/30 bg-amber-500/5 [&>svg]:text-amber-600',
  },
  timesheet_submitted: {
    icon: FileText,
    title: 'Timesheet Submitted',
    variant: 'default',
    className: 'border-blue-500/30 bg-blue-500/5 [&>svg]:text-blue-600',
  },
  timesheet_approved: {
    icon: CheckCircle,
    title: 'Timesheet Approved',
    variant: 'default',
    className: 'border-primary/30 bg-primary/5 [&>svg]:text-primary',
  },
  timesheet_locked: {
    icon: Lock,
    title: 'Payroll Ready',
    variant: 'default',
    className: 'border-muted-foreground/30 bg-muted/50 [&>svg]:text-muted-foreground',
  },
};

export function WorkerStatusBanner({
  state,
  className,
  checkInTime,
  jobSiteName,
  autoCheckOutTime,
  onRequestCorrection,
  periodStart,
  periodEnd,
}: WorkerStatusBannerProps) {
  const config = STATE_CONFIG[state];
  const Icon = config.icon;

  const getDescription = () => {
    switch (state) {
      case 'checked_in':
        return (
          <span>
            Timer running since{' '}
            {checkInTime && format(parseISO(checkInTime), 'h:mm a')}
            {jobSiteName && ` at ${jobSiteName}`}
          </span>
        );
      case 'checked_out':
        return 'Your last shift has been recorded';
      case 'auto_checked_out':
        return (
          <div className="space-y-2">
            <span>
              You were automatically checked out
              {autoCheckOutTime &&
                ` at ${format(parseISO(autoCheckOutTime), 'h:mm a on MMM d')}`}
            </span>
            {onRequestCorrection && (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRequestCorrection}
                  className="mt-2"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Request Correction
                </Button>
              </div>
            )}
          </div>
        );
      case 'timesheet_submitted':
        return (
          <span>
            {periodStart && periodEnd && (
              <>
                {format(parseISO(periodStart), 'MMM d')} –{' '}
                {format(parseISO(periodEnd), 'MMM d')} is awaiting approval
              </>
            )}
          </span>
        );
      case 'timesheet_approved':
        return (
          <span>
            {periodStart && periodEnd && (
              <>
                {format(parseISO(periodStart), 'MMM d')} –{' '}
                {format(parseISO(periodEnd), 'MMM d')} has been approved
              </>
            )}
          </span>
        );
      case 'timesheet_locked':
        return (
          <span>
            {periodStart && periodEnd && (
              <>
                {format(parseISO(periodStart), 'MMM d')} –{' '}
                {format(parseISO(periodEnd), 'MMM d')} is locked for payroll
              </>
            )}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Alert variant={config.variant} className={cn(config.className, className)}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{config.title}</AlertTitle>
      <AlertDescription>{getDescription()}</AlertDescription>
    </Alert>
  );
}
