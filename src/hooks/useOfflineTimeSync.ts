import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  offlineQueue,
  QueuedTimeAction,
  calculateNextRetry,
} from '@/lib/offlineQueue';

interface UseOfflineTimeSyncReturn {
  queuedActions: QueuedTimeAction[];
  isOnline: boolean;
  isSyncing: boolean;
  hasQueuedActions: boolean;
  pendingCount: number;
  failedCount: number;
  syncNow: () => Promise<void>;
  discardItem: (id: string) => Promise<void>;
  discardAll: () => Promise<void>;
  refreshQueue: () => Promise<void>;
}

export function useOfflineTimeSync(): UseOfflineTimeSyncReturn {
  const { toast } = useToast();
  const [queuedActions, setQueuedActions] = useState<QueuedTimeAction[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  // Load queue state
  const refreshQueue = useCallback(async () => {
    try {
      const actions = await offlineQueue.getAll();
      setQueuedActions(actions);
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }, []);

  // Initial load and online/offline events
  useEffect(() => {
    refreshQueue();

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming online
      syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Replay a single action
  const replayAction = async (action: QueuedTimeAction): Promise<boolean> => {
    const endpoint = action.actionType === 'check_in' ? 'time-check-in' : 'time-check-out';

    const body = {
      project_id: action.projectId,
      job_site_id: action.jobSiteId,
      latitude: action.payload.latitude,
      longitude: action.payload.longitude,
      accuracy_meters: action.payload.accuracy_meters,
      notes: action.payload.notes,
      // Request safe flags to be applied
      requested_flags: action.pendingFlags,
    };

    try {
      const { data, error } = await supabase.functions.invoke(endpoint, {
        body,
        headers: {
          'Idempotency-Key': action.idempotencyKey,
          'X-Offline-Replay': 'true',
        },
      });

      if (error) {
        throw error;
      }

      // Check for error in response body
      if (data?.error) {
        const errorCode = data.error.code || data.code;

        // Idempotency hit or already checked in = treat as success
        if (errorCode === 'IDEMPOTENCY_CONFLICT' || errorCode === 'ALREADY_CHECKED_IN') {
          return true;
        }

        // Validation errors - mark as failed, don't retry
        if (
          errorCode === 'OUTSIDE_GEOFENCE' ||
          errorCode === 'PROJECT_NOT_FOUND' ||
          errorCode === 'NOT_PROJECT_MEMBER'
        ) {
          throw new Error(`${errorCode}: ${data.error.message || 'Validation failed'}`);
        }

        throw new Error(data.error.message || 'Unknown error');
      }

      return true;
    } catch (error) {
      console.error('Replay failed for action:', action.id, error);
      throw error;
    }
  };

  // Sync all pending actions
  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;

    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const pending = await offlineQueue.getPending();
      if (pending.length === 0) {
        setIsSyncing(false);
        syncingRef.current = false;
        return;
      }

      // Sort by created time (FIFO)
      const sorted = [...pending].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      for (const action of sorted) {
        // Check if it's time to retry (if has nextRetryAt)
        if (action.nextRetryAt && new Date(action.nextRetryAt) > new Date()) {
          continue; // Skip, not ready yet
        }

        // Update status to replaying
        const updatedAction = { ...action, status: 'replaying' as const };
        await offlineQueue.update(updatedAction);
        await refreshQueue();

        try {
          const success = await replayAction(action);

          if (success) {
            // Remove from queue on success
            await offlineQueue.remove(action.id);
            toast({
              title: 'Synced',
              description: `${action.actionType === 'check_in' ? 'Check-in' : 'Check-out'} synced successfully.`,
            });
          }
        } catch (error) {
          // Mark as failed with next retry time
          const errorMessage = error instanceof Error ? error.message : 'Sync failed';
          const nextRetry = calculateNextRetry(action.retryCount);

          await offlineQueue.update({
            ...action,
            status: 'failed',
            lastError: errorMessage,
            retryCount: action.retryCount + 1,
            nextRetryAt: nextRetry.toISOString(),
          });

          // If it's a permanent failure (validation), don't show retry toast
          if (errorMessage.includes('OUTSIDE_GEOFENCE')) {
            toast({
              title: 'Sync Failed - Location Issue',
              description: 'Check-in was outside job site. Submit an adjustment request instead.',
              variant: 'destructive',
            });
          } else if (action.retryCount === 0) {
            toast({
              title: 'Sync Failed',
              description: `Will retry in a few seconds.`,
              variant: 'destructive',
            });
          }
        }
      }
    } finally {
      await refreshQueue();
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [toast, refreshQueue]);

  // Discard a single item
  const discardItem = useCallback(
    async (id: string) => {
      await offlineQueue.remove(id);
      await refreshQueue();
      toast({
        title: 'Discarded',
        description: 'Queued action was discarded.',
      });
    },
    [toast, refreshQueue]
  );

  // Discard all items
  const discardAll = useCallback(async () => {
    await offlineQueue.clear();
    await refreshQueue();
    toast({
      title: 'Queue Cleared',
      description: 'All queued actions were discarded.',
    });
  }, [toast, refreshQueue]);

  // Auto-sync on mount if online and has pending
  useEffect(() => {
    if (isOnline && queuedActions.some((a) => a.status === 'queued' || a.status === 'failed')) {
      syncNow();
    }
  }, [isOnline]);

  // Periodic retry for failed items
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline && !syncingRef.current) {
        const hasPending = queuedActions.some(
          (a) => (a.status === 'queued' || a.status === 'failed') && (!a.nextRetryAt || new Date(a.nextRetryAt) <= new Date())
        );
        if (hasPending) {
          syncNow();
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [isOnline, queuedActions, syncNow]);

  return {
    queuedActions,
    isOnline,
    isSyncing,
    hasQueuedActions: queuedActions.length > 0,
    pendingCount: queuedActions.filter((a) => a.status === 'queued' || a.status === 'replaying').length,
    failedCount: queuedActions.filter((a) => a.status === 'failed').length,
    syncNow,
    discardItem,
    discardAll,
    refreshQueue,
  };
}
