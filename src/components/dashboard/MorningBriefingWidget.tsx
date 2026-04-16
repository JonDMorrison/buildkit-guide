import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "@/components/dashboard/shared/DashboardCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Sun, RefreshCw, Check, ChevronRight, HardHat, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useMorningBriefing,
  type BriefingSection,
} from "@/hooks/useMorningBriefing";
import { format } from "date-fns";

// Split a free-form watch_out_for string into individual items.
// Backend returns one paragraph; we break on newlines and sentence ends.
const splitWatchOutItems = (text: string): string[] =>
  text
    .split(/(?:\r?\n|(?<=[.!?])\s+)/g)
    .map((s) => s.trim())
    .filter(Boolean);

// Resolve a keyword -> route mapping for a watch-out item.
const routeForItem = (text: string): string => {
  const t = text.toLowerCase();
  if (/\b(crew|manpower|labor|staffing|personnel)\b/.test(t)) return "/manpower";
  if (/\b(safety|hazard|ppe|incident|injury)\b/.test(t)) return "/safety";
  if (/\b(blocker|deficien|punch|flag)\b/.test(t)) return "/deficiencies";
  if (/\b(schedule|task|delay|overdue|behind)\b/.test(t)) return "/tasks";
  if (/daily log|site log/.test(t)) return "/daily-logs";
  return "/projects";
};

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
  const navigate = useNavigate();
  const { data: briefing, isLoading, isError, refetch, isFetching } =
    useMorningBriefing(projectId);

  const watchItems = briefing?.watch_out_for
    ? splitWatchOutItems(briefing.watch_out_for)
    : [];

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
          <div className="rounded-md border border-border bg-muted/30 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Watch out for
            </p>
            {watchItems.length > 0 ? (
              <ul className="space-y-0.5">
                {watchItems.map((item, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => navigate(routeForItem(item))}
                      className="group w-full flex items-start gap-2 px-2 py-1.5 rounded text-left text-xs text-foreground hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <span className="text-muted-foreground/60 shrink-0 mt-0.5">
                        &bull;
                      </span>
                      <span className="flex-1">{item}</span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 transition-opacity" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">
                  Nothing flagged.
                </span>
              </div>
            )}
          </div>

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
