import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, ChevronRight } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";

interface ActivityWidgetProps {
  completionTrendData: Array<{ date: string; completed: number; created: number }>;
}

export const ActivityWidget = memo(function ActivityWidget({ completionTrendData }: ActivityWidgetProps) {
  const navigate = useNavigate();

  return (
    <div className="widget-card h-full group cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate("/tasks")}>
      <div className="flex-shrink-0 mb-3 flex items-start justify-between">
        <div>
          <h3 className="widget-title">
            <TrendingUp className="h-4 w-4 text-secondary" />
            Activity Trend
          </h3>
          <p className="widget-subtitle">Tasks completed vs created (7 days)</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      
      <div className="flex-1 min-h-0">
        <ChartContainer
          config={{
            completed: { label: "Completed", color: "hsl(var(--secondary))" },
            created: { label: "Created", color: "hsl(var(--muted))" },
          }}
          className="h-full w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={completionTrendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={10} 
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line 
                type="monotone" 
                dataKey="completed" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={2}
                dot={{ fill: "hsl(var(--secondary))", r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              <Line 
                type="monotone" 
                dataKey="created" 
                stroke="hsl(var(--muted))" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: "hsl(var(--muted))", r: 2, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
});
