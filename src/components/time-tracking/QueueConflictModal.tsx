import { AlertTriangle, ArrowRight } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { QueuedTimeAction } from '@/lib/offlineQueue';

interface QueueConflictModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflictingAction: QueuedTimeAction | null;
  onSyncNow: () => Promise<void>;
  onDiscard: () => Promise<void>;
  isSyncing: boolean;
}

export function QueueConflictModal({
  open,
  onOpenChange,
  conflictingAction,
  onSyncNow,
  onDiscard,
  isSyncing,
}: QueueConflictModalProps) {
  if (!conflictingAction) return null;

  const isPendingCheckOut = conflictingAction.actionType === 'check_out';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full bg-amber-100 p-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <AlertDialogTitle>Pending Action Conflict</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3">
            <p>
              You have a pending <strong>{conflictingAction.actionType.replace('_', ' ')}</strong> that hasn't been synced yet.
            </p>
            
            {isPendingCheckOut ? (
              <p>
                You need to sync your check-out before you can check in again. Otherwise, you'll have conflicting time entries.
              </p>
            ) : (
              <p>
                You need to sync or discard your pending check-in before starting a new one.
              </p>
            )}

            <div className="bg-muted rounded-lg p-3 text-sm">
              <p className="font-medium text-foreground mb-1">What would you like to do?</p>
              <ul className="space-y-1 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 shrink-0" />
                  <span><strong>Sync Now</strong> - Try to sync the pending action</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 shrink-0" />
                  <span><strong>Discard</strong> - Remove the pending action and proceed</span>
                </li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="outline"
            onClick={async () => {
              await onDiscard();
              onOpenChange(false);
            }}
            className="text-destructive hover:text-destructive"
          >
            Discard Pending
          </Button>
          <AlertDialogAction
            onClick={async () => {
              await onSyncNow();
              // Don't close - let sync complete
            }}
            disabled={isSyncing}
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
