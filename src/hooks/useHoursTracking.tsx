import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import type { 
  HoursTrackingData, 
  TradeHours, 
  TaskHours, 
  ScopeItemHours 
} from '@/types/hours-tracking';

// Re-export types for backward compatibility
export type { HoursTrackingData, TradeHours, TaskHours, ScopeItemHours };

export function useHoursTracking(projectId?: string) {
  const { activeOrganization } = useOrganization();

  return useQuery({
    queryKey: ['hours-tracking', projectId, activeOrganization?.id],
    queryFn: async (): Promise<HoursTrackingData> => {
      if (!activeOrganization?.id) {
        return {
          totalBudgetedHours: 0,
          totalActualHours: 0,
          variance: 0,
          percentComplete: 0,
          byTrade: [],
          byTask: [],
          byScopeItem: [],
        };
      }

      // Fetch tasks with budgeted hours - filter for org's projects
      const { data: orgProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('organization_id', activeOrganization.id)
        .eq('is_deleted', false);

      const projectIds = (orgProjects || []).map(p => p.id);
      
      if (projectIds.length === 0) {
        return {
          totalBudgetedHours: 0,
          totalActualHours: 0,
          variance: 0,
          percentComplete: 0,
          byTrade: [],
          byTask: [],
          byScopeItem: [],
        };
      }

      let tasksQuery = supabase
        .from('tasks')
        .select(`
          id,
          title,
          status,
          budgeted_hours,
          planned_hours,
          estimated_hours,
          assigned_trade_id,
          trades(id, name)
        `)
        .eq('is_deleted', false)
        .in('project_id', projectId ? [projectId] : projectIds);

      const { data: tasks, error: tasksError } = await tasksQuery;
      
      if (tasksError) {
        console.error('Error fetching tasks for hours tracking:', tasksError);
        throw new Error(`Failed to fetch tasks: ${tasksError.message}`);
      }

      // Fetch time entries
      let entriesQuery = supabase
        .from('time_entries')
        .select('duration_hours, task_id, scope_item_id, user_id')
        .eq('organization_id', activeOrganization.id)
        .eq('status', 'closed');

      if (projectId) {
        entriesQuery = entriesQuery.eq('project_id', projectId);
      }

      const { data: entries, error: entriesError } = await entriesQuery;
      
      if (entriesError) {
        console.error('Error fetching time entries for hours tracking:', entriesError);
        throw new Error(`Failed to fetch time entries: ${entriesError.message}`);
      }

      // Fetch scope items
      let scopeQuery = supabase
        .from('scope_items')
        .select('id, name, phase, budgeted_hours, trade_id, trades(name)')
        .eq('is_active', true);

      if (projectId) {
        scopeQuery = scopeQuery.eq('project_id', projectId);
      }

      const { data: scopeItems } = await scopeQuery;

      // Calculate totals
      // planned_hours is canonical budget truth; fall back to budgeted_hours then estimated_hours
      const totalBudgetedFromTasks = (tasks || []).reduce(
        (sum, t) => sum + (Number(t.planned_hours) || Number(t.budgeted_hours) || Number(t.estimated_hours) || 0), 0
      );
      const totalBudgetedFromScope = (scopeItems || []).reduce(
        (sum, s) => sum + Number(s.budgeted_hours), 0
      );
      const totalBudgetedHours = totalBudgetedFromTasks + totalBudgetedFromScope;

      const totalActualHours = (entries || []).reduce(
        (sum, e) => sum + (Number(e.duration_hours) || 0), 0
      );

      const variance = totalBudgetedHours - totalActualHours;
      const percentComplete = totalBudgetedHours > 0 
        ? Math.min(100, (totalActualHours / totalBudgetedHours) * 100) 
        : 0;

      // Group by trade
      const tradeMap = new Map<string, TradeHours>();
      (tasks || []).forEach(task => {
        if (task.assigned_trade_id && task.trades) {
          const existing = tradeMap.get(task.assigned_trade_id) || {
            tradeId: task.assigned_trade_id,
            tradeName: (task.trades as any).name,
            budgeted: 0,
            actual: 0,
            variance: 0,
            percentComplete: 0,
          };
          existing.budgeted += Number(task.planned_hours) || Number(task.budgeted_hours) || Number(task.estimated_hours) || 0;
          tradeMap.set(task.assigned_trade_id, existing);
        }
      });

      // Add actual hours to trades (would need to join with user's trade)
      // For now, calculate at project level

      const byTrade = Array.from(tradeMap.values()).map(trade => ({
        ...trade,
        variance: trade.budgeted - trade.actual,
        percentComplete: trade.budgeted > 0 ? (trade.actual / trade.budgeted) * 100 : 0,
      }));

      // Group by task
      const taskActuals = new Map<string, number>();
      (entries || []).forEach(entry => {
        if (entry.task_id) {
          taskActuals.set(entry.task_id, (taskActuals.get(entry.task_id) || 0) + (Number(entry.duration_hours) || 0));
        }
      });

      const byTask: TaskHours[] = (tasks || [])
        .filter(t => t.planned_hours || t.budgeted_hours || t.estimated_hours)
        .map(task => {
          const budgeted = Number(task.planned_hours) || Number(task.budgeted_hours) || Number(task.estimated_hours) || 0;
          const actual = taskActuals.get(task.id) || 0;
          return {
            taskId: task.id,
            taskName: task.title,
            budgeted,
            actual,
            variance: budgeted - actual,
            percentComplete: budgeted > 0 ? Math.min(100, (actual / budgeted) * 100) : 0,
            status: task.status,
          };
        });

      // Group by scope item
      const scopeActuals = new Map<string, number>();
      (entries || []).forEach(entry => {
        if (entry.scope_item_id) {
          scopeActuals.set(entry.scope_item_id, (scopeActuals.get(entry.scope_item_id) || 0) + (Number(entry.duration_hours) || 0));
        }
      });

      const byScopeItem: ScopeItemHours[] = (scopeItems || []).map(item => {
        const budgeted = Number(item.budgeted_hours);
        const actual = scopeActuals.get(item.id) || 0;
        return {
          id: item.id,
          name: item.name,
          phase: item.phase,
          budgeted,
          actual,
          variance: budgeted - actual,
          percentComplete: budgeted > 0 ? Math.min(100, (actual / budgeted) * 100) : 0,
        };
      });

      return {
        totalBudgetedHours,
        totalActualHours,
        variance,
        percentComplete,
        byTrade,
        byTask,
        byScopeItem,
      };
    },
    enabled: !!activeOrganization?.id,
    staleTime: 30000, // 30 seconds
  });
}
