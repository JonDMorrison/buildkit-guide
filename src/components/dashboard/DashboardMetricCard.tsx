import { LucideIcon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardMetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  onClick?: () => void;
  variant?: "default" | "warning" | "danger" | "success" | "info";
  isLoading?: boolean;
  className?: string;
}

export const DashboardMetricCard = ({
  icon: Icon,
  label,
  value,
  onClick,
  variant = "default",
  isLoading = false,
  className,
}: DashboardMetricCardProps) => {
  const iconBgColors = {
    default: "bg-primary/10 text-primary",
    warning: "bg-status-warning-bg text-orange-600",
    danger: "bg-status-danger-bg text-red-600",
    success: "bg-status-success-bg text-secondary",
    info: "bg-status-info-bg text-blue-600",
  };

  if (isLoading) {
    return (
      <div className={cn("metric-card", className)}>
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="metric-card-content space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-12" />
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "metric-card",
        variant === "warning" && "metric-card-warning",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className={cn("metric-card-icon", iconBgColors[variant])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="metric-card-content">
        <p className="metric-card-label">{label}</p>
        <p className="metric-card-value">{value}</p>
      </div>
      {onClick && <ChevronRight className="metric-card-chevron" />}
    </div>
  );
};

// Skeleton version for loading states
export const DashboardMetricCardSkeleton = () => (
  <div className="metric-card">
    <Skeleton className="w-12 h-12 rounded-xl" />
    <div className="metric-card-content space-y-2">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-7 w-12" />
    </div>
  </div>
);