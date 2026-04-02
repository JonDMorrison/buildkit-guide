import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useProactiveAlerts,
  type ProactiveAlert,
} from "@/hooks/useProactiveAlerts";
import { format } from "date-fns";

interface ProactiveAlertsWidgetProps {
  projectId: string | null;
}

const severityStyles: Record<
  string,
  { border: string; badge: string; badgeLabel: string; bg: string }
> = {
  critical: {
    border: "border-l-4 border-l-red-500",
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
    badgeLabel: "CRITICAL",
    bg: "bg-red-950/20",
  },
  high: {
    border: "border-l-4 border-l-amber-500",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    badgeLabel: "HIGH",
    bg: "",
  },
  normal: {
    border: "border-l-4 border-l-blue-500",
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    badgeLabel: "NORMAL",
    bg: "",
  },
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
    generatedAt,
  } = useProactiveAlerts(projectId);
  const [expanded, setExpanded] = useState(false);

  if (!projectId) {
    return (
      <DashboardCard
        title="Active Alerts"
        icon={ShieldAlert}
        variant="alert"
        empty
        emptyMessage="Select a project to see alerts"
      />
    );
  }

  const visibleAlerts = expanded ? alerts : alerts.slice(0, 4);
  const hasMore = alerts.length > 4;

  return (
    <DashboardCard
      title="Active Alerts"
      icon={ShieldAlert}
      variant="alert"
      loading={isLoading}
      error={isError ? "Unable to check for alerts. Tap to retry." : null}
      description={
        alertCount > 0
          ? `${alertCount} issue${alertCount !== 1 ? "s" : ""} detected`
          : generatedAt
            ? "All clear"
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
            <RefreshCw
              className={cn("h-3 w-3", isFetching && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      }
    >
      {/* Empty state */}
      {!isLoading && alertCount === 0 && (
        <div className="flex flex-col items-center py-6 gap-2">
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          </div>
          <p className="text-sm font-medium text-foreground">
            All clear — no issues detected
          </p>
          {generatedAt && (
            <p className="text-[11px] text-muted-foreground">
              Last checked: {format(new Date(generatedAt), "h:mm a")}
            </p>
          )}
        </div>
      )}

      {/* Alert cards */}
      {alertCount > 0 && (
        <div className="space-y-1.5">
          {visibleAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAction={(url) => navigate(url)}
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
      )}
    </DashboardCard>
  );
});

function AlertCard({
  alert,
  onAction,
}: {
  alert: ProactiveAlert;
  onAction: (url: string) => void;
}) {
  const style = severityStyles[alert.severity] || severityStyles.normal;

  return (
    <div
      className={cn(
        "rounded-md px-3 py-2.5",
        style.border,
        style.bg || "bg-muted/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className={cn("text-[9px] h-4 px-1.5 font-semibold", style.badge)}
            >
              {style.badgeLabel}
            </Badge>
            <span className="text-xs font-semibold text-foreground truncate">
              {alert.title}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {alert.message}
          </p>
        </div>
        {alert.action_label && alert.action_url && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction(alert.action_url!)}
            className="h-7 text-[11px] gap-1 shrink-0 mt-0.5"
          >
            {alert.action_label}
            <ExternalLink className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
