import { useNavigate } from "react-router-dom";
import type { Recommendation } from "@/lib/recommendations/rules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, AlertTriangle, Info, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  recommendations: Recommendation[];
  title?: string;
  className?: string;
}

const severityConfig = {
  critical: {
    badge: "destructive" as const,
    icon: AlertTriangle,
    border: "border-l-destructive",
  },
  warn: {
    badge: "secondary" as const,
    icon: AlertTriangle,
    border: "border-l-status-warning",
  },
  info: {
    badge: "outline" as const,
    icon: Info,
    border: "border-l-primary",
  },
};

const categoryLabels: Record<string, string> = {
  labor: "Labor",
  material: "Material",
  machine: "Machine",
  invoicing: "Invoicing",
  data_quality: "Data Quality",
};

export const RecommendationsPanel = ({
  recommendations,
  title = "Recommendations",
  className,
}: Props) => {
  const navigate = useNavigate();

  if (!recommendations.length) return null;

  return (
    <Card className={cn("mb-6", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          {title}
          <Badge variant="secondary" className="ml-auto text-xs">
            {recommendations.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((rec) => {
          const config = severityConfig[rec.severity];
          const Icon = config.icon;
          return (
            <div
              key={rec.id}
              className={cn(
                "border-l-4 rounded-md bg-muted/30 p-3 space-y-1",
                config.border
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-sm truncate">{rec.title}</span>
                  <Badge variant={config.badge} className="text-[10px] px-1.5 py-0 shrink-0">
                    {rec.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                    {categoryLabels[rec.category] || rec.category}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{rec.message}</p>
              <p className="text-xs text-muted-foreground/70 italic">{rec.evidence}</p>
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-foreground/80">
                  💡 {rec.suggested_action}
                </p>
                {rec.link && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => navigate(rec.link!)}
                  >
                    Fix
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
