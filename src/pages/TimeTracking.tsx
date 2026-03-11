import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/shared/DashboardLayout';
import { DashboardHeader } from '@/components/dashboard/shared/DashboardHeader';
import { LogIn, LogOut, Loader2, MapPin, Plus, ClipboardList, Lock, Clock, Flag, WifiOff, Building2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { useActiveTimeEntry } from '@/hooks/useActiveTimeEntry';
import { useRecentTimeEntries, TimeEntry } from '@/hooks/useRecentTimeEntries';
import { useJobSites } from '@/hooks/useJobSites';
import { useOrganizationRole } from '@/hooks/useOrganizationRole';
import { useOrganization } from '@/hooks/useOrganization';
import { useOfflineTimeSync } from '@/hooks/useOfflineTimeSync';
import { offlineQueue, createCheckInAction, createCheckOutAction, QueuedTimeAction } from '@/lib/offlineQueue';
import { supabase } from '@/integrations/supabase/client';
import { ActiveTimerCard } from '@/components/time-tracking/ActiveTimerCard';
import { RecentEntriesList } from '@/components/time-tracking/RecentEntriesList';
import { TimeTrackingSummary } from '@/components/time-tracking/TimeTrackingSummary';
import { JobSiteSelectionModal } from '@/components/time-tracking/JobSiteSelectionModal';
import { GeofenceErrorModal } from '@/components/time-tracking/GeofenceErrorModal';
import { TimeEntryDetailDrawer } from '@/components/time-tracking/TimeEntryDetailDrawer';
import { AdjustmentRequestModal, RequestType } from '@/components/time-tracking/AdjustmentRequestModal';
import { MyRequestsList } from '@/components/time-tracking/MyRequestsList';
import { WorkerStatusBanner } from '@/components/time-tracking/WorkerStatusBanner';
import { LocationWarningBanner } from '@/components/time-tracking/LocationWarningBanner';
import { CheckInSuccessAnimation } from '@/components/time-tracking/CheckInSuccessAnimation';
import { PendingSyncPanel } from '@/components/time-tracking/PendingSyncPanel';
import { QueueConflictModal } from '@/components/time-tracking/QueueConflictModal';
import { useQuery } from '@tanstack/react-query';

interface GeofenceError {
  distance?: number;
  radius?: number;
  jobSiteName?: string;
}

const STALE_ENTRY_HOURS = 4;

export default function TimeTracking() {
  const navigate = useNavigate();
  const { currentProjectId, setCurrentProject } = useCurrentProject();
  const { toast } = useToast();
  const { canReviewRequests, canLockPeriods } = useOrganizationRole();
  const { activeOrganizationId } = useOrganization();

  // Fetch user's projects for selector
  const { data: userProjects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['user-member-projects', activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return [];
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      // Get projects where user has membership
      const { data, error } = await supabase
        .from('project_members')
        .select('project:projects!inner(id,name,job_number,is_deleted,organization_id)')
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      // Filter to active projects in the current org and extract project data
      return (data || [])
        .map(pm => pm.project)
        .filter((p): p is { id: string; name: string; job_number: string | null; is_deleted: boolean; organization_id: string } => 
          p !== null && !p.is_deleted && p.organization_id === activeOrganizationId
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!activeOrganizationId,
  });

  const { data: activeEntry, isLoading: activeLoading, refetch: refetchActive } = useActiveTimeEntry();
  const { data: recentEntries = [], isLoading: entriesLoading, refetch: refetchRecent } = useRecentTimeEntries();
  const { data: jobSites = [], isLoading: jobSitesLoading } = useJobSites(currentProjectId);
  
  // IndexedDB-based offline queue
  const { 
    queuedActions, 
    isSyncing, 
    isOnline, 
    syncNow, 
    discardItem, 
    discardAll, 
    refreshQueue,
    pendingCount,
    failedCount,
  } = useOfflineTimeSync();

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
  const [suggestedRequestType, setSuggestedRequestType] = useState<RequestType | null>(null);

  // Success animation state
  const [successAnimation, setSuccessAnimation] = useState<{ show: boolean; type: 'check_in' | 'check_out' }>({ show: false, type: 'check_in' });

  // Queue conflict modal state
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictingAction, setConflictingAction] = useState<QueuedTimeAction | null>(null);

  const refetchAll = useCallback(() => {
    refetchActive();
    refetchRecent();
  }, [refetchActive, refetchRecent]);

  // Refetch data after successful sync
  useEffect(() => {
    if (!isSyncing && queuedActions.length === 0) {
      refetchAll();
    }
  }, [isSyncing, queuedActions.length]);

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

    // Check for queue conflicts before proceeding
    const conflict = await offlineQueue.getConflictingAction(currentProjectId, 'check_in');
    if (conflict) {
      setConflictingAction(conflict);
      setShowConflictModal(true);
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

  const enqueueCheckIn = async (projectId: string, jobSiteId: string | null, location: { lat?: number; lng?: number; accuracy?: number } | null, notes?: string) => {
    const action = createCheckInAction(projectId, jobSiteId, location, notes);
    await offlineQueue.add(action);
    await refreshQueue();
    toast({ title: 'Queued', description: 'Check-in will sync when online.' });
  };

  const enqueueCheckOut = async (projectId: string, location: { lat?: number; lng?: number; accuracy?: number } | null) => {
    const action = createCheckOutAction(projectId, location);
    await offlineQueue.add(action);
    await refreshQueue();
    toast({ title: 'Queued', description: 'Check-out will sync when online.' });
  };

  const handleJobSiteSelect = async (jobSiteId: string | null, notes?: string, taskId?: string | null) => {
    if (!currentProjectId) return;
    setShowJobSiteModal(false);
    setIsProcessing(true);
    
    // If offline, queue the action
    if (!isOnline) {
      await enqueueCheckIn(currentProjectId, jobSiteId, pendingLocation, notes);
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
          task_id: taskId || undefined,
          latitude: pendingLocation?.lat, 
          longitude: pendingLocation?.lng,
          accuracy_meters: pendingLocation?.accuracy,
          notes: notes || undefined,
        },
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      });
      
      if (error) {
        // Network error - queue for later
        if (error.message?.includes('fetch') || error.message?.includes('network')) {
          await enqueueCheckIn(currentProjectId, jobSiteId, pendingLocation, notes);
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
      
      // Show success animation
      setSuccessAnimation({ show: true, type: 'check_in' });
      
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

    // Check for queue conflicts
    const conflict = await offlineQueue.getConflictingAction(activeEntry.project_id, 'check_out');
    if (conflict) {
      setConflictingAction(conflict);
      setShowConflictModal(true);
      return;
    }

    setIsProcessing(true);
    
    // If offline, queue the action
    if (!isOnline) {
      await enqueueCheckOut(activeEntry.project_id, null);
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
          await enqueueCheckOut(activeEntry.project_id, location);
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
      
      // Show success animation with duration info
      setSuccessAnimation({ show: true, type: 'check_out' });
      
      const hours = data.entry?.duration_hours || 0;
      const mins = data.entry?.duration_minutes ? data.entry.duration_minutes % 60 : 0;
      // Toast after animation
      setTimeout(() => {
        toast({ title: 'Shift Complete', description: `Total time: ${Math.floor(hours)}h ${mins}m` });
      }, 1200);
      
      refetchAll();
    } catch (error) {
      console.error('Check-out error:', error);
      toast({ title: 'Check-out Failed', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConflictDiscard = async () => {
    if (conflictingAction) {
      await discardItem(conflictingAction.id);
      setConflictingAction(null);
    }
  };

  const handleEntryClick = (entry: TimeEntry) => {
    setSelectedEntry(entry);
    setShowDetailDrawer(true);
  };

  const handleRequestAdjustment = (entry: TimeEntry, suggestedType?: RequestType | null) => {
    setAdjustmentEntry(entry);
    setSuggestedRequestType(suggestedType || null);
    setShowAdjustmentModal(true);
  };

  const handleNewAdjustment = () => {
    setAdjustmentEntry(null);
    setSuggestedRequestType(null);
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
    <DashboardLayout>
      <div className="space-y-4 max-w-2xl mx-auto">
        <DashboardHeader
          title="Time Tracking"
          subtitle="Track your work hours"
          actions={
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
          }
        />

        {/* Offline warning */}
        {!isOnline && (
          <Alert variant="default" className="border-blue-500/30 bg-blue-500/5 [&>svg]:text-blue-600">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>You're Offline</AlertTitle>
            <AlertDescription>
              Actions will be queued and synced when you're back online.
            </AlertDescription>
          </Alert>
        )}

        {/* Enhanced pending sync panel with queue details */}
        {hasQueuedItems && (
          <PendingSyncPanel
            queuedActions={queuedActions}
            isOnline={isOnline}
            isSyncing={isSyncing}
            onSync={syncNow}
            onDiscard={discardItem}
            onDiscardAll={discardAll}
          />
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
                  <p className="text-muted-foreground">
                    {!currentProjectId ? 'Select a project to check in' : 'Tap below to start tracking your time'}
                  </p>
                </div>
                
                {/* Project Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Project</label>
                  <Select 
                    value={currentProjectId || ''} 
                    onValueChange={(value) => setCurrentProject(value)}
                    disabled={projectsLoading}
                  >
                    <SelectTrigger className="w-full h-12">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Select a project..." />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {userProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          <div className="flex items-center gap-2">
                            <span>{project.name}</span>
                            {project.job_number && (
                              <span className="text-xs text-muted-foreground">#{project.job_number}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                      {userProjects.length === 0 && !projectsLoading && (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                          No projects available
                        </div>
                      )}
                    </SelectContent>
                  </Select>
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
          userLocation={pendingLocation}
          autoSelectSingle={true}
          projectId={currentProjectId || undefined}
          onJobSiteCreated={refetchAll}
        />
        <GeofenceErrorModal open={showGeofenceError} onOpenChange={setShowGeofenceError} distance={geofenceError.distance} radius={geofenceError.radius} jobSiteName={geofenceError.jobSiteName} />
        <TimeEntryDetailDrawer entry={selectedEntry} open={showDetailDrawer} onOpenChange={setShowDetailDrawer} onRequestAdjustment={handleRequestAdjustment} />
        {currentProjectId && (
          <AdjustmentRequestModal 
            open={showAdjustmentModal} 
            onOpenChange={setShowAdjustmentModal} 
            entry={adjustmentEntry} 
            projectId={currentProjectId} 
            jobSites={jobSites} 
            onSuccess={refetchAll}
            defaultRequestType={suggestedRequestType}
          />
        )}
        
        {/* Queue conflict modal */}
        <QueueConflictModal
          open={showConflictModal}
          onOpenChange={setShowConflictModal}
          conflictingAction={conflictingAction}
          onSyncNow={syncNow}
          onDiscard={handleConflictDiscard}
          isSyncing={isSyncing}
        />
        
        {/* Success animation overlay */}
        <CheckInSuccessAnimation 
          type={successAnimation.type}
          show={successAnimation.show}
          onComplete={() => setSuccessAnimation({ ...successAnimation, show: false })}
        />
      </div>
    </DashboardLayout>
  );
}
