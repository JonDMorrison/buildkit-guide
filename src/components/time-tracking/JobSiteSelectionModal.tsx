import { useState, useEffect } from 'react';
import { MapPin, AlertTriangle, Building2, MapPinOff, Zap, Plus } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JobSite } from '@/hooks/useJobSites';
import { LocationPreviewMap } from './LocationPreviewMap';
import { VoiceNotesInput } from './VoiceNotesInput';
import { SmartJobSiteSuggestion } from './SmartJobSiteSuggestion';
import { CreateJobSiteModal } from '@/components/setup/steps/CreateJobSiteModal';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface JobSiteSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobSites: JobSite[];
  isLoading: boolean;
  onSelect: (jobSiteId: string | null, notes?: string, taskId?: string | null) => void;
  locationUnavailable?: boolean;
  userLocation?: { lat: number; lng: number; accuracy: number } | null;
  autoSelectSingle?: boolean;
  projectId?: string;
  onJobSiteCreated?: () => void;
}

export function JobSiteSelectionModal({
  open,
  onOpenChange,
  jobSites,
  isLoading,
  onSelect,
  locationUnavailable = false,
  userLocation = null,
  autoSelectSingle = true,
  projectId,
  onJobSiteCreated,
}: JobSiteSelectionModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateJobSite, setShowCreateJobSite] = useState(false);

  // Fetch tasks for the active project
  const { data: projectTasks = [] } = useQuery({
    queryKey: ['project-tasks-for-time', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('id,title,status')
        .eq('project_id', projectId)
        .in('status', ['not_started', 'in_progress'])
        .order('title');
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId && open,
  });

  // Auto-select if only one job site and autoSelectSingle is true
  useEffect(() => {
    if (open && autoSelectSingle && jobSites.length === 1 && !isLoading) {
      setSelectedId(jobSites[0].id);
    }
  }, [open, autoSelectSingle, jobSites, isLoading]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedId(jobSites.length === 1 ? jobSites[0].id : null);
      setNotes('');
      setSelectedTaskId(null);
    }
  }, [open, jobSites.length]);

  const handleConfirm = () => {
    onSelect(selectedId, notes || undefined, selectedTaskId);
  };

  // Get selected job site location for map
  const selectedJobSite = jobSites.find(s => s.id === selectedId);
  const jobSiteLocation = selectedJobSite?.latitude && selectedJobSite?.longitude
    ? { 
        lat: selectedJobSite.latitude, 
        lng: selectedJobSite.longitude, 
        radius: selectedJobSite.geofence_radius_meters || 100 
      }
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Select Job Site
          </DialogTitle>
          <DialogDescription>
            {jobSites.length === 1 
              ? "Confirm your job site to check in"
              : "Choose the job site you're checking in at"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Location preview map */}
          {!locationUnavailable && userLocation && (
            <LocationPreviewMap
              userLocation={userLocation}
              jobSiteLocation={jobSiteLocation}
            />
          )}

          {/* Location warning banner */}
          {locationUnavailable && (
            <Alert variant="default" className="border-amber-500/30 bg-amber-500/5 [&>svg]:text-amber-600">
              <MapPinOff className="h-4 w-4" />
              <AlertTitle>Location unavailable</AlertTitle>
              <AlertDescription>
                We couldn't confirm your location. Your check-in will still be recorded, 
                but flagged for supervisor review. You can continue working normally.
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading job sites...
            </div>
          ) : jobSites.length === 0 ? (
            <div className="space-y-3">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No job sites configured for this project. Create one now, or check in without one (entry will be flagged for review).
                </AlertDescription>
              </Alert>
              {projectId && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowCreateJobSite(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Job Site
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Single job site - simplified view */}
              {jobSites.length === 1 ? (
                <div className="rounded-lg border bg-primary/5 border-primary/20 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{jobSites[0].name}</p>
                      {jobSites[0].address && (
                        <p className="text-sm text-muted-foreground">{jobSites[0].address}</p>
                      )}
                    </div>
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                </div>
              ) : (
                <>
                  {/* Smart job site suggestion */}
                  <SmartJobSiteSuggestion 
                    jobSites={jobSites} 
                    onSelect={(id) => setSelectedId(id)} 
                  />
                  
                  {/* Multiple job sites - radio selection */}
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
                      <RadioGroupItem value="no-site" id="no-site" className="mt-1" />
                      <Label htmlFor="no-site" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span className="font-medium">No job site</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Entry will be flagged for review
                        </p>
                      </Label>
                    </div>
                  </RadioGroup>
                </>
              )}
            </>
          )}

          {/* Task selector (optional) */}
          {projectTasks.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm">Task (optional)</Label>
              <Select
                value={selectedTaskId || 'none'}
                onValueChange={(v) => setSelectedTaskId(v === 'none' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No task selected" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No task</SelectItem>
                  {projectTasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Link this time entry to a specific task for accurate scope tracking.
              </p>
            </div>
          )}

          {/* Voice notes input */}
          <div className="pt-2 border-t">
            <VoiceNotesInput
              value={notes}
              onChange={setNotes}
              placeholder="Add notes about your check-in (optional)..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading} size="lg">
            {jobSites.length === 1 ? (
              <>
                <Zap className="h-4 w-4 mr-1.5" />
                Quick Check In
              </>
            ) : (
              'Confirm Check In'
            )}
          </Button>
        </div>
      </DialogContent>

      {/* Inline Create Job Site modal */}
      {projectId && (
        <CreateJobSiteModal
          open={showCreateJobSite}
          onOpenChange={setShowCreateJobSite}
          projectId={projectId}
          onSuccess={() => {
            setShowCreateJobSite(false);
            onJobSiteCreated?.();
          }}
        />
      )}
    </Dialog>
  );
}
