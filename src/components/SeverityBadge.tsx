import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

export type SeverityLevel = "low" | "medium" | "high" | "critical";

interface SeverityBadgeProps {
  severity: SeverityLevel;
  label?: string;
  className?: string;
}

const severityConfig: Record<SeverityLevel, { defaultLabel: string; variant: "info" | "warning" | "error" | "destructive" }> = {
  low: { defaultLabel: "Low", variant: "info" },
  medium: { defaultLabel: "Medium", variant: "warning" },
  high: { defaultLabel: "High", variant: "error" },
  critical: { defaultLabel: "Critical", variant: "destructive" },
};

export const SeverityBadge = ({ severity, label, className }: SeverityBadgeProps) => {
  const config = severityConfig[severity];
  return (
    <Badge variant={config.variant} className={cn(className)} aria-label={`Severity: ${label || config.defaultLabel}`}>
      {label || config.defaultLabel}
    </Badge>
  );
};
