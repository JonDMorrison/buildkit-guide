import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Plus, RefreshCw, Minus } from 'lucide-react';
import { PreviewItem, generateTasksFromScope } from '@/lib/scopeTaskGeneration';
import { useToast } from '@/hooks/use-toast';

interface ScopeTaskPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PreviewItem[];
  mode: 'create_missing' | 'sync_existing';
  projectId: string;
  hasManualTasks: boolean;
  onComplete: () => void;
}

export const ScopeTaskPreviewModal = ({
  open,
  onOpenChange,
  items,
  mode,
  projectId,
  hasManualTasks,
  onComplete,
}: ScopeTaskPreviewModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const createCount = items.filter((i) => i.action === 'create').length;
  const updateCount = items.filter((i) => i.action === 'update').length;
  const skipCount = items.filter((i) => i.action === 'skip').length;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const result = await generateTasksFromScope(projectId, mode);
      toast({
        title: mode === 'create_missing' ? 'Tasks generated' : 'Tasks synced',
        description: `${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
      });
      onComplete();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const actionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return <Plus className="h-3.5 w-3.5" />;
      case 'update':
        return <RefreshCw className="h-3.5 w-3.5" />;
      default:
        return <Minus className="h-3.5 w-3.5" />;
    }
  };

  const actionVariant = (action: string): 'default' | 'secondary' | 'outline' => {
    switch (action) {
      case 'create':
        return 'default';
      case 'update':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create_missing' ? 'Generate Tasks Preview' : 'Sync Tasks Preview'}
          </DialogTitle>
          <DialogDescription>
            Review the actions below before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 text-sm">
          {createCount > 0 && (
            <span className="text-primary font-medium">{createCount} to create</span>
          )}
          {updateCount > 0 && (
            <span className="text-secondary-foreground font-medium">{updateCount} to update</span>
          )}
          {skipCount > 0 && (
            <span className="text-muted-foreground">{skipCount} up-to-date</span>
          )}
        </div>

        {hasManualTasks && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This project has manually-created tasks that won't be affected by this operation.
            </AlertDescription>
          </Alert>
        )}

        <div className="max-h-64 overflow-y-auto space-y-2">
          {items.map((item) => (
            <div
              key={item.scope_item_id}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
            >
              <span className="text-sm truncate flex-1 mr-3">{item.scope_item_name}</span>
              <Badge variant={actionVariant(item.action)} className="flex items-center gap-1 capitalize">
                {actionIcon(item.action)}
                {item.action}
              </Badge>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No scope items of type "task" found.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            loading={loading}
            disabled={createCount + updateCount === 0}
          >
            {mode === 'create_missing' ? 'Generate Tasks' : 'Sync Tasks'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
