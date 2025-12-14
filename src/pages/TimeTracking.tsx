import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { LogIn, LogOut, Loader2, MapPin, Plus, ClipboardList, Lock, Clock, Flag, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { useActiveTimeEntry } from '@/hooks/useActiveTimeEntry';
import { useRecentTimeEntries, TimeEntry } from '@/hooks/useRecentTimeEntries';
import { useJobSites } from '@/hooks/useJobSites';
import { useOrganizationRole } from '@/hooks/useOrganizationRole';
import { useOfflineTimeQueue } from '@/hooks/useOfflineTimeQueue';
import { supabase } from '@/integrations/supabase/client';
import { ActiveTimerCard } from '@/components/time-tracking/ActiveTimerCard';
import { RecentEntriesList } from '@/components/time-tracking/RecentEntriesList';
import { TimeTrackingSummary } from '@/components/time-tracking/TimeTrackingSummary';
import { JobSiteSelectionModal } from '@/components/time-tracking/JobSiteSelectionModal';
import { GeofenceErrorModal } from '@/components/time-tracking/GeofenceErrorModal';
import { TimeEntryDetailDrawer } from '@/components/time-tracking/TimeEntryDetailDrawer';
import { AdjustmentRequestModal } from '@/components/time-tracking/AdjustmentRequestModal';
import { MyRequestsList } from '@/components/time-tracking/MyRequestsList';
import { WorkerStatusBanner } from '@/components/time-tracking/WorkerStatusBanner';
import { LocationWarningBanner } from '@/components/time-tracking/LocationWarningBanner';

interface GeofenceError {
  distance?: number;
  radius?: number;
  jobSiteName?: string;
}

const STALE_ENTRY_HOURS = 4;

export default function TimeTracking() {
  const navigate = useNavigate();
  const { currentProjectId } = useCurrentProject();
  const { toast } = useToast();
  const { canReviewRequests, canLockPeriods } = useOrganizationRole();

  const { data: activeEntry, isLoading: activeLoading, refetch: refetchActive } = useActiveTimeEntry();
  const { data: recentEntries = [], isLoading: entriesLoading, refetch: refetchRecent } = useRecentTimeEntries();
  const { data: jobSites = [], isLoading: jobSitesLoading } = useJobSites(currentProjectId);
  
  // Offline queue
  const { queuedActions, isSyncing, isOnline, syncNow, enqueueCheckIn, enqueueCheckOut } = useOfflineTimeQueue();

  const [isProcessing, setIsProcessing] = useState(false);
  const [showJobSiteModal, setShowJobSiteModal] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [showGeofenceError, setShowGeofenceError] = useState(false);
  const [geofenceError, setGeofenceError] = useState<GeofenceError>({});
  const [locationWarning, setLocationWarning] = useState<'location_unavailable' | 'offline' | null>(null);

  // Detail drawer and adjustment modal
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentEntry, setAdjustmentEntry] = useState<TimeEntry | null>(null);

  const refetchAll = useCallback(() => {
    refetchActive();
    refetchRecent();
  }, [refetchActive, refetchRecent]);

  const getLocation = (): Promise<{ lat: number; lng: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('location_unavailable'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ 
          lat: position.coords.latitude, 
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        }),
        () => {
          reject(new Error('location_unavailable'));
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
    
    setLocationWarning(null);
    setIsProcessing(true);
    
    try {
      const location = await getLocation();
      
      // Warn if accuracy is poor (>100m)
      if (location.accuracy > 100) {
        setLocationWarning('location_unavailable');
      }
      
      setPendingLocation(location);
      setShowJobSiteModal(true);
    } catch {
      // Allow check-in without location, but flag it
      setLocationWarning('location_unavailable');
      setPendingLocation(null);
      setShowJobSiteModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleJobSiteSelect = async (jobSiteId: string | null) => {
    if (!currentProjectId) return;
    setShowJobSiteModal(false);
    setIsProcessing(true);
    
    // If offline, queue the action
    if (!isOnline) {
      enqueueCheckIn(currentProjectId, jobSiteId, pendingLocation);
      toast({ title: 'Queued', description: 'Check-in will sync when online.' });
      setIsProcessing(false);
      setPendingLocation(null);
      setLocationWarning(null);
      return;
    }
    
    try {
      const idempotencyKey = crypto.randomUUID();
      const { data, error } = await supabase.functions.invoke('time-check-in', {
        body: { 
          project_id: currentProjectId, 
          job_site_id: jobSiteId, 
          latitude: pendingLocation?.lat, 
          longitude: pendingLocation?.lng,
          accuracy_meters: pendingLocation?.accuracy,
        },
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      });
      
      if (error) {
        // Network error - queue for later
        if (error.message?.includes('fetch') || error.message?.includes('network')) {
          enqueueCheckIn(currentProjectId, jobSiteId, pendingLocation);
          toast({ title: 'Queued', description: 'Check-in will sync when online.' });
          return;
        }
        throw error;
      }
      
      if (data?.error) {
        if (data.error.code === 'OUTSIDE_GEOFENCE') {
          setGeofenceError({ distance: data.error.details?.distance, radius: data.error.details?.radius, jobSiteName: data.error.details?.jobSiteName });
          setShowGeofenceError(true);
          return;
        }
        if (data.error.code === 'ALREADY_CHECKED_IN') {
          toast({ title: 'Already Checked In', description: 'You have an active time entry. Check out first.', variant: 'destructive' });
          refetchAll();
          return;
        }
        throw new Error(data.error.message || data.error);
      }
      
      if (locationWarning || data?.flags_created?.length > 0) {
        toast({ 
          title: 'Checked In', 
          description: 'Your time is now being tracked. Some details flagged for review.' 
        });
      } else {
        toast({ title: 'Checked In', description: 'Your time is now being tracked.' });
      }
      
      setLocationWarning(null);
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
    
    // If offline, queue the action
    if (!isOnline) {
      enqueueCheckOut(activeEntry.project_id, {});
      toast({ title: 'Queued', description: 'Check-out will sync when online.' });
      setIsProcessing(false);
      return;
    }
    
    try {
      let location: { lat: number; lng: number; accuracy: number } | null = null;
      try { 
        location = await getLocation(); 
      } catch { /* optional for check-out */ }
      
      const idempotencyKey = crypto.randomUUID();
      const { data, error } = await supabase.functions.invoke('time-check-out', {
        body: { 
          project_id: activeEntry.project_id, 
          latitude: location?.lat, 
          longitude: location?.lng,
          accuracy_meters: location?.accuracy,
        },
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      });
      
      if (error) {
        // Network error - queue for later
        if (error.message?.includes('fetch') || error.message?.includes('network')) {
          enqueueCheckOut(activeEntry.project_id, location);
          toast({ title: 'Queued', description: 'Check-out will sync when online.' });
          return;
        }
        throw error;
      }
      
      if (data?.error) {
        if (data.error.code === 'NO_OPEN_ENTRY') {
          toast({ title: 'No Active Entry', description: "You don't have an active time entry to close." });
          refetchAll();
          return;
        }
        throw new Error(data.error.message || data.error);
      }
      
      const hours = data.entry?.duration_hours || 0;
      const mins = data.entry?.duration_minutes ? data.entry.duration_minutes % 60 : 0;
      toast({ title: 'Checked Out', description: `Total time: ${Math.floor(hours)}h ${mins}m` });
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
  const hasQueuedItems = queuedActions.length > 0;
  
  // Check for stale active entry
  const isActiveEntryStale = useMemo(() => {
    if (!activeEntry) return false;
    const checkInTime = new Date(activeEntry.check_in_at);
    const hoursElapsed = (Date.now() - checkInTime.getTime()) / (1000 * 60 * 60);
    return hoursElapsed > STALE_ENTRY_HOURS;
  }, [activeEntry]);
  
  // Find most recent auto-closed entry for banner
  const lastAutoClosedEntry = useMemo(() => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return recentEntries.find(
      entry => 
        (entry.closed_method === 'auto_closed' || entry.closed_method === 'force_closed' || entry.closed_method === 'force') &&
        new Date(entry.check_in_at) > yesterday
    );
  }, [recentEntries]);
  
  // Check for flagged entries this week
  const flaggedEntriesThisWeek = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return recentEntries.filter(
      entry => entry.is_flagged && new Date(entry.check_in_at) > weekAgo
    );
  }, [recentEntries]);

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Time Tracking</h1>
            <p className="text-muted-foreground">Track your work hours</p>
          </div>
          <div className="flex items-center gap-2">
            {canReviewRequests && (
              <Button variant="outline" size="sm" onClick={() => navigate('/time/requests')}>
                <ClipboardList className="h-4 w-4 mr-1" />
                Review Requests
              </Button>
            )}
            {canLockPeriods && (
              <Button variant="outline" size="sm" onClick={() => navigate('/time/periods')}>
                <Lock className="h-4 w-4 mr-1" />
                Timesheet Periods
              </Button>
            )}
            {!hasActiveEntry && (
              <Button variant="outline" size="sm" onClick={handleNewAdjustment}>
                <Plus className="h-4 w-4 mr-1" />
                Add Entry
              </Button>
            )}
          </div>
        </div>

        {/* Offline warning with sync button */}
        {!isOnline && (
          <Alert variant="default" className="border-blue-500/30 bg-blue-500/5 [&>svg]:text-blue-600">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>You're Offline</AlertTitle>
            <AlertDescription>
              Actions will be queued and synced when you're back online.
            </AlertDescription>
          </Alert>
        )}

        {/* Queued items banner */}
        {hasQueuedItems && (
          <Alert variant="default" className="border-blue-500/30 bg-blue-500/5 [&>svg]:text-blue-600">
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <AlertTitle>Pending Sync</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{queuedActions.length} action{queuedActions.length > 1 ? 's' : ''} queued</span>
              {isOnline && (
                <Button variant="outline" size="sm" onClick={syncNow} disabled={isSyncing}>
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Location warning during check-in flow */}
        {locationWarning === 'location_unavailable' && showJobSiteModal && (
          <LocationWarningBanner type="location_unavailable" />
        )}

        {/* Auto-closed entry banner - prominent and actionable */}
        {!hasActiveEntry && lastAutoClosedEntry && (
          <WorkerStatusBanner
            state="auto_checked_out"
            autoCheckOutTime={lastAutoClosedEntry.check_out_at || undefined}
            onRequestCorrection={() => handleRequestAdjustment(lastAutoClosedEntry)}
          />
        )}

        {/* Stale entry warning */}
        {isActiveEntryStale && (
          <Alert variant="default" className="border-amber-500/30 bg-amber-500/5 [&>svg]:text-amber-600">
            <Clock className="h-4 w-4" />
            <AlertTitle>Long Active Shift</AlertTitle>
            <AlertDescription>
              You've been clocked in for over {STALE_ENTRY_HOURS} hours. Don't forget to check out when you're done.
            </AlertDescription>
          </Alert>
        )}

        {/* Flagged entries warning */}
        {flaggedEntriesThisWeek.length > 0 && (
          <Alert variant="default" className="border-destructive/30 bg-destructive/5 [&>svg]:text-destructive">
            <Flag className="h-4 w-4" />
            <AlertTitle>Needs Attention</AlertTitle>
            <AlertDescription>
              You have {flaggedEntriesThisWeek.length} flagged time {flaggedEntriesThisWeek.length === 1 ? 'entry' : 'entries'} this week. 
              Tap on them below to review and request corrections if needed.
            </AlertDescription>
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
                  <p className="text-lg font-medium mb-1">Not Clocked In</p>
                  <p className="text-muted-foreground">Tap below to start tracking your time</p>
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

        <JobSiteSelectionModal 
          open={showJobSiteModal} 
          onOpenChange={setShowJobSiteModal} 
          jobSites={jobSites} 
          isLoading={jobSitesLoading} 
          onSelect={handleJobSiteSelect}
          locationUnavailable={locationWarning === 'location_unavailable'}
        />
        <GeofenceErrorModal open={showGeofenceError} onOpenChange={setShowGeofenceError} distance={geofenceError.distance} radius={geofenceError.radius} jobSiteName={geofenceError.jobSiteName} />
        <TimeEntryDetailDrawer entry={selectedEntry} open={showDetailDrawer} onOpenChange={setShowDetailDrawer} onRequestAdjustment={handleRequestAdjustment} />
        {currentProjectId && (
          <AdjustmentRequestModal open={showAdjustmentModal} onOpenChange={setShowAdjustmentModal} entry={adjustmentEntry} projectId={currentProjectId} jobSites={jobSites} onSuccess={refetchAll} />
        )}
      </div>
    </Layout>
  );
}
