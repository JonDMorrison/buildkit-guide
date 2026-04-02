import { memo } from "react";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Sun, RefreshCw, AlertTriangle, HardHat, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useMorningBriefing,
  type BriefingSection,
} from "@/hooks/useMorningBriefing";
import { format } from "date-fns";

interface MorningBriefingWidgetProps {
  projectId: string | null;
}

const priorityStyles: Record<string, { border: string; badge: string; label: string }> = {
  critical: {
    border: "border-l-4 border-l-destructive",
    badge: "bg-destructive/10 text-destructive border-destructive/20",
    label: "Critical",
  },
  high: {
    border: "border-l-4 border-l-amber-500",
    badge: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    label: "High",
  },
  normal: {
    border: "border-l-4 border-l-border",
    badge: "bg-muted text-muted-foreground border-border",
    label: "Normal",
  },
};

export const MorningBriefingWidget = memo(function MorningBriefingWidget({
  projectId,
}: MorningBriefingWidgetProps) {
  const { data: briefing, isLoading, isError, refetch, isFetching } =
    useMorningBriefing(projectId);

  if (!projectId) {
    return (
      <DashboardCard
        title="Morning Briefing"
        icon={Sun}
        variant="ai_insight"
        empty
        emptyMessage="Select a project to see your morning briefing"
      />
    );
  }

  return (
    <DashboardCard
      title="Morning Briefing"
      icon={Sun}
      variant="ai_insight"
      loading={isLoading}
      error={isError ? "Unable to generate briefing. Check your connection." : null}
      actions={
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
      }
      description={
        briefing?.generated_at
          ? `Generated at ${format(new Date(briefing.generated_at), "h:mm a")}`
          : undefined
      }
    >
      {briefing && (
        <div className="space-y-4">
          {/* Headline */}
          <p className="text-sm font-semibold text-foreground leading-snug">
            {briefing.headline}
          </p>

          {/* Sections */}
          {briefing.sections.length > 0 && (
            <Accordion
              type="multiple"
              defaultValue={briefing.sections
                .filter((s) => s.priority !== "normal")
                .map((_, i) => `section-${i}`)}
            >
              {briefing.sections.map((section, idx) => {
                const style = priorityStyles[section.priority] || priorityStyles.normal;
                return (
                  <AccordionItem
                    key={idx}
                    value={`section-${idx}`}
                    className={cn("rounded-md mb-1.5", style.border)}
                  >
                    <AccordionTrigger className="py-2 px-3 hover:no-underline text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{section.title}</span>
                        <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", style.badge)}>
                          {style.label}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-2">
                      <ul className="space-y-1">
                        {section.items.map((item, iIdx) => (
                          <li
                            key={iIdx}
                            className="text-xs text-muted-foreground flex items-start gap-1.5"
                          >
                            <span className="text-muted-foreground/50 mt-0.5 shrink-0">
                              &bull;
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}

          {/* Watch out for */}
          {briefing.watch_out_for && (
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-0.5">
                  Watch out for
                </p>
                <p className="text-xs text-amber-900/80">{briefing.watch_out_for}</p>
              </div>
            </div>
          )}

          {/* Crew + Safety footer */}
          <div className="grid grid-cols-2 gap-2">
            {briefing.crew_summary && (
              <div className="rounded-md bg-muted/50 p-2.5">
                <div className="flex items-center gap-1 mb-1">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Crew
                  </span>
                </div>
                <p className="text-xs text-foreground">{briefing.crew_summary}</p>
              </div>
            )}
            {briefing.safety_note && (
              <div className="rounded-md bg-muted/50 p-2.5">
                <div className="flex items-center gap-1 mb-1">
                  <HardHat className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Safety
                  </span>
                </div>
                <p className="text-xs text-foreground">{briefing.safety_note}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardCard>
  );
});
