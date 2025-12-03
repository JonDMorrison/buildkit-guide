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
    <Card className="border-primary/20 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
          <Gauge className="h-5 w-5 text-accent" />
          Project Health
        </CardTitle>
        <CardDescription className="text-sm">Key risk indicators</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center gap-4 min-h-0">
        <div className="relative w-32 h-32 lg:w-40 lg:h-40">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="12"
              opacity="0.2"
            />
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              fill="none"
              stroke={healthScore > 70 ? "hsl(var(--secondary))" : healthScore > 40 ? "hsl(var(--accent))" : "hsl(var(--destructive))"}
              strokeWidth="12"
              strokeDasharray={`${(healthScore / 100) * 283} 283`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl lg:text-4xl font-black text-primary">{healthScore}</span>
            <span className="text-xs text-muted-foreground font-semibold">Health</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full">
          <div className="text-center">
            <p className="text-xl font-black text-accent">{atRiskTasks}</p>
            <p className="text-xs text-muted-foreground font-medium">At Risk</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-accent">{blockedTasks}</p>
            <p className="text-xs text-muted-foreground font-medium">Blocked</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-destructive">{overdueTasks}</p>
            <p className="text-xs text-muted-foreground font-medium">Overdue</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
