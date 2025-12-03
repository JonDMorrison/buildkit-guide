import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, AlertTriangle, Calendar, Shield } from "lucide-react";

interface MetricsWidgetProps {
  openTasks: number;
  blockedTasks: number;
  upcomingTasks: number;
  safetyFormsThisWeek: number;
}

export const MetricsWidget = ({
  openTasks,
  blockedTasks,
  upcomingTasks,
  safetyFormsThisWeek,
}: MetricsWidgetProps) => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 h-full">
      <Card 
        className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border-primary/20" 
        onClick={() => navigate("/tasks")}
      >
        <CardContent className="p-4 lg:p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Open Tasks</p>
          <p className="text-3xl lg:text-4xl font-black text-primary tabular-nums">{openTasks}</p>
        </CardContent>
      </Card>

      <Card 
        className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer bg-accent/5 border-accent/30" 
        onClick={() => navigate("/tasks?filter=blocked")}
      >
        <CardContent className="p-4 lg:p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-accent/20">
              <AlertTriangle className="h-5 w-5 text-accent" />
            </div>
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Blocked</p>
          <p className="text-3xl lg:text-4xl font-black text-accent tabular-nums">{blockedTasks}</p>
        </CardContent>
      </Card>

      <Card 
        className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border-primary/20" 
        onClick={() => navigate("/tasks")}
      >
        <CardContent className="p-4 lg:p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Due This Week</p>
          <p className="text-3xl lg:text-4xl font-black text-primary tabular-nums">{upcomingTasks}</p>
        </CardContent>
      </Card>

      <Card 
        className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer bg-secondary/5 border-secondary/30" 
        onClick={() => navigate("/safety")}
      >
        <CardContent className="p-4 lg:p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-secondary/20">
              <Shield className="h-5 w-5 text-secondary" />
            </div>
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Safety Forms</p>
          <p className="text-3xl lg:text-4xl font-black text-secondary tabular-nums">{safetyFormsThisWeek}</p>
        </CardContent>
      </Card>
    </div>
  );
};
