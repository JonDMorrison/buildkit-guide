import { useState } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, Trash2, AlertTriangle, Clock, LogIn, LogOut, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { QueuedTimeAction } from '@/lib/offlineQueue';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface PendingSyncPanelProps {
  queuedActions: QueuedTimeAction[];
  isOnline: boolean;
  isSyncing: boolean;
  onSync: () => Promise<void>;
  onDiscard: (id: string) => Promise<void>;
  onDiscardAll: () => Promise<void>;
}

export function PendingSyncPanel({
  queuedActions,
  isOnline,
  isSyncing,
  onSync,
  onDiscard,
  onDiscardAll,
}: PendingSyncPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (queuedActions.length === 0) return null;

  const pendingCount = queuedActions.filter(a => a.status === 'queued' || a.status === 'replaying').length;
  const failedCount = queuedActions.filter(a => a.status === 'failed').length;

  const getStatusBadge = (action: QueuedTimeAction) => {
    switch (action.status) {
      case 'queued':
        return <Badge variant="secondary" className="text-xs">Queued</Badge>;
      case 'replaying':
        return <Badge className="text-xs bg-blue-500">Syncing...</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-xs">Failed</Badge>;
      case 'succeeded':
        return <Badge className="text-xs bg-green-500">Synced</Badge>;
    }
  };

  const getActionIcon = (actionType: string) => {
    return actionType === 'check_in' 
      ? <LogIn className="h-4 w-4 text-primary" />
      : <LogOut className="h-4 w-4 text-destructive" />;
  };

  return (
    <Card className={cn(
      "border-2 transition-colors",
      failedCount > 0 ? "border-destructive/50 bg-destructive/5" : "border-blue-500/50 bg-blue-500/5"
    )}>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CardContent className="p-3">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-auto p-1 hover:bg-transparent">
                <div className="flex items-center gap-2">
                  <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                  <span className="font-medium text-sm">
                    {pendingCount > 0 && `${pendingCount} pending`}
                    {pendingCount > 0 && failedCount > 0 && ', '}
                    {failedCount > 0 && <span className="text-destructive">{failedCount} failed</span>}
                  </span>
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </Button>
            </CollapsibleTrigger>

            <div className="flex items-center gap-2">
              {isOnline && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onSync} 
                  disabled={isSyncing}
                  className="h-8"
                >
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              )}
            </div>
          </div>

          {/* Expanded content */}
          <CollapsibleContent className="pt-3 space-y-2">
            {queuedActions.map((action) => (
              <div 
                key={action.id} 
                className="flex items-start gap-3 p-2 rounded-lg bg-background/50 border"
              >
                <div className="mt-0.5">
                  {getActionIcon(action.actionType)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm capitalize">
                      {action.actionType.replace('_', ' ')}
                    </span>
                    {getStatusBadge(action)}
                  </div>

                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(action.createdAt), { addSuffix: true })}
                  </p>

                  {action.lastError && (
                    <div className="flex items-start gap-1 mt-1 text-xs text-destructive">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{action.lastError}</span>
                    </div>
                  )}

                  {action.nextRetryAt && action.status === 'failed' && new Date(action.nextRetryAt) > new Date() && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Retry {formatDistanceToNow(new Date(action.nextRetryAt), { addSuffix: true })}</span>
                    </div>
                  )}
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Discard this action?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This {action.actionType.replace('_', ' ')} will not be synced. You'll need to {action.actionType === 'check_in' ? 'check in' : 'check out'} again.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDiscard(action.id)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Discard
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}

            {/* Clear all button */}
            {queuedActions.length > 1 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All ({queuedActions.length})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all queued actions?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All {queuedActions.length} queued time actions will be discarded. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDiscardAll}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
