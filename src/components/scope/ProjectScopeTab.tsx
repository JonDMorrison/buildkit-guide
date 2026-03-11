import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ScopeItemRow } from './ScopeItemRow';
import { ScopeTaskPreviewModal } from './ScopeTaskPreviewModal';
import { previewScopeTaskGeneration, PreviewItem } from '@/lib/scopeTaskGeneration';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuthRole } from '@/hooks/useAuthRole';
import { Plus, Wand2, RefreshCw, FileText } from 'lucide-react';

interface ProjectScopeTabProps {
  projectId: string;
}

export interface ScopeItem {
  id: string;
  name: string;
  description: string | null;
  item_type: string;
  planned_hours: number;
  planned_total: number;
  sort_order: number;
  organization_id: string;
  is_archived: boolean;
  archived_at: string | null;
}

export const ProjectScopeTab = ({ projectId }: ProjectScopeTabProps) => {
  const { toast } = useToast();
  const { isAdmin, isPM, loading: roleLoading } = useAuthRole(projectId);
  const canEdit = isAdmin || isPM();

  const [items, setItems] = useState<ScopeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [previewMode, setPreviewMode] = useState<'create_missing' | 'sync_existing'>('create_missing');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [hasManualTasks, setHasManualTasks] = useState(false);

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('project_scope_items')
      .select('id,name,description,item_type,planned_hours,planned_total,sort_order,organization_id,is_archived,archived_at')
      .eq('project_id', projectId)
      .order('sort_order');

    if (error) {
      toast({ title: 'Error loading scope items', description: error.message, variant: 'destructive' });
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }, [projectId, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAdd = async () => {
    setAdding(true);
    try {
      const { data: proj } = await supabase
        .from('projects')
        .select('organization_id')
        .eq('id', projectId)
        .single();

      if (!proj) throw new Error('Project not found');

      const { error } = await supabase.from('project_scope_items').insert({
        project_id: projectId,
        organization_id: proj.organization_id,
        name: 'New Scope Item',
        item_type: 'labor',
        source_type: 'manual',
        sort_order: items.length,
      });

      if (error) throw error;
      fetchItems();
    } catch (err: any) {
      toast({ title: 'Error adding scope item', description: err.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const { error } = await supabase
        .from('project_scope_items')
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Scope item archived' });
      fetchItems();
    } catch (err: any) {
      toast({ title: 'Error archiving scope item', description: err.message, variant: 'destructive' });
    }
  };

  const handleUnarchive = async (id: string) => {
    try {
      const { error } = await supabase
        .from('project_scope_items')
        .update({ is_archived: false, archived_at: null })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Scope item restored' });
      fetchItems();
    } catch (err: any) {
      toast({ title: 'Error restoring scope item', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('project_scope_items').delete().eq('id', deleteId);
      if (error) {
        // Trigger will block if linked tasks exist
        if (error.message.includes('linked tasks')) {
          toast({
            title: 'Cannot delete',
            description: 'This scope item has linked tasks. Archive it instead.',
            variant: 'destructive',
          });
          setDeleteId(null);
          return;
        }
        throw error;
      }
      setDeleteId(null);
      fetchItems();
    } catch (err: any) {
      toast({ title: 'Error deleting scope item', description: err.message, variant: 'destructive' });
    }
  };

  const handlePreview = async (mode: 'create_missing' | 'sync_existing') => {
    setPreviewLoading(true);
    setPreviewMode(mode);
    try {
      const [preview, manualCheck] = await Promise.all([
        previewScopeTaskGeneration(projectId, mode),
        supabase
          .from('tasks')
          .select('id',{ count: 'exact',head: true })
          .eq('project_id',projectId)
          .is('scope_item_id',null)
          .eq('is_deleted',false),]);
      setPreviewItems(preview);
      setHasManualTasks((manualCheck.count || 0) > 0);
      setPreviewOpen(true);
    } catch (err: any) {
      toast({ title: 'Error loading preview',description: err.message,variant: 'destructive' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const visibleItems = showArchived ? items : items.filter((i) => !i.is_archived);
  const archivedCount = items.filter((i) => i.is_archived).length;
  const activeTaskItems = items.filter((i) => i.item_type === 'labor' && !i.is_archived);
  const hasTaskItems = activeTaskItems.length > 0;

  if (loading || roleLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <>
            <Button onClick={handleAdd} loading={adding} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Scope Item
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePreview('create_missing')}
              disabled={!hasTaskItems}
              loading={previewLoading && previewMode === 'create_missing'}
            >
              <Wand2 className="h-4 w-4 mr-1" />
              Generate Tasks
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreview('sync_existing')}
              disabled={!hasTaskItems}
              loading={previewLoading && previewMode === 'sync_existing'}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Sync Tasks
            </Button>
          </>
        )}

        {archivedCount > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="show-archived" className="text-sm text-muted-foreground cursor-pointer">
              Show archived ({archivedCount})
            </Label>
          </div>
        )}
      </div>

      {/* Scope items table */}
      {visibleItems.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title={showArchived ? "No scope items" : "No active scope items"}
          description={
            archivedCount > 0 && !showArchived
              ? `${archivedCount} archived item${archivedCount !== 1 ? 's' : ''} hidden. Toggle "Show archived" to view them.`
              : "Add scope items to define the project's work breakdown, then generate tasks from them."
          }
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Scope Items ({visibleItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Planned Hours</TableHead>
                  <TableHead className="text-right">Planned Total</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.map((item) => (
                  <ScopeItemRow
                    key={item.id}
                    item={item}
                    canEdit={canEdit}
                    onUpdate={fetchItems}
                    onArchive={handleArchive}
                    onUnarchive={handleUnarchive}
                    onDelete={setDeleteId}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Delete confirm — only for items with no linked tasks */}
      <ConfirmDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        title="Delete scope item?"
        description="This will permanently remove this scope item. This is only allowed if no tasks are linked to it."
        onConfirm={handleDelete}
        variant="destructive"
      />

      {/* Preview modal */}
      <ScopeTaskPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        items={previewItems}
        mode={previewMode}
        projectId={projectId}
        hasManualTasks={hasManualTasks}
        onComplete={fetchItems}
      />
    </div>
  );
};
