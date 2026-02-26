import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';

export interface SmartDefaults {
  topTrades: Array<{ id: string; name: string; count: number }>;
  recentLocations: string[];
  lastCrewCount: number | null;
  lastWeather: string | null;
  /** Most recent manpower_requests rows for this project (trade_id -> requested_count) */
  manpowerByTrade: Map<string, number>;
  /** Most recent requested_count from any manpower request in this project */
  lastManpowerCount: number | null;
  loading: boolean;
}

const JUNK_LOCATIONS = new Set(['', 'tbd', '-', 'n/a', 'na', 'none', 'unknown']);
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function useSmartDefaults(projectId: string | undefined): SmartDefaults {
  const enabled = !!projectId;

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['smart-defaults', 'tasks', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('assigned_trade_id, location, created_at')
        .eq('project_id', projectId!)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const { data: deficienciesData, isLoading: defLoading } = useQuery({
    queryKey: ['smart-defaults', 'deficiencies', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('deficiencies')
        .select('assigned_trade_id, location, created_at')
        .eq('project_id', projectId!)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const { data: manpowerData, isLoading: mpLoading } = useQuery({
    queryKey: ['smart-defaults', 'manpower', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('manpower_requests')
        .select('trade_id, requested_count, created_at')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const { data: dailyLogsData, isLoading: logsLoading } = useQuery({
    queryKey: ['smart-defaults', 'daily-logs', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_logs')
        .select('crew_count, weather, created_at')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const { data: tradesLookup } = useQuery({
    queryKey: ['smart-defaults', 'trades-lookup'],
    queryFn: async () => {
      const { data } = await supabase
        .from('trades')
        .select('id, name')
        .eq('is_active', true);
      const map = new Map<string, string>();
      (data || []).forEach((t) => map.set(t.id, t.name));
      return map;
    },
    staleTime: 10 * 60 * 1000,
  });

  const result = useMemo<SmartDefaults>(() => {
    const loading = tasksLoading || defLoading || mpLoading || logsLoading;
    const emptyMap = new Map<string, number>();
    if (!enabled || !tradesLookup) {
      return { topTrades: [], recentLocations: [], lastCrewCount: null, lastWeather: null, manpowerByTrade: emptyMap, lastManpowerCount: null, loading };
    }

    const now = Date.now();

    // --- Trades ---
    const tradeScores = new Map<string, { count: number; recent: boolean }>();
    const addTrade = (id: string | null, createdAt: string) => {
      if (!id) return;
      const existing = tradeScores.get(id) || { count: 0, recent: false };
      existing.count += 1;
      if (now - new Date(createdAt).getTime() < SEVEN_DAYS_MS) existing.recent = true;
      tradeScores.set(id, existing);
    };

    (tasksData || []).forEach((t) => addTrade(t.assigned_trade_id, t.created_at));
    (deficienciesData || []).forEach((d) => addTrade(d.assigned_trade_id, d.created_at));
    (manpowerData || []).forEach((m) => addTrade(m.trade_id, m.created_at));

    const topTrades = Array.from(tradeScores.entries())
      .map(([id, { count, recent }]) => ({
        id,
        name: tradesLookup.get(id) || id,
        count,
        score: count * 10 + (recent ? 20 : 0),
      }))
      .filter((t) => tradesLookup.has(t.id))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 3)
      .map(({ id, name, count }) => ({ id, name, count }));

    // --- Locations ---
    const seenLower = new Set<string>();
    const recentLocations: string[] = [];
    const allLocs = [
      ...(tasksData || []).map((t) => ({ loc: t.location, ts: t.created_at })),
      ...(deficienciesData || []).map((d) => ({ loc: d.location, ts: d.created_at })),
    ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    for (const { loc } of allLocs) {
      if (!loc) continue;
      const trimmed = loc.trim();
      const lower = trimmed.toLowerCase();
      if (JUNK_LOCATIONS.has(lower) || seenLower.has(lower)) continue;
      seenLower.add(lower);
      recentLocations.push(trimmed);
      if (recentLocations.length >= 3) break;
    }

    // --- Crew count & weather ---
    const mostRecentLog = (dailyLogsData || [])[0] || null;
    const lastCrewCount = mostRecentLog?.crew_count ?? null;
    const lastWeather = mostRecentLog?.weather ?? null;

    // --- Manpower history (most recent requested_count per trade) ---
    const manpowerByTrade = new Map<string, number>();
    const sortedManpower = [...(manpowerData || [])]; // already sorted by created_at desc
    for (const m of sortedManpower) {
      if (m.trade_id && m.requested_count != null && !manpowerByTrade.has(m.trade_id)) {
        manpowerByTrade.set(m.trade_id, m.requested_count);
      }
    }
    const lastManpowerCount = sortedManpower.length > 0 && sortedManpower[0].requested_count != null
      ? sortedManpower[0].requested_count
      : null;

    return { topTrades, recentLocations, lastCrewCount, lastWeather, manpowerByTrade, lastManpowerCount, loading };
  }, [enabled, tasksData, deficienciesData, manpowerData, dailyLogsData, tradesLookup, tasksLoading, defLoading, mpLoading, logsLoading]);

  return result;
}
