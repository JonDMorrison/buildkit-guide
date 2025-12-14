import { Clock, MapPin, AlertTriangle, Check, XCircle, Timer, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TimeEntry } from '@/hooks/useRecentTimeEntries';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface RecentEntriesListProps {
  entries: TimeEntry[];
  isLoading: boolean;
}

function getStatusBadge(entry: TimeEntry) {
  if (entry.status === 'open') {
    return (
      <Badge variant="default" className="bg-primary/20 text-primary border-primary/30">
        <Timer className="h-3 w-3 mr-1" />
        Active
      </Badge>
    );
  }

  if (entry.closed_method === 'force_closed' || entry.closed_method === 'auto_closed') {
    return (
      <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30">
        <XCircle className="h-3 w-3 mr-1" />
        {entry.closed_method === 'force_closed' ? 'Force Closed' : 'Auto Closed'}
      </Badge>
    );
  }

  if (entry.closed_method === 'adjusted') {
    return (
      <Badge variant="secondary" className="bg-muted text-muted-foreground">
        <Edit className="h-3 w-3 mr-1" />
        Adjusted
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="bg-muted text-muted-foreground">
      <Check className="h-3 w-3 mr-1" />
      Closed
    </Badge>
  );
}

function formatDuration(hours: number | null, minutes: number | null) {
  if (hours === null && minutes === null) return '—';
  const h = hours || 0;
  const m = minutes || 0;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function RecentEntriesList({ entries, isLoading }: RecentEntriesListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No time entries yet</h3>
            <p className="text-muted-foreground text-sm">
              Tap Check In above to start tracking your time.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group entries by date
  const groupedEntries = entries.reduce((groups, entry) => {
    const date = format(parseISO(entry.check_in_at), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(entry);
    return groups;
  }, {} as Record<string, TimeEntry[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Entries</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedEntries).map(([date, dayEntries]) => (
          <div key={date}>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              {format(parseISO(date), 'EEEE, MMMM d')}
            </h4>
            <div className="space-y-3">
              {dayEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {entry.project_name || 'Unknown Project'}
                      </span>
                      {entry.is_flagged && (
                        <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">
                        {entry.job_site_name || 'No job site'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {format(parseISO(entry.check_in_at), 'h:mm a')}
                        {entry.check_out_at && (
                          <> – {format(parseISO(entry.check_out_at), 'h:mm a')}</>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="text-lg font-bold tabular-nums">
                      {formatDuration(entry.duration_hours, entry.duration_minutes)}
                    </span>
                    {getStatusBadge(entry)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
