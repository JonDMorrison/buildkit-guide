import { useState } from 'react';
import { TaskDetailData } from './index';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Save, X, CheckCircle2 } from 'lucide-react';

interface TaskActionsProps {
  task: TaskDetailData;
  editMode: boolean;
  isWorker: boolean;
  onEditModeChange: (edit: boolean) => void;
  onClose: () => void;
  onTaskUpdated: () => void;
}

export const TaskActions = ({
  task,
  editMode,
  isWorker,
  onEditModeChange,
  onClose,
  onTaskUpdated,
}: TaskActionsProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const handleRequestReview = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          review_requested_at: new Date().toISOString(),
          review_requested_by: user.id,
        })
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: 'Review requested',
        description: 'PM/Foreman has been notified to review this task.',
      });
      onTaskUpdated();
    } catch (err: any) {
      toast({
        title: 'Error requesting review',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sticky bottom-0 border-t bg-background px-4 py-3">
      <div className="flex gap-2">
        {editMode ? (
          <>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onEditModeChange(false)}
              disabled={saving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                // TODO: Implement save logic
                onEditModeChange(false);
              }}
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </>
        ) : (
          <>
            {/* Worker: Request Review */}
            {isWorker && !task.review_requested_at && task.status !== 'done' && (
              <Button
                className="flex-1"
                onClick={handleRequestReview}
                disabled={saving}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Request Review
              </Button>
            )}
            
            {/* Worker: Already requested */}
            {isWorker && task.review_requested_at && (
              <Badge 
                variant="secondary" 
                className="flex-1 justify-center py-2 bg-amber-500/10 text-amber-600"
              >
                Review Requested
              </Badge>
            )}
            
            {/* Close button */}
            <Button
              variant="outline"
              className={isWorker ? 'flex-1' : 'w-full'}
              onClick={onClose}
            >
              Close
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
