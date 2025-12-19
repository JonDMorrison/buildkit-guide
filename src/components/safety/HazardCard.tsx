import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Zap, Flame, Wind, HardHat, ShieldAlert, AlertTriangle, Truck, Wrench } from "lucide-react";
import type { HazardSuggestion } from "@/hooks/useSafetyLogAutoFill";

interface HazardCardProps {
  hazard: HazardSuggestion;
  selected: boolean;
  onToggle: () => void;
}

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case "electrical":
      return <Zap className="h-5 w-5" />;
    case "fire":
      return <Flame className="h-5 w-5" />;
    case "weather":
      return <Wind className="h-5 w-5" />;
    case "ppe":
      return <HardHat className="h-5 w-5" />;
    case "equipment":
      return <Truck className="h-5 w-5" />;
    case "tools":
      return <Wrench className="h-5 w-5" />;
    case "fall":
      return <AlertTriangle className="h-5 w-5" />;
    default:
      return <ShieldAlert className="h-5 w-5" />;
  }
};

const getSeverityStyles = (severity: string) => {
  switch (severity) {
    case "critical":
      return {
        card: "border-destructive/50 bg-destructive/5",
        badge: "bg-destructive/10 text-destructive border-destructive/30",
      };
    case "high":
      return {
        card: "border-orange-500/50 bg-orange-500/5",
        badge: "bg-orange-500/10 text-orange-600 border-orange-500/30",
      };
    case "medium":
      return {
        card: "border-yellow-500/50 bg-yellow-500/5",
        badge: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
      };
    default:
      return {
        card: "border-border bg-muted/30",
        badge: "bg-muted text-muted-foreground border-border",
      };
  }
};

export const HazardCard = ({ hazard, selected, onToggle }: HazardCardProps) => {
  const styles = getSeverityStyles(hazard.severity);

  return (
    <div
      onClick={onToggle}
      className={cn(
        "relative flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all min-h-[72px]",
        "active:scale-[0.98] touch-manipulation",
        selected ? "ring-2 ring-primary ring-offset-2" : "",
        styles.card
      )}
    >
      {/* Checkbox */}
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        className="mt-0.5 h-5 w-5 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Icon */}
      <div className="flex-shrink-0 text-muted-foreground">
        {getCategoryIcon(hazard.category)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h4 className="font-medium text-foreground">{hazard.title}</h4>
          <Badge variant="outline" className={cn("text-xs uppercase", styles.badge)}>
            {hazard.severity}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{hazard.description}</p>
      </div>
    </div>
  );
};
