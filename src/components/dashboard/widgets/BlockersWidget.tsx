import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";

interface Blocker {
  id: string;
  reason: string;
  task?: { id: string; title: string; assigned_trade?: { name: string } | null } | null;
}

interface BlockersWidgetProps {
  blockers: Blocker[];
}

export const BlockersWidget = memo(function BlockersWidget({ blockers }: BlockersWidgetProps) {
  const navigate = useNavigate();

  return (
    <div className="widget-card widget-card-accent h-full group cursor-pointer hover:border-accent/40 transition-colors" onClick={() => navigate("/tasks?status=blocked")}>
      <div className="flex-shrink-0 mb-3 flex items-start justify-between">
        <div>
          <h3 className="widget-title">
            <AlertTriangle className="h-4 w-4 text-accent" />
            Active Blockers
          </h3>
          <p className="widget-subtitle">{blockers.length} unresolved issue{blockers.length !== 1 ? 's' : ''}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      
      <div className="flex-1 overflow-auto min-h-0">
        {blockers.length > 0 ? (
          <div className="space-y-2">
            {blockers.slice(0, 4).map((blocker) => (
              <div
                key={blocker.id}
                className="p-3 rounded-lg bg-card border border-border/50 hover:border-accent/30 transition-all duration-200"
              >
                <p className="text-sm font-medium text-foreground line-clamp-1">{blocker.reason}</p>
                {blocker.task && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {blocker.task.title}
                    {blocker.task.assigned_trade && (
                      <span className="text-accent"> • {blocker.task.assigned_trade.name}</span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-6">
            <div className="w-12 h-12 rounded-full bg-status-complete/10 flex items-center justify-center mb-3">
              <AlertTriangle className="h-6 w-6 text-status-complete" />
            </div>
            <p className="font-medium text-foreground">No blockers</p>
            <p className="text-xs text-muted-foreground">All tasks running smoothly</p>
          </div>
        )}
      </div>
      
      {blockers.length > 4 && (
        <div className="flex-shrink-0 pt-3 mt-auto text-center">
          <p className="text-xs text-accent font-medium">
            +{blockers.length - 4} more blockers
          </p>
        </div>
      )}
    </div>
  );
});
