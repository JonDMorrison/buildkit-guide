import { useNavigate } from "react-router-dom";
import { useDataQualityAudit } from "@/hooks/rpc/useDataQualityAudit";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, CheckCircle2, ChevronRight } from "lucide-react";

export function DataIntegrityBannerCard() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useDataQualityAudit();

  const issues = Array.isArray(data) ? data : data?.issues || [];
  const issueCount = issues.length;
  const hasIssues = issueCount > 0;

  // Group by severity
  const critical = issues.filter((i: any) => i.severity === "high" || i.severity === "critical");
  const warnings = issues.filter((i: any) => i.severity === "medium" || i.severity === "warning");
  const info = issues.filter((i: any) => !["high", "critical", "medium", "warning"].includes(i.severity));

  return (
    <DashboardCard
      title="Data Integrity"
      description={hasIssues ? `${issueCount} issue${issueCount !== 1 ? "s" : ""} detected` : "All checks passed"}
      icon={hasIssues ? ShieldAlert : CheckCircle2}
      loading={isLoading}
      error={error ? String(error) : null}
      variant={hasIssues ? "alert" : "metric"}
      traceSource="rpc_data_quality_audit"
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate("/data-health")} className="text-xs">
          Details <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      }
    >
      {!hasIssues && !isLoading && (
        <div className="flex items-center gap-2 py-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <span className="text-sm text-primary font-medium">All integrity checks passed</span>
        </div>
      )}

      {hasIssues && (
        <div className="space-y-2">
          {critical.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-destructive font-semibold">Critical</p>
              {critical.slice(0, 3).map((issue: any, i: number) => (
                <IssueRow key={i} issue={issue} severity="critical" onNavigate={navigate} />
              ))}
              {critical.length > 3 && <MoreLabel count={critical.length - 3} />}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-accent-foreground font-semibold">Warnings</p>
              {warnings.slice(0, 3).map((issue: any, i: number) => (
                <IssueRow key={i} issue={issue} severity="warning" onNavigate={navigate} />
              ))}
              {warnings.length > 3 && <MoreLabel count={warnings.length - 3} />}
            </div>
          )}
          {info.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Info</p>
              {info.slice(0, 2).map((issue: any, i: number) => (
                <IssueRow key={i} issue={issue} severity="info" onNavigate={navigate} />
              ))}
              {info.length > 2 && <MoreLabel count={info.length - 2} />}
            </div>
          )}
        </div>
      )}
    </DashboardCard>
  );
}

function IssueRow({ issue, severity, onNavigate }: { issue: any; severity: string; onNavigate: any }) {
  const label = issue.issue_key?.replace(/_/g, " ") || issue.label || "Unknown issue";
  const badgeClass = severity === "critical"
    ? "text-destructive border-destructive/30"
    : severity === "warning"
    ? "text-accent-foreground border-accent/30"
    : "text-muted-foreground border-border";

  return (
    <div
      className="flex items-center justify-between p-2 rounded-md border border-border/50 bg-card hover:bg-muted/10 transition-colors cursor-pointer"
      onClick={() => issue.project_id && onNavigate(`/insights/project?projectId=${issue.project_id}`)}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="outline" className={`text-[10px] shrink-0 ${badgeClass}`}>
          {label}
        </Badge>
        {issue.project_name && (
          <span className="text-xs text-muted-foreground truncate">{issue.project_name}</span>
        )}
      </div>
      {issue.affected_count != null && (
        <span className="text-xs font-mono text-muted-foreground shrink-0">{issue.affected_count}</span>
      )}
    </div>
  );
}

function MoreLabel({ count }: { count: number }) {
  return <p className="text-xs text-muted-foreground text-center">+{count} more</p>;
}
