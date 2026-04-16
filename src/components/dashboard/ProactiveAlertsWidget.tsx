import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { Button } from "@/components/ui/button";
import { ShieldAlert, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useProactiveAlerts,
  type ProactiveAlert,
} from "@/hooks/useProactiveAlerts";

interface ProactiveAlertsWidgetProps {
  projectId: string | null;
}

// Severity -> colored dot. Red for critical, amber for high, blue for normal.
const severityDot = (severity: string): string => {
  if (severity === "critical") return "bg-red-500";
  if (severity === "high") return "bg-amber-500";
  return "bg-blue-500";
};

// Keyword-based route resolution for alerts. Intentionally separate from
// the backend's alert.action_url so the widget matches the product spec
// for where each category of alert should land the user.
const routeForAlert = (alert: ProactiveAlert): string => {
  const haystack = `${alert.type} ${alert.title} ${alert.message}`.toLowerCase();
  if (/\b(safety|hazard|ppe|incident|injury)\b/.test(haystack)) return "/safety";
  if (/\b(blocker|deficien|punch)\b/.test(haystack)) return "/deficiencies";
  if (/\b(task|overdue|delay|schedule|stale)\b/.test(haystack)) return "/tasks";
  if (/\b(crew|manpower|labor|staffing|trade|overrun)\b/.test(haystack)) return "/manpower";
  if (/daily.?log|site.?log|missing.?log/.test(haystack)) return "/daily-logs";
  return "/projects";
};

export const ProactiveAlertsWidget = memo(function ProactiveAlertsWidget({
  projectId,
}: ProactiveAlertsWidgetProps) {
  const navigate = useNavigate();
  const {
    alerts,
    alertCount,
    criticalCount,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useProactiveAlerts(projectId);
  const [expanded, setExpanded] = useState(false);

  // No project selected -- render nothing (parent handles its own empty state).
  if (!projectId) return null;

  // Fetch failed -- surface the error so it isn't silent.
  if (isError) {
    return (
      <DashboardCard
        title="Active Alerts"
        icon={ShieldAlert}
        error="Unable to check for alerts. Tap to retry."
      />
    );
  }

  // Quiet-hide when the query has resolved and there is nothing to show.
  // During the initial fetch (isLoading=true) we still render the skeleton
  // card so users see activity instead of a flash.
  if (!isLoading && alertCount === 0) return null;

  const visibleAlerts = expanded ? alerts : alerts.slice(0, 4);
  const hasMore = alerts.length > 4;

  return (
    <DashboardCard
      title="Active Alerts"
      icon={ShieldAlert}
      loading={isLoading}
      description={
        alertCount > 0
          ? `${alertCount} issue${alertCount !== 1 ? "s" : ""} detected`
          : undefined
      }
      actions={
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 h-7 text-xs"
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      }
    >
      <div className="space-y-0.5">
        {visibleAlerts.map((alert) => (
          <AlertItem
            key={alert.id}
            alert={alert}
            onClick={() => navigate(routeForAlert(alert))}
          />
        ))}

        {hasMore && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            View all {alertCount} alerts
          </button>
        )}
      </div>
    </DashboardCard>
  );
});

function AlertItem({
  alert,
  onClick,
}: {
  alert: ProactiveAlert;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full flex items-start gap-3 px-2 py-2 rounded-md text-left hover:bg-muted/50 cursor-pointer transition-colors"
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full shrink-0 mt-1.5",
          severityDot(alert.severity)
        )}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">
          {alert.title}
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {alert.message}
        </p>
      </div>
      <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-1 transition-opacity" />
    </button>
  );
}
