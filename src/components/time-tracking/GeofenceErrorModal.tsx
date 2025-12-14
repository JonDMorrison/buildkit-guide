import { MapPin, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface GeofenceErrorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  distance?: number;
  radius?: number;
  jobSiteName?: string;
}

export function GeofenceErrorModal({
  open,
  onOpenChange,
  distance,
  radius,
  jobSiteName,
}: GeofenceErrorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Outside Job Site
          </DialogTitle>
          <DialogDescription>
            You're too far from the job site to check in.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="my-4">
          <MapPin className="h-4 w-4" />
          <AlertTitle>Location Check Failed</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            {jobSiteName && (
              <p>
                <strong>Job Site:</strong> {jobSiteName}
              </p>
            )}
            {distance !== undefined && (
              <p>
                <strong>Your distance:</strong> {Math.round(distance)} meters away
              </p>
            )}
            {radius !== undefined && (
              <p>
                <strong>Required range:</strong> Within {radius} meters
              </p>
            )}
          </AlertDescription>
        </Alert>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>To check in, please:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Move closer to the job site location</li>
            <li>Ensure your GPS is enabled and accurate</li>
            <li>Try checking in again once you're on-site</li>
          </ol>
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={() => onOpenChange(false)}>
            Understood
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
