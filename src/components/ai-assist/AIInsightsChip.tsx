import { useState, useEffect } from "react";
import { Lightbulb, Loader2, AlertTriangle, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Insight {
  text: string;
  type: 'warning' | 'info' | 'action';
  route?: string;
}

interface AIInsightsChipProps {
  projectId: string | null;
}

export const AIInsightsChip = ({ projectId }: AIInsightsChipProps) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const fetchInsights = async (force = false) => {
    if (!projectId) return;
    
    // Check cache
    const now = Date.now();
    if (!force && lastFetched && now - lastFetched < CACHE_DURATION && insights.length > 0) {
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assist', {
        body: {
          project_id: projectId,
          quick_action: 'insights',
        },
      });

      if (error) throw error;

      // Parse insights from the response
      const pressingIssues = data?.pressing_issues;
      const newInsights: Insight[] = [];

      if (pressingIssues) {
        if (pressingIssues.old_blockers_count > 0) {
          newInsights.push({
            text: `${pressingIssues.old_blockers_count} blocker${pressingIssues.old_blockers_count > 1 ? 's' : ''} older than 3 days - consider escalation`,
            type: 'warning',
            route: '/tasks?status=blocked',
          });
        }
        if (pressingIssues.overdue_count > 0) {
          newInsights.push({
            text: `${pressingIssues.overdue_count} overdue task${pressingIssues.overdue_count > 1 ? 's' : ''} need attention`,
            type: 'warning',
            route: '/tasks',
          });
        }
        if (pressingIssues.due_today_count > 0) {
          newInsights.push({
            text: `${pressingIssues.due_today_count} task${pressingIssues.due_today_count > 1 ? 's' : ''} due today`,
            type: 'info',
            route: '/tasks',
          });
        }
        if (pressingIssues.pending_manpower_count > 0) {
          newInsights.push({
            text: `${pressingIssues.pending_manpower_count} pending manpower request${pressingIssues.pending_manpower_count > 1 ? 's' : ''}`,
            type: 'action',
            route: '/manpower',
          });
        }
        if (pressingIssues.unmapped_gc_count > 0) {
          newInsights.push({
            text: `${pressingIssues.unmapped_gc_count} GC deficiencies awaiting import`,
            type: 'action',
            route: `/projects/${projectId}/deficiency-import`,
          });
        }
        if (pressingIssues.safety_incidents_count > 0) {
          newInsights.push({
            text: `${pressingIssues.safety_incidents_count} safety incident${pressingIssues.safety_incidents_count > 1 ? 's' : ''} this week`,
            type: 'warning',
            route: '/safety',
          });
        }
      }

      // If no specific issues, add a positive insight
      if (newInsights.length === 0) {
        newInsights.push({
          text: 'No critical issues detected - project on track',
          type: 'info',
        });
      }

      setInsights(newInsights);
      setLastFetched(now);
    } catch (error: any) {
      console.error('Error fetching insights:', error);
      // Don't show toast for background fetch errors
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and when project changes
  useEffect(() => {
    if (projectId) {
      fetchInsights();
    }
  }, [projectId]);

  // Fetch when popover opens if cache is stale
  useEffect(() => {
    if (open && projectId) {
      fetchInsights();
    }
  }, [open]);

  const warningCount = insights.filter(i => i.type === 'warning').length;
  const actionCount = insights.filter(i => i.type === 'action').length;
  const totalCount = warningCount + actionCount;

  const handleInsightClick = (insight: Insight) => {
    if (insight.route) {
      navigate(insight.route);
      setOpen(false);
    }
  };

  if (!projectId) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`relative gap-1.5 px-2 ${totalCount > 0 ? 'text-accent' : 'text-muted-foreground'}`}
        >
          <Lightbulb className="h-4 w-4" />
          {totalCount > 0 ? (
            <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px]">
              {totalCount}
            </Badge>
          ) : (
            <span className="text-xs hidden sm:inline">Insights</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-accent" />
            <h4 className="font-semibold text-sm">AI Insights</h4>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => fetchInsights(true)}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto">
          {loading && insights.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : insights.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No insights available
            </div>
          ) : (
            <div className="divide-y">
              {insights.map((insight, index) => (
                <button
                  key={index}
                  onClick={() => handleInsightClick(insight)}
                  disabled={!insight.route}
                  className={`w-full flex items-start gap-3 p-3 text-left transition-colors ${
                    insight.route ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className={`mt-0.5 ${
                    insight.type === 'warning' ? 'text-destructive' :
                    insight.type === 'action' ? 'text-accent' : 'text-secondary'
                  }`}>
                    {insight.type === 'warning' ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <Lightbulb className="h-4 w-4" />
                    )}
                  </div>
                  <span className="flex-1 text-sm">{insight.text}</span>
                  {insight.route && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {lastFetched > 0 && (
          <div className="px-4 py-2 border-t bg-muted/30">
            <p className="text-[10px] text-muted-foreground text-center">
              Updated {new Date(lastFetched).toLocaleTimeString()}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
