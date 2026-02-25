import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Blocker {
  id: string;
  reason: string;
  created_at?: string;
  task?: { id: string; title: string; assigned_trade?: { name: string } | null } | null;
}

interface Props {
  blockers: Blocker[];
  loading?: boolean;
}

export const BlockersCard = memo(function BlockersCard({ blockers, loading }: Props) {
  const navigate = useNavigate();

  return (
    <DashboardCard
      title="Active Blockers"
      description={`${blockers.length} unresolved`}
      icon={AlertTriangle}
      loading={loading}
      variant={blockers.length > 0 ? "alert" : "table"}
      helpText="Open blockers on your current project. Each one is holding up a task — resolve them or reassign to keep work flowing."
      empty={!loading && blockers.length === 0}
      emptyMessage="No blockers — all tasks running smoothly."
    >
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {blockers.slice(0, 6).map(b => (
          <div
            key={b.id}
            className="p-3 rounded-lg border border-border/50 bg-card hover:border-destructive/30 transition-colors cursor-pointer"
            onClick={() => navigate("/tasks?status=blocked")}
          >
            <p className="text-sm font-medium text-foreground line-clamp-1">{b.reason}</p>
            {b.task && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground truncate">{b.task.title}</span>
                {b.task.assigned_trade && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0">
                    {b.task.assigned_trade.name}
                  </Badge>
                )}
              </div>
            )}
          </div>
        ))}
        {blockers.length > 6 && (
          <button
            onClick={() => navigate("/tasks?status=blocked")}
            className="w-full text-center text-xs text-destructive font-medium py-2 hover:underline flex items-center justify-center gap-1"
          >
            +{blockers.length - 6} more <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </DashboardCard>
  );
});
