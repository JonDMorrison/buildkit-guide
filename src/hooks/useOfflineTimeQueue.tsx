import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const QUEUE_STORAGE_KEY = 'horizon_time_queue_v1';

export interface QueuedTimeAction {
  id: string;
  created_at_local: string;
  action: 'check_in' | 'check_out';
  project_id: string;
  job_site_id: string | null;
  payload: {
    latitude?: number;
    longitude?: number;
    accuracy_meters?: number;
    location_source?: string;
    notes?: string;
  };
  idempotency_key: string;
  status: 'queued' | 'syncing' | 'failed' | 'success';
  last_error?: string;
  retry_count: number;
}

interface UseOfflineTimeQueueReturn {
  queuedActions: QueuedTimeAction[];
  isOnline: boolean;
  isSyncing: boolean;
  hasQueuedActions: boolean;
  enqueueCheckIn: (projectId: string, jobSiteId: string | null, location: { lat?: number; lng?: number; accuracy?: number } | null, notes?: string) => string;
  enqueueCheckOut: (projectId: string, location: { lat?: number; lng?: number; accuracy?: number } | null) => string;
  syncNow: () => Promise<void>;
  clearQueue: () => void;
  removeFromQueue: (id: string) => void;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function loadQueue(): QueuedTimeAction[] {
  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedTimeAction[]): void {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save offline queue:', e);
  }
}

export function useOfflineTimeQueue(): UseOfflineTimeQueueReturn {
  const { toast } = useToast();
  const [queuedActions, setQueuedActions] = useState<QueuedTimeAction[]>(loadQueue);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  // Persist queue to localStorage whenever it changes
  useEffect(() => {
    saveQueue(queuedActions);
  }, [queuedActions]);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming online
      syncNow();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Try to sync on mount if online and has queued actions
  useEffect(() => {
    if (isOnline && queuedActions.some(a => a.status === 'queued' || a.status === 'failed')) {
      syncNow();
    }
  }, []);

  const enqueueCheckIn = useCallback((
    projectId: string,
    jobSiteId: string | null,
    location: { lat?: number; lng?: number; accuracy?: number } | null,
    notes?: string
  ): string => {
    const id = generateUUID();
    const idempotencyKey = generateUUID();
    
    const action: QueuedTimeAction = {
      id,
      created_at_local: new Date().toISOString(),
      action: 'check_in',
      project_id: projectId,
      job_site_id: jobSiteId,
      payload: {
        latitude: location?.lat,
        longitude: location?.lng,
        accuracy_meters: location?.accuracy,
        notes,
      },
      idempotency_key: idempotencyKey,
      status: 'queued',
      retry_count: 0,
    };
    
    setQueuedActions(prev => [...prev, action]);
    
    toast({
      title: 'Queued',
      description: 'Check-in will be submitted when you\'re back online.',
    });
    
    return id;
  }, [toast]);

  const enqueueCheckOut = useCallback((
    projectId: string,
    location: { lat?: number; lng?: number; accuracy?: number } | null
  ): string => {
    const id = generateUUID();
    const idempotencyKey = generateUUID();
    
    const action: QueuedTimeAction = {
      id,
      created_at_local: new Date().toISOString(),
      action: 'check_out',
      project_id: projectId,
      job_site_id: null,
      payload: {
        latitude: location?.lat,
        longitude: location?.lng,
        accuracy_meters: location?.accuracy,
      },
      idempotency_key: idempotencyKey,
      status: 'queued',
      retry_count: 0,
    };
    
    setQueuedActions(prev => [...prev, action]);
    
    toast({
      title: 'Queued',
      description: 'Check-out will be submitted when you\'re back online.',
    });
    
    return id;
  }, [toast]);

  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline) return;
    
    const pending = queuedActions.filter(a => a.status === 'queued' || a.status === 'failed');
    if (pending.length === 0) return;
    
    setIsSyncing(true);
    
    // Process in order (oldest first)
    const sortedPending = [...pending].sort(
      (a, b) => new Date(a.created_at_local).getTime() - new Date(b.created_at_local).getTime()
    );
    
    for (const action of sortedPending) {
      // Update status to syncing
      setQueuedActions(prev => 
        prev.map(a => a.id === action.id ? { ...a, status: 'syncing' as const } : a)
      );
      
      try {
        const endpoint = action.action === 'check_in' ? 'time-check-in' : 'time-check-out';
        const body = action.action === 'check_in' 
          ? {
              project_id: action.project_id,
              job_site_id: action.job_site_id,
              latitude: action.payload.latitude,
              longitude: action.payload.longitude,
              accuracy_meters: action.payload.accuracy_meters,
              notes: action.payload.notes,
            }
          : {
              project_id: action.project_id,
              latitude: action.payload.latitude,
              longitude: action.payload.longitude,
              accuracy_meters: action.payload.accuracy_meters,
            };
        
        const { data, error } = await supabase.functions.invoke(endpoint, {
          body,
          headers: {
            'Idempotency-Key': action.idempotency_key,
            'X-Offline-Replay': 'true',
          },
        });
        
        if (error) {
          throw error;
        }
        
        // Check for specific error codes
        if (data?.error) {
          const errorCode = data.error.code || data.code;
          
          // Idempotency replay means it was already processed - treat as success
          if (errorCode === 'IDEMPOTENCY_CONFLICT' || errorCode === 'ALREADY_CHECKED_IN') {
            setQueuedActions(prev => prev.filter(a => a.id !== action.id));
            continue;
          }
          
          // Geofence violation - keep as failed, user needs to request adjustment
          if (errorCode === 'OUTSIDE_GEOFENCE') {
            setQueuedActions(prev => 
              prev.map(a => a.id === action.id ? { 
                ...a, 
                status: 'failed' as const,
                last_error: 'Outside geofence. Please submit an adjustment request instead.',
                retry_count: a.retry_count + 1,
              } : a)
            );
            
            toast({
              title: 'Sync Failed',
              description: 'Check-in was outside job site. Submit an adjustment request.',
              variant: 'destructive',
            });
            continue;
          }
          
          throw new Error(data.error.message || data.error);
        }
        
        // Success - remove from queue
        setQueuedActions(prev => prev.filter(a => a.id !== action.id));
        
        toast({
          title: 'Synced',
          description: `${action.action === 'check_in' ? 'Check-in' : 'Check-out'} synced successfully.`,
        });
        
      } catch (error) {
        console.error('Sync error for action:', action.id, error);
        
        setQueuedActions(prev => 
          prev.map(a => a.id === action.id ? { 
            ...a, 
            status: 'failed' as const,
            last_error: error instanceof Error ? error.message : 'Sync failed',
            retry_count: a.retry_count + 1,
          } : a)
        );
      }
    }
    
    setIsSyncing(false);
  }, [queuedActions, isSyncing, isOnline, toast]);

  const clearQueue = useCallback(() => {
    setQueuedActions([]);
    localStorage.removeItem(QUEUE_STORAGE_KEY);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueuedActions(prev => prev.filter(a => a.id !== id));
  }, []);

  return {
    queuedActions,
    isOnline,
    isSyncing,
    hasQueuedActions: queuedActions.length > 0,
    enqueueCheckIn,
    enqueueCheckOut,
    syncNow,
    clearQueue,
    removeFromQueue,
  };
}
