import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ListChecks, Plus, Trash2, Loader2 } from 'lucide-react';

interface ChecklistItem {
  id: string;
  title: string;
  is_completed: boolean;
  sort_order: number;
}

interface TaskChecklistProps {
  taskId: string;
  canEdit: boolean;
}

export const TaskChecklist = ({ taskId, canEdit }: TaskChecklistProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  // Fetch checklist items from database
  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('task_checklist_items')
          .select('id,title,is_completed,sort_order')
          .eq('task_id', taskId)
          .order('sort_order', { ascending: true });

        if (error) throw error;
        setItems(data || []);
      } catch (err: any) {
        console.error('Error fetching checklist:', err);
        toast({
          title: 'Error loading checklist',
          description: err.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [taskId, toast]);

  const completedCount = items.filter(i => i.is_completed).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  const handleAddItem = async () => {
    if (!newItemTitle.trim() || !user) return;
    
    setSavingItemId('new');
    try {
      const { data, error } = await supabase
        .from('task_checklist_items')
        .insert({
          task_id: taskId,
          title: newItemTitle.trim(),
          is_completed: false,
          sort_order: items.length,
        })
        .select('id,title,is_completed,sort_order')
        .single();

      if (error) throw error;

      setItems([...items, data]);
      setNewItemTitle('');
      setAdding(false);
    } catch (err: any) {
      toast({
        title: 'Error adding item',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingItemId(null);
    }
  };

  const handleToggleItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item || !user) return;

    const newCompleted = !item.is_completed;
    
    // Optimistic update
    setItems(items.map(i => 
      i.id === itemId ? { ...i, is_completed: newCompleted } : i
    ));

    setSavingItemId(itemId);
    try {
      const { error } = await supabase
        .from('task_checklist_items')
        .update({
          is_completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
          completed_by: newCompleted ? user.id : null,
        })
        .eq('id', itemId);

      if (error) throw error;
    } catch (err: any) {
      // Revert on error
      setItems(items.map(i => 
        i.id === itemId ? { ...i, is_completed: !newCompleted } : i
      ));
      toast({
        title: 'Error updating item',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingItemId(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const itemToDelete = items.find(i => i.id === itemId);
    if (!itemToDelete) return;

    // Optimistic update
    setItems(items.filter(item => item.id !== itemId));

    setSavingItemId(itemId);
    try {
      const { error } = await supabase
        .from('task_checklist_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    } catch (err: any) {
      // Revert on error
      setItems([...items, itemToDelete].sort((a, b) => a.sort_order - b.sort_order));
      toast({
        title: 'Error deleting item',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingItemId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddItem();
    } else if (e.key === 'Escape') {
      setAdding(false);
      setNewItemTitle('');
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          Checklist
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          Checklist
          {items.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {completedCount}/{items.length}
            </Badge>
          )}
        </div>
        {canEdit && !adding && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAdding(true)}
            className="h-7 px-2"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Item
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      {items.length > 0 && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Checklist Items */}
      {items.length === 0 && !adding ? (
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-sm text-muted-foreground">No checklist items</p>
          {canEdit && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setAdding(true)}
              className="mt-1 h-auto p-0"
            >
              Add a checklist item
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group"
            >
              <Checkbox
                checked={item.is_completed}
                onCheckedChange={() => handleToggleItem(item.id)}
                disabled={!canEdit || savingItemId === item.id}
              />
              <span className={`flex-1 text-sm ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                {item.title}
              </span>
              {savingItemId === item.id && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              {canEdit && savingItemId !== item.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteItem(item.id)}
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add New Item Input */}
      {adding && (
        <div className="flex items-center gap-2 p-2">
          <Checkbox disabled />
          <Input
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add checklist item..."
            className="h-8 text-sm"
            autoFocus
            disabled={savingItemId === 'new'}
          />
          <Button 
            size="sm" 
            className="h-8" 
            onClick={handleAddItem}
            disabled={savingItemId === 'new' || !newItemTitle.trim()}
          >
            {savingItemId === 'new' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              'Add'
            )}
          </Button>
        </div>
      )}
    </div>
  );
};