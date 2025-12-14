import { useState, useEffect } from 'react';
import { Clock, MapPin, AlertTriangle, Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActiveTimeEntry } from '@/hooks/useActiveTimeEntry';
import { format, differenceInSeconds } from 'date-fns';

interface ActiveTimerCardProps {
  entry: ActiveTimeEntry;
}

export function ActiveTimerCard({ entry }: ActiveTimerCardProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const checkInTime = new Date(entry.check_in_at);
    
    const updateElapsed = () => {
      const now = new Date();
      setElapsed(differenceInSeconds(now, checkInTime));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [entry.check_in_at]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  const formatTime = (h: number, m: number, s: number) => {
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    return `${m}m ${s}s`;
  };

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Play className="h-4 w-4 text-primary" />
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full animate-pulse" />
              </div>
              <span className="text-sm font-medium text-primary">Clocked In</span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">
                {entry.job_site_name || 'No job site selected'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">
                Started at {format(new Date(entry.check_in_at), 'h:mm a')}
              </span>
            </div>

            {entry.is_flagged && (
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Flagged
                </Badge>
                {entry.flag_reason && (
                  <span className="text-xs text-destructive">
                    {entry.flag_reason}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="text-right">
            <div className="text-3xl font-bold text-primary tabular-nums">
              {formatTime(hours, minutes, seconds)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {entry.project_name}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
