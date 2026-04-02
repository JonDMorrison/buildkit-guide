import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrgIntelligence, type TopInsight } from "@/hooks/useOrgIntelligence";

const categoryColors: Record<string, string> = {
  trade: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  job_type: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  deficiency: "bg-red-500/15 text-red-400 border-red-500/30",
  financial: "bg-green-500/15 text-green-400 border-green-500/30",
};

const priorityBorder: Record<string, string> = {
  high: "border-l-4 border-l-red-500",
  medium: "border-l-4 border-l-amber-500",
  low: "border-l-4 border-l-border",
};

export const OrgIntelligenceWidget = memo(function OrgIntelligenceWidget() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useOrgIntelligence();

  const insights = data?.top_insights?.slice(0, 3) ?? [];

  return (
    <DashboardCard
      title="Org Intelligence"
      icon={Brain}
      variant="ai_insight"
      loading={isLoading}
      error={isError ? "Unable to load insights." : null}
      empty={!isLoading && !isError && insights.length === 0}
      emptyMessage="Complete more projects to unlock org-level insights."
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/org-intelligence")}
          className="gap-1 h-7 text-xs"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Button>
      }
    >
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={cn(
                "rounded-md px-3 py-2 bg-muted/30",
                priorityBorder[insight.priority] || ""
              )}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[8px] h-3.5 px-1",
                    categoryColors[insight.category] || ""
                  )}
                >
                  {insight.category.replace("_", " ").toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs font-medium">{insight.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                {insight.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
});
