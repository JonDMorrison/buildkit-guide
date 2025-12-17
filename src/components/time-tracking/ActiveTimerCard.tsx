import { useState, useEffect } from 'react';
import { MapPin, AlertTriangle, Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActiveTimeEntry } from '@/hooks/useActiveTimeEntry';
import { format } from 'date-fns';
import { ProgressRingTimer } from './ProgressRingTimer';
import { WeatherBadge } from './WeatherBadge';

interface ActiveTimerCardProps {
  entry: ActiveTimeEntry;
}

export function ActiveTimerCard({ entry }: ActiveTimerCardProps) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get current location for weather
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, // Ignore errors
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, []);

  return (
    <Card className="bg-primary/5 border-primary/20 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Progress Ring Timer */}
          <ProgressRingTimer 
            checkInAt={entry.check_in_at} 
            targetHours={8}
            size={100}
            strokeWidth={6}
          />

          {/* Info Section */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <Play className="h-4 w-4 text-primary" />
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-primary rounded-full animate-pulse" />
                </div>
                <span className="text-sm font-medium text-primary">Clocked In</span>
              </div>
              <WeatherBadge latitude={location?.lat} longitude={location?.lng} />
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="text-sm truncate">
                {entry.job_site_name || 'No job site selected'}
              </span>
            </div>

            <div className="text-sm text-muted-foreground">
              Started at <span className="font-medium">{format(new Date(entry.check_in_at), 'h:mm a')}</span>
            </div>

            <p className="text-xs text-muted-foreground truncate">
              {entry.project_name}
            </p>

            {entry.is_flagged && (
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Flagged
                </Badge>
                {entry.flag_reason && (
                  <span className="text-xs text-destructive truncate">
                    {entry.flag_reason}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
