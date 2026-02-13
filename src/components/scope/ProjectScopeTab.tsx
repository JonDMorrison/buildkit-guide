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

interface ScopeItem {
  id: string;
  name: string;
  description: string | null;
  item_type: string;
  planned_hours: number;
  planned_total: number;
  sort_order: number;
  organization_id: string;
}

export const ProjectScopeTab = ({ projectId }: ProjectScopeTabProps) => {
  const { toast } = useToast();
  const { isAdmin, isPM, loading: roleLoading } = useAuthRole(projectId);
  const canEdit = isAdmin || isPM();

  const [items, setItems] = useState<ScopeItem[]>([]);
  const [loading, setLoading] = useState(true);
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
      .select('id, name, description, item_type, planned_hours, planned_total, sort_order, organization_id')
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
      // Get org_id from project
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
        item_type: 'task',
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

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('project_scope_items').delete().eq('id', deleteId);
      if (error) throw error;
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
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .is('scope_item_id', null)
          .eq('is_deleted', false),
      ]);
      setPreviewItems(preview);
      setHasManualTasks((manualCheck.count || 0) > 0);
      setPreviewOpen(true);
    } catch (err: any) {
      toast({ title: 'Error loading preview', description: err.message, variant: 'destructive' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const taskScopeItems = items.filter((i) => i.item_type === 'task');
  const hasTaskItems = taskScopeItems.length > 0;

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
      </div>

      {/* Scope items table */}
      {items.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No scope items"
          description="Add scope items to define the project's work breakdown, then generate tasks from them."
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Scope Items ({items.length})
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
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <ScopeItemRow
                    key={item.id}
                    item={item}
                    canEdit={canEdit}
                    onUpdate={fetchItems}
                    onDelete={setDeleteId}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        title="Delete scope item?"
        description="This will remove this scope item. Any tasks already generated from it will keep their scope_item_id set to null."
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
