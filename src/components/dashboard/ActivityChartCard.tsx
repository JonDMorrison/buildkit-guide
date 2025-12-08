import { useNavigate } from "react-router-dom";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DataPoint {
  date: string;
  completed: number;
  created: number;
}

interface ActivityChartCardProps {
  data: DataPoint[];
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="premium-card !p-3 !shadow-lg border-border">
        <p className="text-xs font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground capitalize">{entry.dataKey}:</span>
            <span className="font-semibold">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const ActivityChartCard = ({ data, isLoading = false }: ActivityChartCardProps) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="widget-body flex items-center justify-center">
          <Skeleton className="w-full h-[200px]" />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="widget-card premium-card-interactive group"
      onClick={() => navigate("/tasks")}
    >
      <div className="widget-header">
        <div>
          <h3 className="widget-title">
            <TrendingUp className="h-4 w-4 text-secondary" />
            Task Activity
          </h3>
          <p className="widget-subtitle">7-day completion trend</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="widget-body chart-container" onClick={(e) => e.stopPropagation()}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--brand-secondary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--brand-secondary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="createdGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--brand-accent))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--brand-accent))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--brand-border))" 
              strokeOpacity={0.5}
              vertical={false}
            />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 11, fill: "hsl(var(--brand-text-muted))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: "hsl(var(--brand-text-muted))" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingTop: 16 }}
              formatter={(value) => (
                <span className="text-xs text-muted-foreground capitalize">{value}</span>
              )}
            />
            <Area
              type="monotone"
              dataKey="completed"
              stroke="hsl(var(--brand-secondary))"
              strokeWidth={2}
              fill="url(#completedGradient)"
            />
            <Area
              type="monotone"
              dataKey="created"
              stroke="hsl(var(--brand-accent))"
              strokeWidth={2}
              fill="url(#createdGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Skeleton for loading state
export const ActivityChartCardSkeleton = () => (
  <div className="widget-card">
    <div className="widget-header">
      <div className="space-y-1">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
    <div className="widget-body flex items-center justify-center">
      <Skeleton className="w-full h-[200px]" />
    </div>
  </div>
);