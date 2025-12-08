import { useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, XCircle, Clock, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ProjectHealthCardProps {
  healthScore: number;
  atRiskTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  isLoading?: boolean;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-secondary";
  if (score >= 60) return "text-orange-500";
  return "text-red-500";
};

const getScoreStrokeColor = (score: number) => {
  if (score >= 80) return "hsl(var(--brand-secondary))";
  if (score >= 60) return "hsl(var(--brand-warning))";
  return "hsl(var(--brand-danger))";
};

const getScoreLabel = (score: number) => {
  if (score >= 80) return "Healthy";
  if (score >= 60) return "At Risk";
  return "Critical";
};

export const ProjectHealthCard = ({
  healthScore,
  atRiskTasks,
  blockedTasks,
  overdueTasks,
  isLoading = false,
}: ProjectHealthCardProps) => {
  const navigate = useNavigate();
  
  // SVG circular gauge
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;

  if (isLoading) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="widget-body flex items-center justify-center">
          <Skeleton className="w-28 h-28 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="widget-card premium-card-interactive group"
      onClick={() => navigate("/tasks")}
    >
      <div className="widget-header">
        <div>
          <h3 className="widget-title">
            <Activity className="h-4 w-4 text-secondary" />
            Project Health
          </h3>
          <p className="widget-subtitle">{getScoreLabel(healthScore)}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="widget-body flex flex-col items-center justify-center gap-4">
        {/* Circular gauge */}
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="hsl(var(--brand-border))"
              strokeWidth="8"
              strokeOpacity="0.3"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={getScoreStrokeColor(healthScore)}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          {/* Score text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-3xl font-bold", getScoreColor(healthScore))}>
              {healthScore}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Score
            </span>
          </div>
        </div>

        {/* KPI metrics */}
        <div className="grid grid-cols-3 gap-3 w-full">
          <div className="flex flex-col items-center p-2 rounded-lg bg-status-warning-bg/50">
            <AlertTriangle className="h-3.5 w-3.5 text-orange-600 mb-1" />
            <span className="text-lg font-bold">{atRiskTasks}</span>
            <span className="text-[9px] text-muted-foreground uppercase">At Risk</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-status-danger-bg/50">
            <XCircle className="h-3.5 w-3.5 text-red-600 mb-1" />
            <span className="text-lg font-bold">{blockedTasks}</span>
            <span className="text-[9px] text-muted-foreground uppercase">Blocked</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-muted/20">
            <Clock className="h-3.5 w-3.5 text-muted-foreground mb-1" />
            <span className="text-lg font-bold">{overdueTasks}</span>
            <span className="text-[9px] text-muted-foreground uppercase">Overdue</span>
          </div>
        </div>
      </div>
    </div>
  );
};