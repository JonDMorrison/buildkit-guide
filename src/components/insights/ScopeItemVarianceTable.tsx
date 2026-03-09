import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Clock, Eye, Info } from 'lucide-react';
import { formatNumber } from '@/lib/formatters';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ScopeItemVarianceProps {
  projectId: string;
  canEdit?: boolean;
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
  user_id: string;
  user_name: string;
  check_in_at: string;
  duration_hours: number;
  notes: string | null;
}

interface CoverageStats {
  totalProjectHours: number;
  taskLinkedHours: number;
  coveragePercent: number;
  unassignedHours: number;
  unassignedCount: number;
}

export function ScopeItemVarianceTable({ projectId, canEdit = false }: ScopeItemVarianceProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<ScopeItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [coverage, setCoverage] = useState<CoverageStats>({
    totalProjectHours: 0, taskLinkedHours: 0, coveragePercent: 0,
    unassignedHours: 0, unassignedCount: 0,
  });
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [unassignedEntries, setUnassignedEntries] = useState<UnassignedEntry[]>([]);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const [projectTasks, setProjectTasks] = useState<{ id: string; title: string }[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Parallel: scope items, tasks, RPC actual hours, coverage totals
        const [scopeRes, tasksRes, actualRes, totalRes, unassignedRes] = await Promise.all([
          supabase
            .from('project_scope_items')
            .select('id, name, planned_hours')
            .eq('project_id', projectId)
            .eq('item_type', 'labor')
            .eq('is_archived', false)
            .order('sort_order'),
          supabase
            .from('tasks')
            .select('id, scope_item_id')
            .eq('project_id', projectId)
            .not('scope_item_id', 'is', null),
          // RPC: server-side aggregation — no client-side IN() needed
          (supabase.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>
          ) => Promise<{ data: unknown; error: unknown }>)('project_task_actual_hours', { p_project_id: projectId }),
          // Total project hours (all closed entries)
          supabase
            .from('time_entries')
            .select('duration_hours, task_id')
            .eq('project_id', projectId)
            .eq('status', 'closed')
            .not('duration_hours', 'is', null),
          // Unassigned count
          supabase
            .from('time_entries')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('status', 'closed')
            .not('duration_hours', 'is', null)
            .is('task_id', null),
        ]);

        // Build task→scope mapping
        const tasksByScope = new Map<string, string[]>();
        for (const t of tasksRes.data || []) {
          if (!t.scope_item_id) continue;
          const arr = tasksByScope.get(t.scope_item_id) || [];
          arr.push(t.id);
          tasksByScope.set(t.scope_item_id, arr);
        }

        // Build task→hours from RPC result
        const hoursByTask = new Map<string, number>();
        for (const row of (actualRes.data || []) as { task_id: string; actual_hours: number }[]) {
          hoursByTask.set(row.task_id, Number(row.actual_hours) || 0);
        }

        // Build scope item rows
        const result: ScopeItemRow[] = (scopeRes.data || []).map((si) => {
          const linkedTasks = tasksByScope.get(si.id) || [];
          const actualHours = linkedTasks.reduce((sum, tid) => sum + (hoursByTask.get(tid) || 0), 0);
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

        // Coverage stats from totals query
        let totalH = 0;
        let linkedH = 0;
        for (const e of totalRes.data || []) {
          const h = Number(e.duration_hours) || 0;
          totalH += h;
          if (e.task_id) linkedH += h;
        }
        const unassignedH = totalH - linkedH;
        const pct = totalH > 0 ? (linkedH / totalH) * 100 : 0;

        setCoverage({
          totalProjectHours: totalH,
          taskLinkedHours: linkedH,
          coveragePercent: pct,
          unassignedHours: unassignedH,
          unassignedCount: unassignedRes.count || 0,
        });
      } catch (err) {
        console.error('ScopeItemVariance fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  const handleViewUnassigned = useCallback(async () => {
    setShowUnassigned(true);
    setLoadingUnassigned(true);
    try {
      const [entriesRes, tasksRes] = await Promise.all([
        supabase
          .from('time_entries')
          .select('id, user_id, check_in_at, duration_hours, notes')
          .eq('project_id', projectId)
          .eq('status', 'closed')
          .not('duration_hours', 'is', null)
          .is('task_id', null)
          .order('check_in_at', { ascending: false })
          .limit(100),
        supabase
          .from('tasks')
          .select('id, title')
          .eq('project_id', projectId)
          .in('status', ['not_started', 'in_progress'])
          .order('title'),
      ]);

      const userIds = [...new Set((entriesRes.data || []).map(e => e.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] };

      const nameMap = new Map((profiles || []).map(p => [p.id, p.full_name || 'Unknown']));

      setUnassignedEntries((entriesRes.data || []).map(e => ({
        id: e.id,
        user_id: e.user_id,
        user_name: nameMap.get(e.user_id) || 'Unknown',
        check_in_at: e.check_in_at,
        duration_hours: Number(e.duration_hours) || 0,
        notes: e.notes,
      })));
      setProjectTasks(tasksRes.data || []);
    } catch (err) {
      console.error('Unassigned entries fetch error:', err);
    } finally {
      setLoadingUnassigned(false);
    }
  }, [projectId]);

  const handleAssignTask = async (entryId: string, taskId: string) => {
    setAssigningId(entryId);
    try {
      const dbRpc = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>;

      const { error } = await dbRpc('assign_time_entry_task', {
        p_time_entry_id: entryId,
        p_task_id: taskId,
      });
      if (error) throw new Error(error.message);

      // Update local state
      const entry = unassignedEntries.find(e => e.id === entryId);
      const h = entry?.duration_hours || 0;
      setUnassignedEntries(prev => prev.filter(e => e.id !== entryId));
      setCoverage(prev => {
        const newLinked = prev.taskLinkedHours + h;
        return {
          ...prev,
          taskLinkedHours: newLinked,
          unassignedHours: prev.unassignedHours - h,
          unassignedCount: prev.unassignedCount - 1,
          coveragePercent: prev.totalProjectHours > 0 ? (newLinked / prev.totalProjectHours) * 100 : 0,
        };
      });
      toast({ title: 'Task assigned', description: 'Time entry linked to task.' });
    } catch (err: unknown) {
      console.error('Assign task error:', err);
      toast({ title: 'Failed to assign', description: err instanceof Error ? err.message : 'An error occurred', variant: 'destructive' });
    } finally {
      setAssigningId(null);
    }
  };

  if (loading) {
    return <Skeleton className="h-48" />;
  }

  if (rows.length === 0 && coverage.totalProjectHours === 0) {
    return null;
  }

  const coverageColor =
    coverage.coveragePercent >= 80 ? 'text-status-complete'
    : coverage.coveragePercent >= 50 ? 'text-status-issue'
    : 'text-destructive';

  return (
    <>
      {/* Coverage summary strip */}
      {coverage.totalProjectHours > 0 && (
        <Card className="mb-4">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Task-linked time coverage:</span>
                <span className={`font-semibold ${coverageColor}`}>
                  {coverage.coveragePercent.toFixed(0)}%
                </span>
                <span className="text-muted-foreground">
                  ({formatNumber(coverage.taskLinkedHours)}h of {formatNumber(coverage.totalProjectHours)}h)
                </span>
              </div>
              {coverage.unassignedHours > 0 && (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-status-issue" />
                  <span className="text-status-issue font-medium">
                    Unassigned: {formatNumber(coverage.unassignedHours)}h
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleViewUnassigned}>
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unassigned hours alert */}
      {coverage.unassignedCount > 0 && rows.length > 0 && (
        <Alert className="mb-4">
          <Clock className="h-4 w-4" />
          <AlertTitle>Unassigned Time Entries</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              {formatNumber(coverage.unassignedHours)} hours ({coverage.unassignedCount} entries) are not assigned to any task and are excluded from scope variance.
            </span>
            <Button variant="outline" size="sm" className="ml-4 shrink-0" onClick={handleViewUnassigned}>
              <Eye className="h-4 w-4 mr-1" />
              View unassigned
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Scope Item Variance
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-sm">
                    Scope variance uses only task-linked time entries. Assign tasks during check-in to improve accuracy.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
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
      )}

      {/* Unassigned entries dialog */}
      <Dialog open={showUnassigned} onOpenChange={setShowUnassigned}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Unassigned Time Entries</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">
            These time entries have no task assigned and are not included in scope variance calculations.
          </p>
          {loadingUnassigned ? (
            <Skeleton className="h-32" />
          ) : unassignedEntries.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No unassigned entries found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Worker</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead>Notes</TableHead>
                  {canEdit && projectTasks.length > 0 && (
                    <TableHead>Assign Task</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassignedEntries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {new Date(e.check_in_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">{e.user_name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.duration_hours.toFixed(1)}h
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={e.notes || ''}>
                      {e.notes || '—'}
                    </TableCell>
                    {canEdit && projectTasks.length > 0 && (
                      <TableCell>
                        <Select
                          value=""
                          onValueChange={(taskId) => handleAssignTask(e.id, taskId)}
                          disabled={assigningId === e.id}
                        >
                          <SelectTrigger className="h-8 w-[160px] text-xs">
                            <SelectValue placeholder={assigningId === e.id ? 'Saving...' : 'Select task'} />
                          </SelectTrigger>
                          <SelectContent>
                            {projectTasks.map(t => (
                              <SelectItem key={t.id} value={t.id} className="text-xs">
                                {t.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
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
