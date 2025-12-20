import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceStrict } from "date-fns";
import { Clock, CheckCircle, Search, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineEntry {
  field_name: string;
  field_value: string | null;
}

interface RightToRefuseTimelineProps {
  entries: TimelineEntry[];
  createdAt: string;
}

const RESOLUTION_LABELS: Record<string, string> = {
  pending_investigation: "Pending Investigation",
  under_review: "Under Review",
  resolved_safe: "Resolved - Work Deemed Safe",
  resolved_modified: "Resolved - Work Modified",
  resolved_refused: "Resolved - Refusal Upheld",
  escalated: "Escalated to Safety Committee/Ministry",
};

const isResolvedStatus = (status: string) => {
  return status.startsWith("resolved_") || status === "escalated";
};

export const RightToRefuseTimeline = ({
  entries,
  createdAt,
}: RightToRefuseTimelineProps) => {
  const timeline = useMemo(() => {
    const submittedAt = entries.find(e => e.field_name === "submitted_at")?.field_value;
    const resolutionStatus = entries.find(e => e.field_name === "resolution_status")?.field_value || "pending_investigation";
    const resolvedAt = entries.find(e => e.field_name === "resolved_at")?.field_value;
    const investigationNotes = entries.find(e => e.field_name === "investigation_notes")?.field_value;

    const submittedDate = submittedAt ? new Date(submittedAt) : new Date(createdAt);
    const resolvedDate = resolvedAt ? new Date(resolvedAt) : null;

    // Determine timeline stages
    const stages: Array<{
      id: string;
      label: string;
      icon: typeof Clock;
      status: "complete" | "active" | "pending";
      timestamp?: Date;
      description?: string;
    }> = [];

    // Stage 1: Submitted
    stages.push({
      id: "submitted",
      label: "Submitted",
      icon: AlertTriangle,
      status: "complete",
      timestamp: submittedDate,
      description: "Worker reported unsafe condition",
    });

    // Stage 2: Investigation
    const isInvestigating = resolutionStatus === "under_review" || !!investigationNotes;
    const isResolved = isResolvedStatus(resolutionStatus);
    stages.push({
      id: "investigated",
      label: "Investigated",
      icon: Search,
      status: isResolved ? "complete" : isInvestigating ? "active" : "pending",
      description: isInvestigating ? "Employer investigation in progress" : "Awaiting investigation",
    });

    // Stage 3: Resolved
    stages.push({
      id: "resolved",
      label: "Resolved",
      icon: CheckCircle,
      status: isResolved ? "complete" : "pending",
      timestamp: resolvedDate || undefined,
      description: isResolved ? RESOLUTION_LABELS[resolutionStatus] : "Pending resolution",
    });

    // Calculate duration if resolved
    const duration = resolvedDate
      ? formatDistanceStrict(submittedDate, resolvedDate)
      : null;

    return { stages, resolutionStatus, duration, isResolved };
  }, [entries, createdAt]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Resolution Timeline</h3>
        </div>
        {timeline.duration && (
          <Badge variant="outline" className="text-xs">
            Resolved in {timeline.duration}
          </Badge>
        )}
      </div>

      {/* Timeline visual */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-[18px] top-8 bottom-8 w-0.5 bg-border" />

        <div className="space-y-6">
          {timeline.stages.map((stage, index) => {
            const Icon = stage.icon;
            const isLast = index === timeline.stages.length - 1;

            return (
              <div key={stage.id} className="relative flex gap-4">
                {/* Icon circle */}
                <div
                  className={cn(
                    "relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                    stage.status === "complete"
                      ? "bg-green-500/20 text-green-600"
                      : stage.status === "active"
                      ? "bg-amber-500/20 text-amber-600"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "font-medium",
                        stage.status === "pending" && "text-muted-foreground"
                      )}
                    >
                      {stage.label}
                    </span>
                    {stage.status === "active" && (
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                        In Progress
                      </Badge>
                    )}
                    {stage.status === "complete" && stage.id === "resolved" && (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                        Complete
                      </Badge>
                    )}
                  </div>
                  
                  {stage.timestamp && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {format(stage.timestamp, "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  )}
                  
                  {stage.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {stage.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current status summary */}
      {!timeline.isResolved && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-amber-600">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">
              Status: {RESOLUTION_LABELS[timeline.resolutionStatus]}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};
