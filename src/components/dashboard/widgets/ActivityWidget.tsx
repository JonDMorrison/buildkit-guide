import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";

interface ActivityWidgetProps {
  completionTrendData: Array<{ date: string; completed: number; created: number }>;
}

export const ActivityWidget = ({ completionTrendData }: ActivityWidgetProps) => {
  return (
    <Card className="border-primary/20 shadow-md h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-secondary" />
          Task Activity
        </CardTitle>
        <CardDescription className="text-sm">7-day performance</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-hidden p-3">
        <ChartContainer
          config={{
            completed: { label: "Completed", color: "hsl(var(--secondary))" },
            created: { label: "Created", color: "hsl(var(--muted))" },
          }}
          className="h-full w-full max-h-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={completionTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line 
                type="monotone" 
                dataKey="completed" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={2}
                dot={{ fill: "hsl(var(--secondary))", r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="created" 
                stroke="hsl(var(--muted))" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: "hsl(var(--muted))", r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
