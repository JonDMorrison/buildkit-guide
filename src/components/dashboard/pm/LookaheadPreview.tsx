import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { Calendar, ChevronRight } from "lucide-react";
import { format, addDays, startOfDay, isWithinInterval } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  projectId: string | null;
}

interface LookaheadTask {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  due_date: string | null;
  assigned_trade_id: string | null;
  trades: {
    name: string;
  } | null;
}

export function LookaheadPreview({ projectId }: Props) {
  const navigate = useNavigate();
  const today = startOfDay(new Date());
  const twoWeeksOut = addDays(today, 14);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["pm-lookahead-preview", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,status,start_date,due_date,assigned_trade_id,trades:assigned_trade_id(name)")
        .eq("project_id", projectId)
        .eq("is_deleted", false)
        .or(`start_date.gte.${today.toISOString()},due_date.gte.${today.toISOString()}`)
        .lte("start_date", twoWeeksOut.toISOString())
        .order("start_date", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Simple week grouping
  const thisWeek = tasks.filter((t) =>
    t.start_date && isWithinInterval(new Date(t.start_date), { start: today, end: addDays(today, 6) })
  );
  const nextWeek = tasks.filter((t) =>
    t.start_date && isWithinInterval(new Date(t.start_date), { start: addDays(today, 7), end: twoWeeksOut })
  );

  return (
    <DashboardCard
      title="2-Week Lookahead"
      description={`${format(today, "MMM d")} – ${format(twoWeeksOut, "MMM d")}`}
      icon={Calendar}
      loading={isLoading}
      variant="table"
      helpText="Tasks starting within the next 14 days. Review this weekly to ensure trades, materials, and crew are lined up."
      empty={!isLoading && tasks.length === 0}
      emptyMessage="No tasks scheduled for the next 2 weeks."
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate("/lookahead")} className="text-xs">
          Full View <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      }
    >
      <div className="space-y-3">
        {/* This week */}
        {thisWeek.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">This Week</p>
            <div className="space-y-1.5">
              {thisWeek.slice(0, 4).map((t) => (
                <LookaheadRow key={t.id} task={t} />
              ))}
              {thisWeek.length > 4 && (
                <p className="text-xs text-muted-foreground pl-2">+{thisWeek.length - 4} more</p>
              )}
            </div>
          </div>
        )}

        {/* Next week */}
        {nextWeek.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Next Week</p>
            <div className="space-y-1.5">
              {nextWeek.slice(0, 4).map((t) => (
                <LookaheadRow key={t.id} task={t} />
              ))}
              {nextWeek.length > 4 && (
                <p className="text-xs text-muted-foreground pl-2">+{nextWeek.length - 4} more</p>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}

function LookaheadRow({ task }: { task: LookaheadTask }) {
  const statusColor: Record<string, string> = {
    blocked: "bg-destructive",
    in_progress: "bg-primary",
    not_started: "bg-muted-foreground/40",
    done: "bg-primary/60",
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/30 transition-colors">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor[task.status] ?? "bg-muted-foreground/40"}`} />
      <span className="text-xs text-foreground truncate flex-1">{task.title}</span>
      {task.start_date && (
        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
          {format(new Date(task.start_date), "MMM d")}
        </span>
      )}
      {task.trades?.name && (
        <Badge variant="outline" className="text-[9px] py-0 px-1 shrink-0">
          {task.trades.name}
        </Badge>
      )}
    </div>
  );
}
