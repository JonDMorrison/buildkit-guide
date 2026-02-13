import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Clock, Eye } from 'lucide-react';
import { formatNumber } from '@/lib/formatters';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ScopeItemVarianceProps {
  projectId: string;
}

interface ScopeItemRow {
  id: string;
  title: string;
  planned_hours: number;
  actual_hours: number;
  delta: number;
  task_count: number;
}

interface UnassignedEntry {
  id: string;
  user_name: string;
  check_in_at: string;
  duration_hours: number;
}

export function ScopeItemVarianceTable({ projectId }: ScopeItemVarianceProps) {
  const [rows, setRows] = useState<ScopeItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unassignedHours, setUnassignedHours] = useState(0);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [unassignedEntries, setUnassignedEntries] = useState<UnassignedEntry[]>([]);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch scope items with linked tasks
        const { data: scopeItems } = await supabase
          .from('project_scope_items')
          .select('id, name, planned_hours')
          .eq('project_id', projectId)
          .eq('item_type', 'task')
          .eq('is_archived', false)
          .order('sort_order');

        if (!scopeItems?.length) {
          setRows([]);
          setLoading(false);
          return;
        }

        // Fetch tasks linked to scope items
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, scope_item_id')
          .eq('project_id', projectId)
          .not('scope_item_id', 'is', null);

        const tasksByScope = new Map<string, string[]>();
        for (const t of tasks || []) {
          if (!t.scope_item_id) continue;
          const arr = tasksByScope.get(t.scope_item_id) || [];
          arr.push(t.id);
          tasksByScope.set(t.scope_item_id, arr);
        }

        // Fetch time entries WITH task_id for this project
        const allTaskIds = Array.from(tasksByScope.values()).flat();
        let timeByTask = new Map<string, number>();
        
        if (allTaskIds.length > 0) {
          // Batch in groups of 100
          for (let i = 0; i < allTaskIds.length; i += 100) {
            const batch = allTaskIds.slice(i, i + 100);
            const { data: entries } = await supabase
              .from('time_entries')
              .select('task_id, duration_hours')
              .eq('project_id', projectId)
              .eq('status', 'closed')
              .in('task_id', batch);
            
            for (const e of entries || []) {
              if (!e.task_id) continue;
              timeByTask.set(e.task_id, (timeByTask.get(e.task_id) || 0) + (Number(e.duration_hours) || 0));
            }
          }
        }

        // Build rows
        const result: ScopeItemRow[] = scopeItems.map((si) => {
          const linkedTasks = tasksByScope.get(si.id) || [];
          const actualHours = linkedTasks.reduce((sum, tid) => sum + (timeByTask.get(tid) || 0), 0);
          const planned = Number(si.planned_hours) || 0;
          return {
            id: si.id,
            title: si.name,
            planned_hours: planned,
            actual_hours: actualHours,
            delta: planned - actualHours,
            task_count: linkedTasks.length,
          };
        });

        setRows(result);

        // Count unassigned time entries (task_id is null)
        const { count, data: unassignedData } = await supabase
          .from('time_entries')
          .select('duration_hours', { count: 'exact' })
          .eq('project_id', projectId)
          .eq('status', 'closed')
          .is('task_id', null);

        const totalUnassigned = (unassignedData || []).reduce(
          (s, e) => s + (Number(e.duration_hours) || 0), 0
        );
        setUnassignedHours(totalUnassigned);
        setUnassignedCount(count || 0);
      } catch (err) {
        console.error('ScopeItemVariance fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  const handleViewUnassigned = async () => {
    setShowUnassigned(true);
    setLoadingUnassigned(true);
    try {
      const { data } = await supabase
        .from('time_entries')
        .select('id, user_id, check_in_at, duration_hours')
        .eq('project_id', projectId)
        .eq('status', 'closed')
        .is('task_id', null)
        .order('check_in_at', { ascending: false })
        .limit(50);

      // Get user names
      const userIds = [...new Set((data || []).map(e => e.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const nameMap = new Map((profiles || []).map(p => [p.id, p.full_name || 'Unknown']));

      setUnassignedEntries((data || []).map(e => ({
        id: e.id,
        user_name: nameMap.get(e.user_id) || 'Unknown',
        check_in_at: e.check_in_at,
        duration_hours: Number(e.duration_hours) || 0,
      })));
    } catch (err) {
      console.error('Unassigned entries fetch error:', err);
    } finally {
      setLoadingUnassigned(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-48" />;
  }

  if (rows.length === 0) {
    return null; // Don't show section if no scope items
  }

  return (
    <>
      {/* Unassigned hours warning */}
      {unassignedCount > 0 && (
        <Alert className="mb-4">
          <Clock className="h-4 w-4" />
          <AlertTitle>Unassigned Time Entries</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              {formatNumber(unassignedHours)} hours ({unassignedCount} entries) are not assigned to any task. Scope-level hours may be incomplete.
            </span>
            <Button variant="outline" size="sm" className="ml-4 shrink-0" onClick={handleViewUnassigned}>
              <Eye className="h-4 w-4 mr-1" />
              View unassigned
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scope Item Variance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope Item</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right">Planned</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Delta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const isOver = r.delta < 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="text-xs">{r.task_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(r.planned_hours)}h
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(r.actual_hours)}h
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${isOver ? 'text-destructive' : r.delta > 0 ? 'text-status-complete' : ''}`}>
                      {r.delta > 0 ? '+' : ''}{formatNumber(r.delta)}h
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Unassigned entries dialog */}
      <Dialog open={showUnassigned} onOpenChange={setShowUnassigned}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Unassigned Time Entries</DialogTitle>
          </DialogHeader>
          {loadingUnassigned ? (
            <Skeleton className="h-32" />
          ) : unassignedEntries.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No unassigned entries found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassignedEntries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.user_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(e.check_in_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.duration_hours.toFixed(1)}h
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
