import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge } from "lucide-react";

interface HealthWidgetProps {
  healthScore: number;
  atRiskTasks: number;
  blockedTasks: number;
  overdueTasks: number;
}

export const HealthWidget = ({
  healthScore,
  atRiskTasks,
  blockedTasks,
  overdueTasks,
}: HealthWidgetProps) => {
  return (
    <Card className="border-primary/20 shadow-md h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
          <Gauge className="h-5 w-5 text-accent" />
          Project Health
        </CardTitle>
        <CardDescription className="text-sm">Key risk indicators</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center gap-3 min-h-0 overflow-hidden p-3">
        <div className="relative w-24 h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="10"
              opacity="0.2"
            />
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              fill="none"
              stroke={healthScore > 70 ? "hsl(var(--secondary))" : healthScore > 40 ? "hsl(var(--accent))" : "hsl(var(--destructive))"}
              strokeWidth="10"
              strokeDasharray={`${(healthScore / 100) * 283} 283`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl lg:text-3xl font-black text-primary">{healthScore}</span>
            <span className="text-xs text-muted-foreground font-semibold">Health</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 w-full flex-shrink-0">
          <div className="text-center">
            <p className="text-lg font-black text-accent">{atRiskTasks}</p>
            <p className="text-xs text-muted-foreground font-medium truncate">At Risk</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-accent">{blockedTasks}</p>
            <p className="text-xs text-muted-foreground font-medium truncate">Blocked</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-destructive">{overdueTasks}</p>
            <p className="text-xs text-muted-foreground font-medium truncate">Overdue</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
