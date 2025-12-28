import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, AlertTriangle, Calendar, Shield } from "lucide-react";

interface MetricsWidgetProps {
  openTasks: number;
  blockedTasks: number;
  upcomingTasks: number;
  safetyFormsThisWeek: number;
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  onClick: () => void;
  variant?: "default" | "warning" | "success";
}

const MetricCard = ({ icon: Icon, label, value, onClick, variant = "default" }: MetricCardProps) => {
  const bgClass = variant === "warning" 
    ? "bg-accent/5 border-accent/20 hover:border-accent/40" 
    : variant === "success"
    ? "bg-secondary/5 border-secondary/20 hover:border-secondary/40"
    : "bg-card border-border/50 hover:border-primary/30";
  
  const iconBgClass = variant === "warning"
    ? "bg-accent/10"
    : variant === "success"
    ? "bg-secondary/10"
    : "bg-primary/10";
  
  const iconColorClass = variant === "warning"
    ? "text-accent"
    : variant === "success"
    ? "text-secondary"
    : "text-primary";
  
  const valueColorClass = variant === "warning"
    ? "text-accent"
    : variant === "success"
    ? "text-secondary"
    : "text-primary";

  return (
    <div 
      className={`${bgClass} rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
      onClick={onClick}
    >
      <div className={`${iconBgClass} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}>
        <Icon className={`h-5 w-5 ${iconColorClass}`} />
      </div>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueColorClass} tabular-nums`}>{value}</p>
    </div>
  );
};

export const MetricsWidget = memo(function MetricsWidget({
  openTasks,
  blockedTasks,
  upcomingTasks,
  safetyFormsThisWeek,
}: MetricsWidgetProps) {
  const navigate = useNavigate();

  return (
    <div className="h-full grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard
        icon={Clock}
        label="Open Tasks"
        value={openTasks}
        onClick={() => navigate("/tasks")}
      />
      <MetricCard
        icon={AlertTriangle}
        label="Blocked"
        value={blockedTasks}
        onClick={() => navigate("/tasks?filter=blocked")}
        variant="warning"
      />
      <MetricCard
        icon={Calendar}
        label="Due This Week"
        value={upcomingTasks}
        onClick={() => navigate("/tasks")}
      />
      <MetricCard
        icon={Shield}
        label="Safety Forms"
        value={safetyFormsThisWeek}
        onClick={() => navigate("/safety")}
        variant="success"
      />
    </div>
  );
});
