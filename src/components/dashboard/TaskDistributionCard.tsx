import { useNavigate } from "react-router-dom";
import { Target, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatusItem {
  status: string;
  count: number;
  color: string;
}

interface TaskDistributionCardProps {
  distribution: StatusItem[];
  totalTasks: number;
  isLoading?: boolean;
}

export const TaskDistributionCard = ({
  distribution,
  totalTasks,
  isLoading = false,
}: TaskDistributionCardProps) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="space-y-1">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="widget-body space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-8" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
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
            <Target className="h-4 w-4 text-secondary" />
            Task Distribution
          </h3>
          <p className="widget-subtitle">Current workflow breakdown</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="widget-body space-y-4">
        {distribution.map((item, index) => {
          const percentage = totalTasks > 0 ? (item.count / totalTasks) * 100 : 0;
          
          return (
            <div 
              key={item.status} 
              className="space-y-2"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {item.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground tabular-nums">
                    {item.count}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({Math.round(percentage)}%)
                  </span>
                </div>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill animate-fade-in-up"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="widget-footer">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Tasks</span>
          <span className="font-bold text-foreground">{totalTasks}</span>
        </div>
      </div>
    </div>
  );
};