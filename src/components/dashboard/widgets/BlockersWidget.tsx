import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Blocker {
  id: string;
  reason: string;
  task?: { id: string; title: string; assigned_trade?: { name: string } | null } | null;
}

interface BlockersWidgetProps {
  blockers: Blocker[];
}

export const BlockersWidget = ({ blockers }: BlockersWidgetProps) => {
  const navigate = useNavigate();

  return (
    <div className="widget-card widget-card-accent h-full">
      <div className="flex-shrink-0 mb-3">
        <h3 className="widget-title">
          <AlertTriangle className="h-4 w-4 text-accent" />
          Active Blockers
        </h3>
        <p className="widget-subtitle">{blockers.length} unresolved issue{blockers.length !== 1 ? 's' : ''}</p>
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
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-3">
              <AlertTriangle className="h-6 w-6 text-secondary" />
            </div>
            <p className="font-medium text-foreground">No blockers</p>
            <p className="text-xs text-muted-foreground">All tasks running smoothly</p>
          </div>
        )}
      </div>
      
      {blockers.length > 4 && (
        <div className="flex-shrink-0 pt-3 mt-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate("/tasks?filter=blocked")}
            className="w-full border-accent/30 text-accent hover:bg-accent hover:text-accent-foreground"
          >
            View All ({blockers.length})
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
