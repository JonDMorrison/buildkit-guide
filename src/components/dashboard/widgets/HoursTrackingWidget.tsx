import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useHoursTracking } from "@/hooks/useHoursTracking";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { Clock, TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface HoursTrackingWidgetProps {
  projectId?: string;
}

export const HoursTrackingWidget = memo(function HoursTrackingWidget({ projectId }: HoursTrackingWidgetProps) {
  const navigate = useNavigate();
  const { currentProjectId } = useCurrentProject();
  const effectiveProjectId = projectId || currentProjectId || undefined;
  
  const { data, isLoading } = useHoursTracking(effectiveProjectId);

  if (isLoading) {
    return (
      <div className="h-full p-4">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-20 w-full mb-4" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  if (!data) return null;

  const { totalBudgetedHours, totalActualHours, variance, percentComplete } = data;

  const isOverBudget = variance < 0;
  const isNearBudget = variance >= 0 && percentComplete >= 80;
  const isHealthy = variance >= 0 && percentComplete < 80;

  const StatusIcon = isOverBudget ? AlertCircle : isNearBudget ? TrendingUp : CheckCircle2;
  const statusColor = isOverBudget ? "text-destructive" : isNearBudget ? "text-accent" : "text-status-complete";
  const statusBg = isOverBudget ? "bg-destructive/10" : isNearBudget ? "bg-accent/10" : "bg-status-complete/10";

  return (
    <div 
      className="h-full p-4 cursor-pointer hover:bg-accent/5 transition-colors rounded-lg"
      onClick={() => navigate("/hours-tracking")}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold">Hours Tracking</h3>
        </div>
        <div className={cn("p-1.5 rounded-full", statusBg)}>
          <StatusIcon className={cn("h-4 w-4", statusColor)} />
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Budget</p>
          <p className="text-2xl font-bold tabular-nums">{totalBudgetedHours.toFixed(1)}h</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Actual</p>
          <p className="text-2xl font-bold tabular-nums">{totalActualHours.toFixed(1)}h</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Progress</span>
          <span className={cn(
            "text-sm font-semibold",
            isOverBudget ? "text-destructive" : ""
          )}>
            {percentComplete.toFixed(0)}%
          </span>
        </div>
        <Progress 
          value={Math.min(percentComplete, 100)} 
          className={cn(
            "h-2",
            isOverBudget && "[&>div]:bg-destructive"
          )}
        />
      </div>

      {/* Variance */}
      <div className={cn(
        "flex items-center justify-between p-2 rounded-lg",
        statusBg
      )}>
        <span className="text-sm font-medium">Variance</span>
        <div className={cn("flex items-center gap-1", statusColor)}>
          {isOverBudget ? (
            <TrendingDown className="h-4 w-4" />
          ) : (
            <TrendingUp className="h-4 w-4" />
          )}
          <span className="font-semibold">
            {isOverBudget ? "" : "+"}{variance.toFixed(1)}h
          </span>
        </div>
      </div>
    </div>
  );
});
