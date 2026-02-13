import { useAIInsight } from "@/hooks/useAIInsight";
import { useProjectRole } from "@/hooks/useProjectRole";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  projectId?: string | null;
  title?: string;
}

export const WeeklyInsightCard = ({ projectId = null, title }: Props) => {
  const { content, loading, generating, error, snapshotDate, cached, generate } =
    useAIInsight(projectId);
  const { isGlobalAdmin } = useProjectRole();
  const { isAdmin: isOrgAdmin } = useOrganizationRole();

  const canRegenerate = isGlobalAdmin || isOrgAdmin;
  const cardTitle = title || (projectId ? "Weekly Insight" : "Weekly Ops Summary");

  if (loading) return <Skeleton className="h-40" />;

  // No content yet — show generate prompt
  if (!content && !error) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center">
          <Sparkles className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            No AI insight generated yet. Generate one from your latest snapshot data.
          </p>
          {canRegenerate && (
            <Button size="sm" onClick={generate} disabled={generating}>
              {generating ? (
                <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1.5" />
              )}
              Generate Insight
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (error && !content) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          {canRegenerate && (
            <Button size="sm" variant="outline" className="mt-2" onClick={generate} disabled={generating}>
              <RefreshCw className={cn("h-4 w-4 mr-1.5", generating && "animate-spin")} />
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">{cardTitle}</CardTitle>
          {snapshotDate && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Calendar className="h-3 w-3" />
              {snapshotDate}
            </span>
          )}
        </div>
        {canRegenerate && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={generate}
            disabled={generating}
            title="Regenerate insight"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", generating && "animate-spin")} />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {content?.what_changed && (
          <div>
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
              What Changed
            </p>
            <p className="leading-relaxed">{content.what_changed}</p>
          </div>
        )}
        {content?.what_it_means && (
          <div>
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
              What It Means
            </p>
            <p className="leading-relaxed">{content.what_it_means}</p>
          </div>
        )}
        {content?.what_to_do && (
          <div>
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
              What To Do Next
            </p>
            <p className="leading-relaxed">{content.what_to_do}</p>
          </div>
        )}
        {cached && (
          <p className="text-[10px] text-muted-foreground">
            Cached insight · regenerate for latest data
          </p>
        )}
      </CardContent>
    </Card>
  );
};
