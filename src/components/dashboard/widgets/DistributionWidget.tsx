import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Target, ChevronRight } from "lucide-react";

interface StatusItem {
  status: string;
  count: number;
  color: string;
}

interface DistributionWidgetProps {
  statusDistribution: StatusItem[];
  totalTasks: number;
}

export const DistributionWidget = memo(function DistributionWidget({ statusDistribution, totalTasks }: DistributionWidgetProps) {
  const navigate = useNavigate();

  return (
    <div className="widget-card h-full group cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate("/tasks")}>
      <div className="flex-shrink-0 mb-3 flex items-start justify-between">
        <div>
          <h3 className="widget-title">
            <Target className="h-4 w-4 text-secondary" />
            Task Distribution
          </h3>
          <p className="widget-subtitle">Current workflow breakdown</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      
      <div className="flex-1 flex flex-col justify-center gap-3 min-h-0">
        {statusDistribution.map((item) => (
          <div key={item.status} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">{item.status}</span>
              <span className="text-xs font-bold text-foreground">{item.count}</span>
            </div>
            <div className="w-full bg-muted/20 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: totalTasks > 0 ? `${(item.count / totalTasks) * 100}%` : "0%",
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
