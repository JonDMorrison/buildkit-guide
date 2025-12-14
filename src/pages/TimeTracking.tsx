import { useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { LogIn, LogOut, Loader2, MapPin, AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { useActiveTimeEntry } from '@/hooks/useActiveTimeEntry';
import { useRecentTimeEntries, TimeEntry } from '@/hooks/useRecentTimeEntries';
import { useJobSites } from '@/hooks/useJobSites';
import { supabase } from '@/integrations/supabase/client';
import { ActiveTimerCard } from '@/components/time-tracking/ActiveTimerCard';
import { RecentEntriesList } from '@/components/time-tracking/RecentEntriesList';
import { TimeTrackingSummary } from '@/components/time-tracking/TimeTrackingSummary';
import { JobSiteSelectionModal } from '@/components/time-tracking/JobSiteSelectionModal';
import { GeofenceErrorModal } from '@/components/time-tracking/GeofenceErrorModal';
import { TimeEntryDetailDrawer } from '@/components/time-tracking/TimeEntryDetailDrawer';
import { AdjustmentRequestModal } from '@/components/time-tracking/AdjustmentRequestModal';
import { MyRequestsList } from '@/components/time-tracking/MyRequestsList';

interface GeofenceError {
  distance?: number;
  radius?: number;
  jobSiteName?: string;
}

export default function TimeTracking() {
  const { currentProjectId } = useCurrentProject();
  const { toast } = useToast();

  const { data: activeEntry, isLoading: activeLoading, refetch: refetchActive } = useActiveTimeEntry();
  const { data: recentEntries = [], isLoading: entriesLoading, refetch: refetchRecent } = useRecentTimeEntries();
  const { data: jobSites = [], isLoading: jobSitesLoading } = useJobSites(currentProjectId);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showJobSiteModal, setShowJobSiteModal] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showGeofenceError, setShowGeofenceError] = useState(false);
  const [geofenceError, setGeofenceError] = useState<GeofenceError>({});
  const [locationError, setLocationError] = useState<string | null>(null);

  // Detail drawer and adjustment modal
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentEntry, setAdjustmentEntry] = useState<TimeEntry | null>(null);

  const refetchAll = useCallback(() => {
    refetchActive();
    refetchRecent();
  }, [refetchActive, refetchRecent]);

  const getLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              reject(new Error('Location permission denied. Please enable location access.'));
              break;
            case error.POSITION_UNAVAILABLE:
              reject(new Error('Location information unavailable. Please try again.'));
              break;
            case error.TIMEOUT:
              reject(new Error('Location request timed out. Please try again.'));
              break;
            default:
              reject(new Error('An error occurred getting your location.'));
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleCheckInClick = async () => {
    if (!currentProjectId) {
      toast({ title: 'No project selected', description: 'Please select a project before checking in.', variant: 'destructive' });
      return;
    }
    setLocationError(null);
    setIsProcessing(true);
    try {
      const location = await getLocation();
      setPendingLocation(location);
      setShowJobSiteModal(true);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Failed to get location');
      toast({ title: 'Location Required', description: error instanceof Error ? error.message : 'Failed to get location', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleJobSiteSelect = async (jobSiteId: string | null) => {
    if (!currentProjectId || !pendingLocation) return;
    setShowJobSiteModal(false);
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('time-check-in', {
        body: { project_id: currentProjectId, job_site_id: jobSiteId, latitude: pendingLocation.lat, longitude: pendingLocation.lng },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.code === 'OUTSIDE_GEOFENCE') {
          setGeofenceError({ distance: data.distance, radius: data.radius, jobSiteName: data.jobSiteName });
          setShowGeofenceError(true);
          return;
        }
        if (data.code === 'ALREADY_CHECKED_IN') {
          toast({ title: 'Already Checked In', description: 'You have an active time entry. Check out first.', variant: 'destructive' });
          refetchAll();
          return;
        }
        throw new Error(data.error);
      }
      toast({ title: 'Checked In', description: 'Your time is now being tracked.' });
      refetchAll();
    } catch (error) {
      console.error('Check-in error:', error);
      toast({ title: 'Check-in Failed', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setPendingLocation(null);
    }
  };

  const handleCheckOut = async () => {
    if (!activeEntry) return;
    setIsProcessing(true);
    try {
      let location: { lat: number; lng: number } | null = null;
      try { location = await getLocation(); } catch { /* optional */ }
      const { data, error } = await supabase.functions.invoke('time-check-out', {
        body: { project_id: activeEntry.project_id, latitude: location?.lat, longitude: location?.lng },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.code === 'NO_OPEN_ENTRY') {
          toast({ title: 'No Active Entry', description: "You don't have an active time entry to close." });
          refetchAll();
          return;
        }
        throw new Error(data.error);
      }
      toast({ title: 'Checked Out', description: `Total time: ${data.entry?.duration_hours || 0}h ${data.entry?.duration_minutes || 0}m` });
      refetchAll();
    } catch (error) {
      console.error('Check-out error:', error);
      toast({ title: 'Check-out Failed', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEntryClick = (entry: TimeEntry) => {
    setSelectedEntry(entry);
    setShowDetailDrawer(true);
  };

  const handleRequestAdjustment = (entry: TimeEntry) => {
    setAdjustmentEntry(entry);
    setShowAdjustmentModal(true);
  };

  const handleNewAdjustment = () => {
    setAdjustmentEntry(null);
    setShowAdjustmentModal(true);
  };

  const isLoading = activeLoading || entriesLoading;
  const hasActiveEntry = !!activeEntry;

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Time Tracking</h1>
            <p className="text-muted-foreground">Track your work hours</p>
          </div>
          {!hasActiveEntry && (
            <Button variant="outline" size="sm" onClick={handleNewAdjustment}>
              <Plus className="h-4 w-4 mr-1" />
              Add Entry
            </Button>
          )}
        </div>

        {locationError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{locationError}</AlertDescription>
          </Alert>
        )}

        {/* Single Primary Action Card */}
        <Card className={hasActiveEntry ? 'border-primary/20 bg-primary/5' : ''}>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : hasActiveEntry ? (
              <div className="space-y-4">
                <ActiveTimerCard entry={activeEntry} />
                <Button onClick={handleCheckOut} disabled={isProcessing} variant="destructive" size="lg" className="w-full h-14 text-lg">
                  {isProcessing ? (<><Loader2 className="h-5 w-5 mr-2 animate-spin" />Checking Out...</>) : (<><LogOut className="h-5 w-5 mr-2" />Check Out</>)}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">You're not clocked in. Tap below to start tracking your time.</p>
                </div>
                <Button onClick={handleCheckInClick} disabled={isProcessing || !currentProjectId} size="lg" className="w-full h-14 text-lg">
                  {isProcessing ? (<><Loader2 className="h-5 w-5 mr-2 animate-spin" />Getting Location...</>) : (<><LogIn className="h-5 w-5 mr-2" />Check In</>)}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <TimeTrackingSummary entries={recentEntries} isLoading={entriesLoading} />
        <MyRequestsList />
        <RecentEntriesList entries={recentEntries} isLoading={entriesLoading} onEntryClick={handleEntryClick} onRequestAdjustment={handleRequestAdjustment} />

        <JobSiteSelectionModal open={showJobSiteModal} onOpenChange={setShowJobSiteModal} jobSites={jobSites} isLoading={jobSitesLoading} onSelect={handleJobSiteSelect} />
        <GeofenceErrorModal open={showGeofenceError} onOpenChange={setShowGeofenceError} distance={geofenceError.distance} radius={geofenceError.radius} jobSiteName={geofenceError.jobSiteName} />
        <TimeEntryDetailDrawer entry={selectedEntry} open={showDetailDrawer} onOpenChange={setShowDetailDrawer} onRequestAdjustment={handleRequestAdjustment} />
        {currentProjectId && (
          <AdjustmentRequestModal open={showAdjustmentModal} onOpenChange={setShowAdjustmentModal} entry={adjustmentEntry} projectId={currentProjectId} jobSites={jobSites} onSuccess={refetchAll} />
        )}
      </div>
    </Layout>
  );
}
