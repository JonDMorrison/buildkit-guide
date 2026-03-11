import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { Users, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  projectId: string | null;
}

interface ManpowerRequest {
  id: string;
  status: string;
  requested_count: number;
  required_date: string;
  reason: string | null;
  trades?: { name: string } | null;
  tasks?: { title: string } | null;
}

export function ManpowerOverview({ projectId }: Props) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["pm-manpower-overview", projectId],
    queryFn: async () => {
      if (!projectId) return { pending: [] as ManpowerRequest[], approved: 0, total: 0 };
      const { data: requests, error } = await supabase
        .from("manpower_requests")
        .select("id,status,requested_count,required_date,reason,trades:trade_id(name),tasks:task_id(title)")
        .eq("project_id", projectId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      
      const all = (requests as unknown as ManpowerRequest[]) || [];
      const pending = all.filter((r) => r.status === "pending");
      const approved = all.filter((r) => r.status === "approved").length;
      return { pending, approved, total: all.length };
    },
    enabled: !!projectId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const pending = data?.pending ?? [];

  return (
    <DashboardCard
      title="Manpower Requests"
      description={`${pending.length} pending · ${data?.approved ?? 0} approved`}
      icon={Users}
      loading={isLoading}
      variant={pending.length > 0 ? "alert" : "table"}
      helpText="Pending and approved crew requests for this project. Approve or adjust requests to match upcoming task needs."
      empty={!isLoading && (data?.total ?? 0) === 0}
      emptyMessage="No manpower requests for this project."
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate("/manpower")} className="text-xs">
          Full View <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      }
    >
      {pending.length > 0 && (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {pending.slice(0, 4).map((r) => (
            <div
              key={r.id}
              className="p-3 rounded-lg border border-border/50 bg-card space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {r.requested_count} worker{r.requested_count !== 1 ? "s" : ""}
                </span>
                <Badge className="bg-secondary text-secondary-foreground text-[10px]">Pending</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {r.trades?.name && <span>{r.trades.name}</span>}
                {r.tasks?.title && <span className="truncate">· {r.tasks.title}</span>}
              </div>
              {r.reason && (
                <p className="text-xs text-muted-foreground/80 line-clamp-1">{r.reason}</p>
              )}
            </div>
          ))}
          {pending.length > 4 && (
            <p className="text-xs text-muted-foreground text-center">+{pending.length - 4} more pending</p>
          )}
        </div>
      )}

      {pending.length === 0 && (data?.total ?? 0) > 0 && (
        <div className="flex items-center gap-2 text-sm text-primary py-2">
          <Users className="h-4 w-4" />
          <span>All requests resolved. {data?.approved} approved.</span>
        </div>
      )}
    </DashboardCard>
  );
}
