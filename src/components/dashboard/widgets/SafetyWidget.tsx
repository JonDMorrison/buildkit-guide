import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, ChevronRight } from "lucide-react";

interface SafetyWidgetProps {
  formsToday: number;
  formsThisWeek: number;
  incidents: number;
}

export const SafetyWidget = memo(function SafetyWidget({ formsToday, formsThisWeek, incidents }: SafetyWidgetProps) {
  const navigate = useNavigate();

  return (
    <div className="widget-card widget-card-success h-full group cursor-pointer hover:border-status-complete/40 transition-colors" onClick={() => navigate("/safety")}>
      <div className="flex-shrink-0 mb-3 flex items-start justify-between">
        <div>
          <h3 className="widget-title">
            <Shield className="h-4 w-4 text-status-complete" />
            Safety & Compliance
          </h3>
          <p className="widget-subtitle">Safety form submissions</p>
        </div>
        <ChevronRight className="h-4 w-4 text-status-complete opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      
      <div className="flex-1 flex flex-col justify-center min-h-0">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-card border border-border/50">
            <p className="text-2xl font-bold text-status-complete">{formsToday}</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">Today</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-card border border-border/50">
            <p className="text-2xl font-bold text-status-complete">{formsThisWeek}</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">This Week</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-card border border-border/50">
            <p className={`text-2xl font-bold ${incidents > 0 ? "text-destructive" : "text-status-complete"}`}>
              {incidents}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">Incidents</p>
          </div>
        </div>
      </div>
    </div>
  );
});
