import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

interface StatusItem {
  status: string;
  count: number;
  color: string;
}

interface DistributionWidgetProps {
  statusDistribution: StatusItem[];
  totalTasks: number;
}

export const DistributionWidget = ({ statusDistribution, totalTasks }: DistributionWidgetProps) => {
  return (
    <Card className="border-primary/20 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
          <Target className="h-5 w-5 text-secondary" />
          Task Distribution
        </CardTitle>
        <CardDescription className="text-sm">Current workflow breakdown</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center gap-3 min-h-0">
        {statusDistribution.map((item) => (
          <div key={item.status} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">{item.status}</span>
              <span className="text-sm font-bold text-primary">{item.count}</span>
            </div>
            <div className="w-full bg-muted/50 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: totalTasks > 0 ? `${(item.count / totalTasks) * 100}%` : "0%",
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
