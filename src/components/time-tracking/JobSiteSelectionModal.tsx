import { useState } from 'react';
import { MapPin, AlertTriangle, Building2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { JobSite } from '@/hooks/useJobSites';

interface JobSiteSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobSites: JobSite[];
  isLoading: boolean;
  onSelect: (jobSiteId: string | null) => void;
}

export function JobSiteSelectionModal({
  open,
  onOpenChange,
  jobSites,
  isLoading,
  onSelect,
}: JobSiteSelectionModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleConfirm = () => {
    onSelect(selectedId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Select Job Site
          </DialogTitle>
          <DialogDescription>
            Choose the job site you're checking in at.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading job sites...
            </div>
          ) : jobSites.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No job sites configured for this project. Your check-in will be flagged for review.
              </AlertDescription>
            </Alert>
          ) : (
            <RadioGroup
              value={selectedId || ''}
              onValueChange={(value) => setSelectedId(value || null)}
              className="space-y-3"
            >
              {jobSites.map((site) => (
                <div
                  key={site.id}
                  className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedId(site.id)}
                >
                  <RadioGroupItem value={site.id} id={site.id} className="mt-1" />
                  <Label htmlFor={site.id} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{site.name}</span>
                    </div>
                    {site.address && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {site.address}
                      </p>
                    )}
                  </Label>
                </div>
              ))}

              <div
                className="flex items-start space-x-3 rounded-lg border border-dashed p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedId(null)}
              >
                <RadioGroupItem value="" id="no-site" className="mt-1" />
                <Label htmlFor="no-site" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="font-medium">No job site</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Entry will be flagged for review
                  </p>
                </Label>
              </div>
            </RadioGroup>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            Confirm Check In
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
