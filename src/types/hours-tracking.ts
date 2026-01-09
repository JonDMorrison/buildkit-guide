/**
 * Type definitions for the Hours Tracking feature
 */

export interface HoursTrackingData {
  totalBudgetedHours: number;
  totalActualHours: number;
  variance: number;
  percentComplete: number;
  byTrade: TradeHours[];
  byTask: TaskHours[];
  byScopeItem: ScopeItemHours[];
}

export interface TradeHours {
  tradeId: string;
  tradeName: string;
  budgeted: number;
  actual: number;
  variance: number;
  percentComplete: number;
}

export interface TaskHours {
  taskId: string;
  taskName: string;
  budgeted: number;
  actual: number;
  variance: number;
  percentComplete: number;
  status: string;
}

export interface ScopeItemHours {
  id: string;
  name: string;
  phase: string | null;
  budgeted: number;
  actual: number;
  variance: number;
  percentComplete: number;
}

export interface ProjectProgress {
  id: string;
  name: string;
  location: string;
  status: string;
  organization_id: string;
  total_tasks: number;
  completed_tasks: number;
  blocked_tasks: number;
}
