import { useNavigate } from "react-router-dom";
import { Gauge, ChevronRight } from "lucide-react";

interface HealthWidgetProps {
  healthScore: number;
  atRiskTasks: number;
  blockedTasks: number;
  overdueTasks: number;
}

export const HealthWidget = ({
  healthScore,
  atRiskTasks,
  blockedTasks,
  overdueTasks,
}: HealthWidgetProps) => {
  const navigate = useNavigate();

  const getScoreColor = () => {
    if (healthScore > 70) return "hsl(var(--secondary))";
    if (healthScore > 40) return "hsl(var(--accent))";
    return "hsl(var(--destructive))";
  };

  return (
    <div className="widget-card h-full group cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate("/tasks")}>
      <div className="flex-shrink-0 mb-3 flex items-start justify-between">
        <div>
          <h3 className="widget-title">
            <Gauge className="h-4 w-4 text-accent" />
            Project Health
          </h3>
          <p className="widget-subtitle">Key risk indicators</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-0">
        {/* Circular gauge */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="hsl(var(--muted) / 0.2)"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={getScoreColor()}
              strokeWidth="8"
              strokeDasharray={`${(healthScore / 100) * 264} 264`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-foreground">{healthScore}</span>
            <span className="text-[10px] text-muted-foreground font-medium">Health</span>
          </div>
        </div>

        {/* Risk metrics */}
        <div className="grid grid-cols-3 gap-3 w-full">
          <div className="text-center">
            <p className="text-lg font-bold text-accent">{atRiskTasks}</p>
            <p className="text-[10px] text-muted-foreground font-medium">At Risk</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-accent">{blockedTasks}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Blocked</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-destructive">{overdueTasks}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Overdue</p>
          </div>
        </div>
      </div>
    </div>
  );
};
