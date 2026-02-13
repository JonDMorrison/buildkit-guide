import { useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Check, X, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ScopeItem {
  id: string;
  name: string;
  description: string | null;
  item_type: string;
  planned_hours: number;
  planned_total: number;
  sort_order: number;
}

interface ScopeItemRowProps {
  item: ScopeItem;
  canEdit: boolean;
  onUpdate: () => void;
  onDelete: (id: string) => void;
}

export const ScopeItemRow = ({ item, canEdit, onUpdate, onDelete }: ScopeItemRowProps) => {
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
    <TableRow>
      <TableCell className="font-medium">{item.name}</TableCell>
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
            <Button variant="ghost" size="icon" onClick={() => setEditing(true)} className="h-8 w-8">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(item.id)}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
};
