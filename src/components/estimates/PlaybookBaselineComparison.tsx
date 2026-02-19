import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, AlertTriangle, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlaybookBaseline {
  has_playbook: boolean;
  playbook_id?: string;
  playbook_name?: string;
  playbook_version?: number;
  task_count?: number;
  required_task_count?: number;
  hours_low?: number;
  hours_high?: number;
  hours_midpoint?: number;
  required_hours_low?: number;
  required_hours_high?: number;
}

interface Props {
  baseline: PlaybookBaseline;
  estimateLaborHours: number;
  currency: string;
}

export const PlaybookBaselineComparison = ({ baseline, estimateLaborHours, currency }: Props) => {
  if (!baseline.has_playbook || !baseline.hours_midpoint) return null;

  const midpoint = baseline.hours_midpoint;
  const delta = estimateLaborHours - midpoint;
  const deltaPercent = midpoint > 0 ? Math.round((delta / midpoint) * 100) : 0;
  const isUnderEstimated = deltaPercent < -15;
  const isOverEstimated = deltaPercent > 15;

  return (
    <div className="space-y-3">
      {/* Baseline header */}
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Playbook Baseline</span>
        <Badge variant="outline" className="text-[10px] ml-1">
          {baseline.playbook_name} v{baseline.playbook_version}
        </Badge>
      </div>

      {/* Baseline KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/40">
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Hour Band</p>
            <p className="text-sm font-bold tabular-nums">
              {baseline.hours_low}–{baseline.hours_high}h
            </p>
            <p className="text-[10px] text-muted-foreground">
              Midpoint: {midpoint}h
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Estimate Hours</p>
            <p className="text-sm font-bold tabular-nums">{estimateLaborHours}h</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">vs Baseline</p>
            <p className={cn(
              "text-sm font-bold tabular-nums",
              isUnderEstimated && "text-destructive",
              isOverEstimated && "text-yellow-500",
              !isUnderEstimated && !isOverEstimated && "text-green-500"
            )}>
              {deltaPercent > 0 ? "+" : ""}{deltaPercent}%
            </p>
            <p className="text-[10px] text-muted-foreground">
              {delta > 0 ? "+" : ""}{delta}h delta
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Warning: under-estimated */}
      {isUnderEstimated && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            Estimate Below Playbook Baseline
            <TrendingDown className="h-3.5 w-3.5" />
          </AlertTitle>
          <AlertDescription>
            Estimate is <strong>{Math.abs(deltaPercent)}%</strong> below the playbook midpoint ({midpoint}h).
            Historical data suggests this scope typically requires {baseline.hours_low}–{baseline.hours_high} hours.
            Review labor allocation to avoid margin erosion.
          </AlertDescription>
        </Alert>
      )}

      {/* Info: playbook differs significantly high */}
      {isOverEstimated && (
        <Alert variant="default">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertTitle>Estimate Exceeds Playbook Baseline</AlertTitle>
          <AlertDescription>
            Estimate is <strong>+{deltaPercent}%</strong> above the playbook midpoint ({midpoint}h).
            This may indicate scope additions beyond the standard playbook template.
          </AlertDescription>
        </Alert>
      )}

      {/* Subtle inline note when within range */}
      {!isUnderEstimated && !isOverEstimated && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
          Playbook baseline differs from estimate by {Math.abs(deltaPercent)}% — within acceptable range.
        </p>
      )}
    </div>
  );
};
