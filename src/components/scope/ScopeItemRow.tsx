import { useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Archive, ArchiveRestore, Trash2, Check, X, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ScopeItem } from './ProjectScopeTab';

interface ScopeItemRowProps {
  item: ScopeItem;
  canEdit: boolean;
  onUpdate: () => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export const ScopeItemRow = ({ item, canEdit, onUpdate, onArchive, onUnarchive, onDelete }: ScopeItemRowProps) => {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description || '');
  const [plannedHours, setPlannedHours] = useState(item.planned_hours.toString());
  const [sortOrder, setSortOrder] = useState(item.sort_order.toString());
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('project_scope_items')
        .update({
          name,
          description: description || null,
          planned_hours: parseFloat(plannedHours) || 0,
          sort_order: parseInt(sortOrder) || 0,
        })
        .eq('id', item.id);

      if (error) throw error;
      setEditing(false);
      onUpdate();
    } catch (err: any) {
      toast({
        title: 'Error saving scope item',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(item.name);
    setDescription(item.description || '');
    setPlannedHours(item.planned_hours.toString());
    setSortOrder(item.sort_order.toString());
    setEditing(false);
  };

  const typeVariant = (type: string): 'default' | 'secondary' | 'outline' => {
    switch (type) {
      case 'task': return 'default';
      case 'service': return 'secondary';
      default: return 'outline';
    }
  };

  if (editing) {
    return (
      <TableRow>
        <TableCell>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
        </TableCell>
        <TableCell>
          <Badge variant={typeVariant(item.item_type)} className="capitalize">
            {item.item_type}
          </Badge>
        </TableCell>
        <TableCell>
          <Input
            type="number"
            value={plannedHours}
            onChange={(e) => setPlannedHours(e.target.value)}
            className="h-9 w-20"
          />
        </TableCell>
        <TableCell className="text-right">${item.planned_total.toFixed(2)}</TableCell>
        <TableCell>
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="h-9 w-16"
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleSave} disabled={saving} className="h-8 w-8">
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleCancel} disabled={saving} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className={item.is_archived ? 'opacity-60' : ''}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {item.name}
          {item.is_archived && (
            <Badge variant="outline" className="text-xs">
              Archived
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={typeVariant(item.item_type)} className="capitalize">
          {item.item_type}
        </Badge>
      </TableCell>
      <TableCell>{item.planned_hours}h</TableCell>
      <TableCell className="text-right">${item.planned_total.toFixed(2)}</TableCell>
      <TableCell>{item.sort_order}</TableCell>
      <TableCell>
        {canEdit && (
          <div className="flex items-center gap-1">
            {!item.is_archived && (
              <>
                <Button variant="ghost" size="icon" onClick={() => setEditing(true)} className="h-8 w-8">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onArchive(item.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Archive"
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </>
            )}
            {item.is_archived && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onUnarchive(item.id)}
                  className="h-8 w-8"
                  title="Restore"
                >
                  <ArchiveRestore className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(item.id)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  title="Delete permanently"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
};
