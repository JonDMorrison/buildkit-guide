import { MapPin, Navigation, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocationPreviewMapProps {
  userLocation: { lat: number; lng: number; accuracy: number } | null;
  jobSiteLocation?: { lat: number; lng: number; radius: number } | null;
  className?: string;
}

export function LocationPreviewMap({
  userLocation,
  jobSiteLocation,
  className,
}: LocationPreviewMapProps) {
  if (!userLocation) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-6",
        className
      )}>
        <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
        <p className="text-sm text-muted-foreground text-center">
          Location unavailable
        </p>
      </div>
    );
  }

  // Calculate distance to job site if both locations available
  const distance = jobSiteLocation 
    ? calculateDistance(
        userLocation.lat, 
        userLocation.lng, 
        jobSiteLocation.lat, 
        jobSiteLocation.lng
      )
    : null;

  const isWithinGeofence = distance !== null && jobSiteLocation 
    ? distance <= jobSiteLocation.radius 
    : null;

  return (
    <div className={cn("rounded-lg border overflow-hidden", className)}>
      {/* Static map visualization */}
      <div className="relative h-32 bg-gradient-to-br from-muted/50 to-muted">
        {/* Grid pattern for map effect */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
          }}
        />
        
        {/* Job site radius circle (if available) */}
        {jobSiteLocation && (
          <div 
            className={cn(
              "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed",
              isWithinGeofence ? "border-primary/40 bg-primary/10" : "border-destructive/40 bg-destructive/10"
            )}
            style={{ width: 80, height: 80 }}
          />
        )}

        {/* User position marker */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {/* Accuracy ring */}
          <div 
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 animate-pulse"
            style={{ 
              width: Math.min(60, Math.max(20, userLocation.accuracy / 5)),
              height: Math.min(60, Math.max(20, userLocation.accuracy / 5)),
            }}
          />
          {/* Pin */}
          <div className="relative z-10 flex items-center justify-center">
            <div className="rounded-full bg-primary p-2 shadow-lg">
              <Navigation className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
        </div>

        {/* Job site marker (offset slightly) */}
        {jobSiteLocation && (
          <div 
            className="absolute z-10"
            style={{ 
              left: 'calc(50% + 15px)', 
              top: 'calc(50% - 15px)',
            }}
          >
            <MapPin className={cn(
              "h-6 w-6 drop-shadow-md",
              isWithinGeofence ? "text-primary" : "text-destructive"
            )} />
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="px-3 py-2 bg-muted/30 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Navigation className="h-3 w-3" />
          <span>±{Math.round(userLocation.accuracy)}m accuracy</span>
        </div>
        {distance !== null && (
          <div className={cn(
            "flex items-center gap-1.5 font-medium",
            isWithinGeofence ? "text-primary" : "text-destructive"
          )}>
            <MapPin className="h-3 w-3" />
            <span>{formatDistance(distance)} from site</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Haversine formula for distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}
