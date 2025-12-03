import { useNavigate } from "react-router-dom";
import { Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SafetyWidgetProps {
  formsToday: number;
  formsThisWeek: number;
  incidents: number;
}

export const SafetyWidget = ({ formsToday, formsThisWeek, incidents }: SafetyWidgetProps) => {
  const navigate = useNavigate();

  return (
    <div className="widget-card widget-card-success h-full">
      <div className="flex-shrink-0 mb-3">
        <h3 className="widget-title">
          <Shield className="h-4 w-4 text-secondary" />
          Safety & Compliance
        </h3>
        <p className="widget-subtitle">Safety form submissions</p>
      </div>
      
      <div className="flex-1 flex flex-col justify-center gap-4 min-h-0">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-card border border-border/50">
            <p className="text-2xl font-bold text-secondary">{formsToday}</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">Today</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-card border border-border/50">
            <p className="text-2xl font-bold text-secondary">{formsThisWeek}</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">This Week</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-card border border-border/50">
            <p className={`text-2xl font-bold ${incidents > 0 ? "text-destructive" : "text-secondary"}`}>
              {incidents}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">Incidents</p>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate("/safety")}
          className="w-full border-secondary/30 text-secondary hover:bg-secondary hover:text-secondary-foreground"
        >
          View Dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
