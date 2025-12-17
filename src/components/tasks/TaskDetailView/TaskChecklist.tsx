import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ListChecks, Plus, Trash2 } from 'lucide-react';

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
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [adding, setAdding] = useState(false);

  // Check if the table exists - for now we'll simulate with local state
  // since we haven't created the task_checklist_items table yet
  useEffect(() => {
    // TODO: Fetch from database once table is created
    setLoading(false);
  }, [taskId]);

  const completedCount = items.filter(i => i.is_completed).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  const handleAddItem = () => {
    if (!newItemTitle.trim()) return;
    
    const newItem: ChecklistItem = {
      id: `temp-${Date.now()}`,
      title: newItemTitle.trim(),
      is_completed: false,
      sort_order: items.length,
    };
    
    setItems([...items, newItem]);
    setNewItemTitle('');
    setAdding(false);
  };

  const handleToggleItem = (itemId: string) => {
    setItems(items.map(item => 
      item.id === itemId 
        ? { ...item, is_completed: !item.is_completed }
        : item
    ));
  };

  const handleDeleteItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddItem();
    } else if (e.key === 'Escape') {
      setAdding(false);
      setNewItemTitle('');
    }
  };

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
                disabled={!canEdit}
              />
              <span className={`flex-1 text-sm ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                {item.title}
              </span>
              {canEdit && (
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
          />
          <Button size="sm" className="h-8" onClick={handleAddItem}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
};
