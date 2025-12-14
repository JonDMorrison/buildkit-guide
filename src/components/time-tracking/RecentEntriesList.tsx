import { Clock, MapPin, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TimeEntry } from '@/hooks/useRecentTimeEntries';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { EntryStatusIndicator, getEntryIndicators } from './EntryStatusIndicator';

interface RecentEntriesListProps {
  entries: TimeEntry[];
  isLoading: boolean;
  onEntryClick?: (entry: TimeEntry) => void;
  onRequestAdjustment?: (entry: TimeEntry) => void;
}

function formatDuration(hours: number | null, minutes: number | null) {
  if (hours === null && minutes === null) return '—';
  const h = hours || 0;
  const m = minutes || 0;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function RecentEntriesList({
  entries,
  isLoading,
  onEntryClick,
  onRequestAdjustment,
}: RecentEntriesListProps) {
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
              Tap Check In above to start tracking your time
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
              {dayEntries.map((entry) => {
                const indicators = getEntryIndicators(entry);
                
                return (
                  <div
                    key={entry.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border bg-card transition-colors ${
                      onEntryClick ? 'hover:bg-muted/50 cursor-pointer' : ''
                    }`}
                    onClick={() => onEntryClick?.(entry)}
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                          {entry.project_name || 'Unknown Project'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">
                          {entry.job_site_name || 'No job site'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <span>
                          {format(parseISO(entry.check_in_at), 'h:mm a')}
                          {entry.check_out_at && (
                            <> – {format(parseISO(entry.check_out_at), 'h:mm a')}</>
                          )}
                        </span>
                      </div>

                      {/* Status indicators */}
                      {indicators.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {indicators.map((indicator, index) => (
                            <EntryStatusIndicator key={index} type={indicator} size="sm" />
                          ))}
                        </div>
                      )}

                      {/* Something wrong? link */}
                      {onRequestAdjustment && entry.status !== 'open' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequestAdjustment(entry);
                          }}
                        >
                          <HelpCircle className="h-3 w-3 mr-1" />
                          Something wrong?
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="text-lg font-bold tabular-nums">
                        {formatDuration(entry.duration_hours, entry.duration_minutes)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
