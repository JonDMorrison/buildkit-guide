import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lightbulb, ChevronRight, RefreshCw, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProject } from "@/hooks/useCurrentProject";

interface Insight {
  text: string;
  type: 'warning' | 'info' | 'action';
  route?: string;
}

interface AIInsightsListProps {
  onClose: () => void;
}

export function AIInsightsList({ onClose }: AIInsightsListProps) {
  const navigate = useNavigate();
  const { currentProjectId } = useCurrentProject();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState(0);

  const CACHE_DURATION = 5 * 60 * 1000;

  const fetchInsights = async (force = false) => {
    if (!currentProjectId) return;
    const now = Date.now();
    if (!force && lastFetched && now - lastFetched < CACHE_DURATION && insights.length > 0) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assist', {
        body: { project_id: currentProjectId, quick_action: 'insights' },
      });
      if (error) throw error;

      const pi = data?.pressing_issues;
      const list: Insight[] = [];

      if (pi) {
        if (pi.old_blockers_count > 0) list.push({ text: `${pi.old_blockers_count} blocker(s) older than 3 days`, type: 'warning', route: '/tasks?status=blocked' });
        if (pi.overdue_count > 0) list.push({ text: `${pi.overdue_count} overdue task(s)`, type: 'warning', route: '/tasks' });
        if (pi.due_today_count > 0) list.push({ text: `${pi.due_today_count} task(s) due today`, type: 'info', route: '/tasks' });
        if (pi.pending_manpower_count > 0) list.push({ text: `${pi.pending_manpower_count} pending manpower request(s)`, type: 'action', route: '/manpower' });
        if (pi.safety_incidents_count > 0) list.push({ text: `${pi.safety_incidents_count} safety incident(s) this week`, type: 'warning', route: '/safety' });
      }

      if (list.length === 0) list.push({ text: 'No critical issues — project on track', type: 'info' });

      setInsights(list);
      setLastFetched(now);
    } catch {
      setInsights([{ text: 'Unable to load insights', type: 'info' }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentProjectId) fetchInsights();
  }, [currentProjectId]);

  const handleClick = (insight: Insight) => {
    if (insight.route) {
      navigate(insight.route);
      onClose();
    }
  };

  if (!currentProjectId) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Select a project to see AI insights
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Intelligence</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => fetchInsights(true)}
          disabled={loading}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <ScrollArea className="h-[340px]">
        {loading && insights.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {insights.map((insight, i) => (
              <button
                key={i}
                onClick={() => handleClick(insight)}
                disabled={!insight.route}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 disabled:cursor-default"
              >
                <Lightbulb className="h-4 w-4 text-status-warning shrink-0 mt-0.5" />
                <span className="flex-1 text-sm text-foreground leading-snug">{insight.text}</span>
                {insight.route && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
      {lastFetched > 0 && (
        <div className="px-3 py-1.5 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground text-center tabular-nums">
            Updated {new Date(lastFetched).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}
