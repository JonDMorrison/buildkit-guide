import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Filter, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface TaskFiltersProps {
  onFilterChange: (filters: TaskFilters) => void;
}

export interface TaskFilters {
  status?: string;
  tradeId?: string;
  dateRange?: 'today' | 'week' | 'overdue' | 'all';
}

export const TaskFilters = ({ onFilterChange }: TaskFiltersProps) => {
  const [filters, setFilters] = useState<TaskFilters>({
    dateRange: 'all',
  });
  const [trades, setTrades] = useState<any[]>([]);

  useEffect(() => {
    // Fetch trades for filter
    supabase
      .from('trades')
      .select('id,name,trade_type')
      .eq('is_active', true)
      .order('name')
      .then(({ data, error }) => {
        if (error) console.error('Error fetching trades:', error);
        setTrades(data || []);
      });
  }, []);

  const updateFilter = (key: keyof TaskFilters, value: string | undefined) => {
    const newFilters = { ...filters, [key]: value === 'all' ? undefined : value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const cleared: TaskFilters = { dateRange: 'all' };
    setFilters(cleared);
    onFilterChange(cleared);
  };

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;

  return (
    <div className="flex items-center gap-2 flex-wrap pb-4 border-b border-border">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filters:</span>
      </div>

      <Select value={filters.status || 'all'} onValueChange={(v) => updateFilter('status', v)}>
        <SelectTrigger className="w-[140px] h-10 bg-card border-border">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border z-50">
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="not_started">Not Started</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="blocked">Blocked</SelectItem>
          <SelectItem value="done">Done</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.dateRange || 'all'} onValueChange={(v) => updateFilter('dateRange', v)}>
        <SelectTrigger className="w-[140px] h-10 bg-card border-border">
          <SelectValue placeholder="Date Range" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border z-50">
          <SelectItem value="all">All Dates</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">This Week</SelectItem>
          <SelectItem value="overdue">Overdue</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.tradeId || 'all'} onValueChange={(v) => updateFilter('tradeId', v)}>
        <SelectTrigger className="w-[160px] h-10 bg-card border-border">
          <SelectValue placeholder="Trade" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border z-50">
          <SelectItem value="all">All Trades</SelectItem>
          {trades.map((trade) => (
            <SelectItem key={trade.id} value={trade.id}>
              {trade.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeFilterCount > 0 && (
        <>
          <Badge variant="secondary" className="ml-2">
            {activeFilterCount} active
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 px-2"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </>
      )}
    </div>
  );
};