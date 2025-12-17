import { useState } from 'react';
import { TaskDetailData } from './index';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Save, X } from 'lucide-react';

interface TaskDescriptionProps {
  task: TaskDetailData;
  editMode: boolean;
  canEdit: boolean;
  onUpdate: (updates: Partial<TaskDetailData>) => void;
}

export const TaskDescription = ({ 
  task, 
  editMode, 
  canEdit, 
  onUpdate 
}: TaskDescriptionProps) => {
  const { toast } = useToast();
  const [localDescription, setLocalDescription] = useState(task.description || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ description: localDescription.trim() || null })
        .eq('id', task.id);

      if (error) throw error;
      
      onUpdate({ description: localDescription.trim() || null });
      toast({ title: 'Description updated' });
    } catch (err: any) {
      toast({
        title: 'Error saving description',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanged = localDescription !== (task.description || '');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Description
        </div>
        {editMode && canEdit && hasChanged && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocalDescription(task.description || '')}
              className="h-7 px-2"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="h-7 px-2"
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              Save
            </Button>
          </div>
        )}
      </div>

      {editMode && canEdit ? (
        <Textarea
          value={localDescription}
          onChange={(e) => setLocalDescription(e.target.value)}
          placeholder="Add a description..."
          className="min-h-[80px] resize-none"
        />
      ) : (
        <div className="rounded-lg bg-muted/50 p-3">
          {task.description ? (
            <p className="text-sm whitespace-pre-wrap">{task.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No description provided</p>
          )}
        </div>
      )}
    </div>
  );
};
