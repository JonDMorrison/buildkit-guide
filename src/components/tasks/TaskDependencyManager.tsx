import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { StatusBadge } from '../StatusBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Link2, Plus, X, Loader2 } from 'lucide-react';

interface TaskDependencyManagerProps {
  taskId: string;
  projectId: string;
  dependencies: Array<{
    id: string;
    depends_on_task: {
      id: string;
      title: string;
      status: string;
    };
  }>;
  onDependenciesChanged: () => void;
  canEdit: boolean;
}

export const TaskDependencyManager = ({
  taskId,
  projectId,
  dependencies,
  onDependenciesChanged,
  canEdit,
}: TaskDependencyManagerProps) => {
  const { toast } = useToast();
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailableTasks();
  }, [projectId, taskId, dependencies]);

  const fetchAvailableTasks = async () => {
    try {
      // Fetch all tasks from the same project except current task
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .neq('id', taskId)
        .order('title');

      if (error) throw error;

      // Filter out tasks that are already dependencies
      const existingDepIds = dependencies.map((d) => d.depends_on_task.id);
      const filtered = data?.filter((t) => !existingDepIds.includes(t.id)) || [];
      setAvailableTasks(filtered);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
    }
  };

  const handleAddDependency = async () => {
    if (!selectedTaskId) return;

    setLoading(true);
    try {
      // Check for circular dependency
      const { data: reverseCheck } = await supabase
        .from('task_dependencies')
        .select('id')
        .eq('task_id', selectedTaskId)
        .eq('depends_on_task_id', taskId)
        .maybeSingle();

      if (reverseCheck) {
        toast({
          title: 'Cannot add dependency',
          description: 'This would create a circular dependency',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('task_dependencies').insert({
        task_id: taskId,
        depends_on_task_id: selectedTaskId,
      });

      if (error) throw error;

      toast({
        title: 'Dependency added',
        description: 'Task dependency has been added successfully',
      });

      setSelectedTaskId('');
      onDependenciesChanged();
    } catch (error: any) {
      toast({
        title: 'Error adding dependency',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDependency = async (dependencyId: string) => {
    setRemoving(dependencyId);
    try {
      const { error } = await supabase
        .from('task_dependencies')
        .delete()
        .eq('id', dependencyId);

      if (error) throw error;

      toast({
        title: 'Dependency removed',
        description: 'Task dependency has been removed',
      });

      onDependenciesChanged();
    } catch (error: any) {
      toast({
        title: 'Error removing dependency',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Dependencies</h3>
        {dependencies.length > 0 && (
          <Badge variant="secondary">{dependencies.length}</Badge>
        )}
      </div>

      {dependencies.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-3">
          No dependencies. This task can start anytime.
        </p>
      ) : (
        <div className="space-y-2 mb-3">
          {dependencies.map((dep) => (
            <div
              key={dep.id}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {dep.depends_on_task?.title}
                </p>
                <div className="mt-1">
                  <StatusBadge
                    status={
                      dep.depends_on_task?.status === 'done'
                        ? 'complete'
                        : dep.depends_on_task?.status === 'blocked'
                          ? 'blocked'
                          : 'progress'
                    }
                    label={dep.depends_on_task?.status}
                  />
                </div>
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveDependency(dep.id)}
                  disabled={removing === dep.id}
                >
                  {removing === dep.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && availableTasks.length > 0 && (
        <div className="flex gap-2">
          <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
            <SelectTrigger className="flex-1 bg-card border-border">
              <SelectValue placeholder="Add dependency..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-border z-50 max-h-[200px]">
              {availableTasks.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  {task.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleAddDependency}
            disabled={!selectedTaskId || loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
