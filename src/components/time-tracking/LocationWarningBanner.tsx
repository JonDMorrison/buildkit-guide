import { MapPinOff, WifiOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface LocationWarningBannerProps {
  type: 'location_unavailable' | 'offline';
  className?: string;
}

export function LocationWarningBanner({
  type,
  className,
}: LocationWarningBannerProps) {
  if (type === 'location_unavailable') {
    return (
      <Alert
        variant="default"
        className={cn(
          'border-amber-500/30 bg-amber-500/5 [&>svg]:text-amber-600',
          className
        )}
      >
        <MapPinOff className="h-4 w-4" />
        <AlertTitle>Location unavailable</AlertTitle>
        <AlertDescription>
          We couldn't confirm your location — your check-in will still be recorded, 
          but it will be flagged for supervisor review.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert
      variant="default"
      className={cn(
        'border-blue-500/30 bg-blue-500/5 [&>svg]:text-blue-600',
        className
      )}
    >
      <WifiOff className="h-4 w-4" />
      <AlertTitle>You appear to be offline</AlertTitle>
      <AlertDescription>
        Your check-in will be saved and synced when you're back online. 
        You can continue working normally.
      </AlertDescription>
    </Alert>
  );
}
