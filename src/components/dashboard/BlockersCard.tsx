import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronRight, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Blocker {
  id: string;
  reason: string;
  task?: {
    id: string;
    title: string;
    assigned_trade?: { name: string } | null;
  } | null;
}

interface BlockersCardProps {
  blockers: Blocker[];
  isLoading?: boolean;
}

export const BlockersCard = ({ blockers, isLoading = false }: BlockersCardProps) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="widget-card premium-card-warning">
        <div className="widget-header">
          <div className="space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="widget-body space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3 rounded-lg bg-muted/10">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasBlockers = blockers.length > 0;

  return (
    <div 
      className={cn(
        "widget-card premium-card-interactive group",
        hasBlockers && "premium-card-warning"
      )}
      onClick={() => navigate("/tasks?status=blocked")}
    >
      <div className="widget-header">
        <div>
          <h3 className="widget-title">
            <AlertTriangle className={cn(
              "h-4 w-4",
              hasBlockers ? "text-orange-600" : "text-muted-foreground"
            )} />
            Active Blockers
          </h3>
          <p className="widget-subtitle">
            {hasBlockers ? `${blockers.length} unresolved` : "No blockers"}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="widget-body">
        {!hasBlockers ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-status-success-bg flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-secondary" />
            </div>
            <p className="text-sm font-medium text-foreground">No blockers!</p>
            <p className="text-xs text-muted-foreground mt-1">
              All tasks are progressing smoothly
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {blockers.slice(0, 4).map((blocker, index) => (
              <div
                key={blocker.id}
                className={cn(
                  "p-3 rounded-lg",
                  "bg-status-warning-bg/30 hover:bg-status-warning-bg/50 transition-colors",
                  "animate-fade-in-up"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/tasks?status=blocked");
                }}
              >
                <p className="text-sm font-medium text-foreground line-clamp-1">
                  {blocker.reason}
                </p>
                {blocker.task && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <span className="truncate">{blocker.task.title}</span>
                    {blocker.task.assigned_trade && (
                      <>
                        <span>•</span>
                        <span className="text-orange-600 font-medium">
                          {blocker.task.assigned_trade.name}
                        </span>
                      </>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {blockers.length > 4 && (
        <div className="widget-footer">
          <p className="text-xs text-muted-foreground text-center">
            +{blockers.length - 4} more blockers
          </p>
        </div>
      )}
    </div>
  );
};