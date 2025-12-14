import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TimeEntry } from '@/hooks/useRecentTimeEntries';
import { parseISO, isToday, startOfWeek, isAfter, isBefore, endOfWeek } from 'date-fns';

interface TimeTrackingSummaryProps {
  entries: TimeEntry[];
  isLoading: boolean;
}

export function TimeTrackingSummary({ entries, isLoading }: TimeTrackingSummaryProps) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // Calculate today's hours
  const todayEntries = entries.filter((entry) => {
    const checkIn = parseISO(entry.check_in_at);
    return isToday(checkIn) && entry.status !== 'open';
  });

  const todayMinutes = todayEntries.reduce((total, entry) => {
    const hours = entry.duration_hours || 0;
    const mins = entry.duration_minutes || 0;
    return total + hours * 60 + mins;
  }, 0);

  // Calculate this week's hours
  const weekEntries = entries.filter((entry) => {
    const checkIn = parseISO(entry.check_in_at);
    return (
      isAfter(checkIn, weekStart) &&
      isBefore(checkIn, weekEnd) &&
      entry.status !== 'open'
    );
  });

  const weekMinutes = weekEntries.reduce((total, entry) => {
    const hours = entry.duration_hours || 0;
    const mins = entry.duration_minutes || 0;
    return total + hours * 60 + mins;
  }, 0);

  const formatMinutes = (totalMins: number) => {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h}h ${m}m`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-8 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-8 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatMinutes(todayMinutes)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatMinutes(weekMinutes)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
